const mongoose            = require('mongoose');
const InventoryTransaction = require('../models/InventoryTransaction');
const CompletionReport    = require('../models/CompletionReport');
const INVENTORY           = require('../constants/inventory');

/**
 * getMonthlyReport — per-item stock movement summary for a calendar month.
 *
 * Aggregating in MongoDB rather than pulling all transactions to the app layer
 * keeps the payload small regardless of transaction volume.
 *
 * Net consumed = deducted - returned, giving the true cost of goods used.
 */
const getMonthlyReport = async (year, month) => {
  const start = new Date(year, month - 1, 1);             // 1st of month 00:00
  const end   = new Date(year, month, 1);                  // 1st of next month 00:00

  const pipeline = [
    {
      $match: {
        createdAt: { $gte: start, $lt: end },
        type: {
          $in: [
            INVENTORY.TRANSACTION_TYPES.MATERIAL_DEDUCTION,
            INVENTORY.TRANSACTION_TYPES.COMPLETION_RETURN,
            INVENTORY.TRANSACTION_TYPES.RESTOCK,
            INVENTORY.TRANSACTION_TYPES.DEDUCT,
            INVENTORY.TRANSACTION_TYPES.RETURN,
          ],
        },
      },
    },
    {
      // Group by item; accumulate deducted, returned, and restocked quantities
      // along with the weighted cost of restocks for total cost calculation.
      $group: {
        _id: '$itemId',

        deducted: {
          $sum: {
            $cond: [
              { $in: ['$type', [INVENTORY.TRANSACTION_TYPES.MATERIAL_DEDUCTION, INVENTORY.TRANSACTION_TYPES.DEDUCT]] },
              '$quantity',
              0,
            ],
          },
        },
        returned: {
          $sum: {
            $cond: [
              { $in: ['$type', [INVENTORY.TRANSACTION_TYPES.COMPLETION_RETURN, INVENTORY.TRANSACTION_TYPES.RETURN]] },
              '$quantity',
              0,
            ],
          },
        },
        restocked: {
          $sum: {
            $cond: [{ $eq: ['$type', INVENTORY.TRANSACTION_TYPES.RESTOCK] }, '$quantity', 0],
          },
        },
        // Total restock cost captures cash outflow for the period
        restockCost: {
          $sum: {
            $cond: [
              { $eq: ['$type', INVENTORY.TRANSACTION_TYPES.RESTOCK] },
              { $multiply: ['$quantity', '$costPerUnit'] },
              0,
            ],
          },
        },
        transactionCount: { $sum: 1 },
      },
    },
    {
      $addFields: {
        // Net consumed = what went out minus what came back
        netConsumed: { $subtract: ['$deducted', '$returned'] },
      },
    },
    {
      // Join with InventoryItem to get human-readable name/sku/unit
      $lookup: {
        from:         'inventoryitems',
        localField:   '_id',
        foreignField: '_id',
        as:           'item',
      },
    },
    { $unwind: { path: '$item', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        _id:              0,
        itemId:           '$_id',
        name:             '$item.name',
        sku:              '$item.sku',
        unit:             '$item.unit',
        type:             '$item.type',
        deducted:         1,
        returned:         1,
        restocked:        1,
        netConsumed:      1,
        restockCost:      1,
        transactionCount: 1,
      },
    },
    { $sort: { name: 1 } },
  ];

  const breakdown = await InventoryTransaction.aggregate(pipeline);

  // Summarise across all items so the dashboard can show one-line totals
  const totals = breakdown.reduce(
    (acc, row) => {
      acc.totalDeducted  += row.deducted;
      acc.totalReturned  += row.returned;
      acc.totalRestocked += row.restocked;
      acc.totalNetConsumed += row.netConsumed;
      acc.totalRestockCost += row.restockCost;
      return acc;
    },
    { totalDeducted: 0, totalReturned: 0, totalRestocked: 0, totalNetConsumed: 0, totalRestockCost: 0 }
  );

  return {
    period: { year, month, start, end },
    breakdown,
    totals,
  };
};

/**
 * getAnomalySummary — surfaces the most-flagged items and employees in a month.
 *
 * Grouping by both item and employee gives admin two different angles:
 * a consistently flagged item suggests a rate calibration problem;
 * a consistently flagging employee suggests training or trust issues.
 */
const getAnomalySummary = async (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  // Only reports with at least one anomaly flag are relevant
  const reports = await CompletionReport.find({
    createdAt:    { $gte: start, $lt: end },
    anomalyFlags: { $exists: true, $not: { $size: 0 } },
  })
    .populate('submittedBy', 'name email')
    .lean();

  // ── Top flagged items ──────────────────────────────────────────────────
  const itemFlagMap = {};
  for (const report of reports) {
    for (const line of report.consumables || []) {
      if (!line.flagged) continue;
      const key = String(line.itemId);
      if (!itemFlagMap[key]) {
        itemFlagMap[key] = { itemId: line.itemId, name: line.name, sku: line.sku, flagCount: 0, usageRatios: [] };
      }
      itemFlagMap[key].flagCount++;
      if (line.expectedByRate > 0) {
        itemFlagMap[key].usageRatios.push(line.reportedUsed / line.expectedByRate);
      }
    }
  }

  const topItems = Object.values(itemFlagMap)
    .map((entry) => ({
      ...entry,
      avgUsageRatio: entry.usageRatios.length
        ? entry.usageRatios.reduce((a, b) => a + b, 0) / entry.usageRatios.length
        : null,
      usageRatios: undefined, // don't expose raw array to client
    }))
    .sort((a, b) => b.flagCount - a.flagCount)
    .slice(0, 5);

  // ── Top flagging employees ─────────────────────────────────────────────
  const empFlagMap = {};
  for (const report of reports) {
    const key = String(report.submittedBy?._id || report.submittedBy);
    if (!empFlagMap[key]) {
      empFlagMap[key] = {
        userId:    report.submittedBy?._id || report.submittedBy,
        name:      report.submittedBy?.name  || 'Unknown',
        email:     report.submittedBy?.email || '',
        flagCount: 0,
        reportCount: 0,
      };
    }
    empFlagMap[key].flagCount   += report.anomalyFlags.length;
    empFlagMap[key].reportCount += 1;
  }

  const topEmployees = Object.values(empFlagMap)
    .sort((a, b) => b.flagCount - a.flagCount)
    .slice(0, 5);

  return {
    period: { year, month },
    totalFlaggedReports: reports.length,
    topFlaggedItems:     topItems,
    topFlaggingEmployees: topEmployees,
  };
};

module.exports = {
  getMonthlyReport,
  getAnomalySummary,
};

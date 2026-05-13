const Booking          = require('../models/Booking');
const InventoryItem    = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const ConsumptionRate  = require('../models/ConsumptionRate');
const MaterialRequest  = require('../models/MaterialRequest');
const CompletionReport = require('../models/CompletionReport');
const Equipment        = require('../models/Equipment');
const INVENTORY        = require('../constants/inventory');

// Lazy require to avoid circular deps
const getLowStockAlertService = () => require('./lowStockAlertService');

/**
 * submitReport — job lead submits a post-job completion report.
 *
 * The report is locked immediately on submission (isLocked = true) so the data
 * is immutable while admin verifies it. Rejection unlocks it for resubmission.
 *
 * Flag logic runs here rather than on verification so admin sees flagged items
 * before deciding whether to approve.
 */
const submitReport = async (bookingId, submittedBy, { consumables, equipment }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found');

  // Only the designated job lead can submit — prevents random staff submitting
  if (booking.jobLead && String(booking.jobLead) !== String(submittedBy)) {
    throw new Error('Only the assigned job lead can submit the completion report');
  }

  if (booking.materialStatus !== 'materials_approved') {
    throw new Error(`Booking materials must be approved to submit a report (current: ${booking.materialStatus})`);
  }

  // Prevent duplicate submissions while the first is still pending verification
  const existing = await CompletionReport.findOne({ bookingId });
  if (existing && existing.isLocked) {
    throw new Error('A completion report is already submitted and pending verification');
  }

  // Fetch consumption rates to compute expected quantities per item
  const rate = await ConsumptionRate.findOne({
    serviceType: booking.serviceType,
    subType:     booking.subType,
  });

  const rateMap = {};
  if (rate) {
    for (const rateItem of rate.items) {
      if (rateItem.itemType === 'consumable') {
        rateMap[String(rateItem.itemId)] = rateItem.ratePerUnit;
      }
    }
  }

  const now = new Date();
  const usageItems = [];

  for (const line of consumables) {
    const itemKey    = String(line.itemId);
    const ratePerUnit = rateMap[itemKey] || 0;
    const expectedQty = ratePerUnit * booking.usageFactorValue;

    const reportedUsed = Math.max(0, Number(line.reportedUsed) || 0);
    const ratio = expectedQty > 0 ? reportedUsed / expectedQty : 0;

    const flagged =
      ratio < INVENTORY.FLAG_LOW_RATIO ||
      reportedUsed > (line.allocatedQty || 0) * INVENTORY.FLAG_HIGH_RATIO;

    const flagReason = reportedUsed > (line.allocatedQty || 0) * INVENTORY.FLAG_HIGH_RATIO
      ? 'EXCEEDS_ALLOCATION'
      : ratio < INVENTORY.FLAG_LOW_RATIO ? 'SUSPICIOUSLY_LOW' : null;

    usageItems.push({
      itemId:       line.itemId,
      allocatedQty: line.allocatedQty || 0,
      reportedUsed,
      expectedQty,
      ratio,
      flagged,
      flagReason,
    });
  }

  const equipmentConditions = (equipment || []).map((e) => ({
    equipmentId: e.equipmentId,
    condition:   e.condition,
  }));

  // Upsert — if a previous report was rejected (isLocked = false) reuse the doc
  let report;
  if (existing) {
    existing.submittedBy        = submittedBy;
    existing.submittedAt        = now;
    existing.isLocked           = true;
    existing.status             = INVENTORY.COMPLETION_REPORT_STATUSES.PENDING_VERIFICATION;
    existing.usageItems         = usageItems;
    existing.equipmentConditions = equipmentConditions;
    existing.bottleReturns      = [];
    existing.verifiedBy         = undefined;
    existing.verifiedAt         = undefined;
    report = await existing.save();
  } else {
    report = await CompletionReport.create({
      bookingId,
      submittedBy,
      submittedAt:         now,
      isLocked:            true,
      status:              INVENTORY.COMPLETION_REPORT_STATUSES.PENDING_VERIFICATION,
      usageItems,
      equipmentConditions,
      bottleReturns:       [],
    });
  }

  return report;
};

/**
 * verifyReport — admin approves or rejects the completion report.
 *
 * On approval: returned stock is added back, equipment status is updated.
 * On rejection: the report is unlocked so the job lead can revise and resubmit.
 */
const verifyReport = async (reportId, adminUserId, approved, rejectionReason) => {
  const report = await CompletionReport.findById(reportId);
  if (!report) throw new Error('Completion report not found');

  if (report.status !== INVENTORY.COMPLETION_REPORT_STATUSES.PENDING_VERIFICATION) {
    throw new Error(`Report is already ${report.status}`);
  }

  const now = new Date();
  const lowStockAlertService = getLowStockAlertService();

  if (!approved) {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new Error('Rejection reason is required');
    }
    report.status     = INVENTORY.COMPLETION_REPORT_STATUSES.REJECTED;
    report.adminNote  = rejectionReason.trim();
    report.verifiedBy = adminUserId;
    report.verifiedAt = now;
    report.isLocked   = false; // unlock for resubmission
    await report.save();
    return report;
  }

  // ── Approved path ──────────────────────────────────────────────────────

  // Return unused consumables to stock
  for (const line of report.usageItems) {
    const returnQty = Math.max(0, line.allocatedQty - line.reportedUsed);
    if (returnQty <= 0) continue;

    const item = await InventoryItem.findById(line.itemId);
    if (!item) continue;

    const quantityBefore = item.quantity;
    item.quantity += returnQty;
    await item.save();

    await InventoryTransaction.create({
      itemId:        item._id,
      type:          INVENTORY.TRANSACTION_TYPES.COMPLETION_RETURN,
      quantity:      returnQty,
      quantityBefore,
      quantityAfter: item.quantity,
      costPerUnit:   item.costPerUnit,
      notes:         'Return after job completion',
      performedBy:   adminUserId,
    });

    await lowStockAlertService.checkAndCreateLowStockAlert(item._id).catch(() => {});
  }

  // Release equipment — update status based on reported condition
  for (const line of report.equipmentConditions) {
    const item = await Equipment.findById(line.equipmentId);
    if (!item) continue;

    if (line.condition === 'good') {
      item.status     = 'available';
      item.assignedTo = null;
    } else if (line.condition === 'damaged') {
      item.status = 'under_maintenance';
    } else if (line.condition === 'lost') {
      item.status = 'retired';
    }

    await item.save();
  }

  report.status     = INVENTORY.COMPLETION_REPORT_STATUSES.APPROVED;
  report.verifiedBy = adminUserId;
  report.verifiedAt = now;
  await report.save();

  await Booking.findByIdAndUpdate(report.bookingId, { materialStatus: 'completed' });

  return report;
};

/**
 * getReports — paginated list of completion reports for admin dashboard.
 */
const getReports = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [reports, total] = await Promise.all([
    CompletionReport.find(filter)
      .populate('submittedBy', 'name email')
      .populate('verifiedBy',  'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    CompletionReport.countDocuments(filter),
  ]);

  return { reports, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

/**
 * getReportByBooking — fetch the single report for a booking.
 */
const getReportByBooking = async (bookingId) => {
  const report = await CompletionReport.findOne({ bookingId })
    .populate('submittedBy', 'name email')
    .populate('verifiedBy',  'name email');
  if (!report) throw new Error('No completion report found for this booking');
  return report;
};

/**
 * getEmployeeReportHistory — all reports submitted by a given user.
 *
 * Useful for anomaly detection: a pattern of suspiciously_low flags from the
 * same employee warrants closer investigation.
 */
const getEmployeeReportHistory = async (userId) => {
  return CompletionReport.find({ submittedBy: userId })
    .sort({ createdAt: -1 })
    .select('bookingRef status anomalyFlags consumables equipment createdAt');
};

module.exports = {
  submitReport,
  verifyReport,
  getReports,
  getReportByBooking,
  getEmployeeReportHistory,
};

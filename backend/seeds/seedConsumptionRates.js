'use strict';
const ConsumptionRate = require('../models/ConsumptionRate');

module.exports = async function seedConsumptionRates({ stockItems }) {
  await ConsumptionRate.deleteMany({});

  /**
   * Returns the _id of the first stock item matching the given name exactly.
   * Throws if not found so a typo fails loudly rather than silently inserting null.
   */
  function getStockId(name) {
    const item = stockItems.find((s) => s.name === name);
    if (!item) throw new Error(`Stock item not found: "${name}"`);
    return item._id;
  }

  /** Build a consumable item-rate entry. */
  function con(name, ratePerUnit) {
    return { itemId: getStockId(name), itemType: 'consumable', ratePerUnit, flatPerJob: false };
  }

  const rateDocs = [
    // ── DOC 1 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'house_deep_cleaning',
      subType:     'normal',
      usageFactor: 'square_feet',
      items: [
        con('All-purpose cleaner',        0.003),
        con('Floor cleaner',              0.004),
        con('Bathroom / toilet cleaner',  0.002),
        con('Kitchen degreaser',          0.0015),
        con('Glass cleaner',              0.001),
        con('Microfiber cloths',          0.02),
        con('Scrub pads',                 0.01),
        con('Garbage bags',               0.02),
        con('Gloves (disposable)',        0.01),
      ],
    },

    // ── DOC 2 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'house_deep_cleaning',
      subType:     'move_in_out',
      usageFactor: 'square_feet',
      items: [
        con('All-purpose cleaner',        0.004),
        con('Floor cleaner',              0.005),
        con('Bathroom / toilet cleaner',  0.0025),
        con('Kitchen degreaser',          0.002),
        con('Cabinet and drawer cleaner', 0.002),
        con('Glass cleaner',              0.0015),
        con('Stain remover solution',     0.001),
        con('Microfiber cloths',          0.03),
        con('Scrub pads',                 0.02),
        con('Heavy-duty scrub brush',     0.01),
        con('Garbage bags',               0.04),
        con('Gloves (disposable)',        0.02),
      ],
    },

    // ── DOC 3 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'house_deep_cleaning',
      subType:     'after_construction',
      usageFactor: 'square_feet',
      items: [
        con('Construction / cement dust remover', 0.005),
        con('All-purpose cleaner',                0.004),
        con('Floor cleaner',                      0.005),
        con('Paint mark remover',                 0.002),
        con('Tile and grout cleaner',             0.003),
        con('Glass cleaner',                      0.002),
        con('Surface polish',                     0.0015),
        con('Microfiber cloths',                  0.04),
        con('Heavy-duty scrub pads',              0.02),
        con('Garbage bags',                       0.05),
        con('Gloves (disposable)',                0.02),
        con('Protective dust mask',               0.01),
      ],
    },

    // ── DOC 4 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'general_cleaning',
      subType:     'standard',
      usageFactor: 'square_feet',
      items: [
        con('All-purpose cleaner',  0.002),
        con('Floor cleaner',        0.003),
        con('Microfiber cloths',    0.01),
        con('Garbage bags',         0.01),
        con('Gloves (disposable)',  0.01),
      ],
    },

    // ── DOC 5 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'commercial_cleaning',
      subType:     'normal',
      usageFactor: 'square_feet',
      items: [
        con('All-purpose cleaner',      0.0035),
        con('Floor scrubbing solution', 0.005),
        con('Restroom sanitizer',       0.0025),
        con('Glass cleaner',            0.0015),
        con('Microfiber cloths',        0.03),
        con('Scrub pads',               0.01),
        con('Garbage bags',             0.03),
        con('Gloves (disposable)',      0.01),
      ],
    },

    // ── DOC 6 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'commercial_cleaning',
      subType:     'move_in_out',
      usageFactor: 'square_feet',
      items: [
        con('All-purpose cleaner',        0.0045),
        con('Floor scrubbing solution',   0.0055),
        con('Cabinet and drawer cleaner', 0.0025),
        con('Glass cleaner',              0.002),
        con('Stain remover solution',     0.0015),
        con('Microfiber cloths',          0.04),
        con('Scrub pads',                 0.02),
        con('Garbage bags',               0.05),
        con('Gloves (disposable)',        0.02),
      ],
    },

    // ── DOC 7 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'commercial_cleaning',
      subType:     'after_construction',
      usageFactor: 'square_feet',
      items: [
        con('Construction / cement dust remover',    0.006),
        con('All-purpose cleaner',                   0.0045),
        con('Floor scrubbing solution',              0.006),
        con('Paint stain remover',                   0.0025),
        con('Glass and window cleaner (heavy duty)', 0.0025),
        con('Surface polish',                        0.002),
        con('Microfiber cloths',                     0.05),
        con('Heavy-duty scrub pads',                 0.03),
        con('Garbage bags',                          0.06),
        con('Gloves (disposable)',                   0.02),
        con('Protective dust mask',                  0.01),
      ],
    },

    // ── DOC 8 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'floor_cleaning',
      subType:     'tile',
      usageFactor: 'square_feet',
      items: [
        con('Tile cleaner solution',  0.004),
        con('Grout cleaner',          0.002),
        con('Degreaser',              0.0015),
        con('Microfiber cloths',      0.02),
        con('Scrub pads',             0.01),
        con('Gloves (disposable)',    0.01),
      ],
    },

    // ── DOC 9 ──────────────────────────────────────────────────────────────────
    {
      serviceType: 'floor_cleaning',
      subType:     'hardwood',
      usageFactor: 'square_feet',
      items: [
        con('Wood-safe cleaning solution', 0.003),
        con('Wood polish / wax',           0.002),
        con('Soft microfiber cloths',      0.03),
        con('Gloves (disposable)',         0.01),
      ],
    },

    // ── DOC 10 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'floor_cleaning',
      subType:     'marble',
      usageFactor: 'square_feet',
      items: [
        con('Marble-safe cleaning solution', 0.003),
        con('Marble polishing compound',     0.0025),
        con('Marble sealer',                 0.002),
        con('Soft microfiber cloths',        0.03),
        con('Buffing pads',                  0.01),
        con('Gloves (disposable)',           0.01),
      ],
    },

    // ── DOC 11 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'floor_cut_polish',
      subType:     'standard',
      usageFactor: 'square_feet',
      items: [
        con('Diamond cutting pads',          0.01),
        con('High-speed polishing compound', 0.003),
        con('Crystallization chemical',      0.002),
        con('Buffing pads',                  0.01),
        con('Soft microfiber cloths',        0.02),
        con('Gloves (disposable)',           0.01),
        con('Protective goggles',            0.01),
      ],
    },

    // ── DOC 12 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'sofa_cleaning',
      subType:     'standard',
      usageFactor: 'seats',
      items: [
        con('Upholstery shampoo solution',    0.15),
        con('Stain remover spray',            0.05),
        con('Odor eliminator / deodorizer',   0.05),
        con('Microfiber cloths',              1),
        con('Gloves (disposable)',            0.5),
      ],
    },

    // ── DOC 13 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'single_top',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.1),
        con('Allergen treatment solution',  0.05),
        con('Microfiber cloths',            1),
        con('Gloves (disposable)',          0.5),
      ],
    },

    // ── DOC 14 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'single_full',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.15),
        con('Allergen treatment solution',  0.08),
        con('Microfiber cloths',            2),
        con('Gloves (disposable)',          1),
      ],
    },

    // ── DOC 15 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'double_top',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.15),
        con('Allergen treatment solution',  0.08),
        con('Microfiber cloths',            1),
        con('Gloves (disposable)',          0.5),
      ],
    },

    // ── DOC 16 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'double_full',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.2),
        con('Allergen treatment solution',  0.1),
        con('Microfiber cloths',            2),
        con('Gloves (disposable)',          1),
      ],
    },

    // ── DOC 17 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'queen_top',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.2),
        con('Allergen treatment solution',  0.1),
        con('Microfiber cloths',            2),
        con('Gloves (disposable)',          1),
      ],
    },

    // ── DOC 18 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'queen_full',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.3),
        con('Allergen treatment solution',  0.15),
        con('Microfiber cloths',            3),
        con('Gloves (disposable)',          1),
      ],
    },

    // ── DOC 19 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'king_top',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.25),
        con('Allergen treatment solution',  0.12),
        con('Microfiber cloths',            2),
        con('Gloves (disposable)',          1),
      ],
    },

    // ── DOC 20 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'mattress_cleaning',
      subType:     'king_full',
      usageFactor: 'mattress_size_type',
      items: [
        con('Upholstery sanitizer spray',   0.4),
        con('Allergen treatment solution',  0.2),
        con('Microfiber cloths',            3),
        con('Gloves (disposable)',          1),
      ],
    },

    // ── DOC 21 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'carpet_cleaning',
      subType:     'standard',
      usageFactor: 'square_feet',
      items: [
        con('Carpet shampoo solution',  0.005),
        con('Stain treatment spray',    0.002),
        con('Carpet deodorizer',        0.002),
        con('Microfiber cloths',        0.01),
        con('Gloves (disposable)',      0.01),
      ],
    },

    // ── DOC 22 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'curtain_cleaning',
      subType:     'dry_cleaning',
      usageFactor: 'curtains',
      items: [
        con('Dry cleaning solvent',       0.1),
        con('Stain remover (dry-safe)',   0.03),
        con('Protective pressing cloth',  1),
        con('Gloves (disposable)',        0.5),
      ],
    },

    // ── DOC 23 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'curtain_cleaning',
      subType:     'laundry',
      usageFactor: 'curtains',
      items: [
        con('Laundry detergent',    0.05),
        con('Fabric softener',      0.03),
        con('Gloves (disposable)',  0.5),
      ],
    },

    // ── DOC 24 ─────────────────────────────────────────────────────────────────
    {
      serviceType: 'curtain_cleaning',
      subType:     'premium',
      usageFactor: 'curtains',
      items: [
        con('Gentle fabric-safe cleaning solution', 0.08),
        con('Specialty stain treatment solution',   0.04),
        con('Laundry detergent',                    0.05),
        con('Fabric softener',                      0.03),
        con('Gloves (disposable)',                  0.5),
      ],
    },
  ];

  const consumptionRates = await ConsumptionRate.insertMany(rateDocs);
  return { consumptionRates };
};

const Counter = require('../models/Counter');

/**
 * Maps a service name to one of the 4 major categories: LND, CUR, SVC, HOC
 * @param {string} serviceName - The name of the service
 * @returns {string|null} - The category code or null if not found
 */
const getCategoryFromService = (serviceName) => {
    const name = serviceName.toLowerCase();

    // Laundry (LND)
    if (name.includes('laundry') || name.includes('wash') || name.includes('dry cleaning') || name.includes('pressing') || name.includes('ironing')) {
        // Special case: Curtain Cleaning also has "cleaning" or "laundry" in name sometimes, 
        // so we check curtains first or more specifically
        if (name.includes('curtain')) return 'CUR';
        return 'LND';
    }

    // Curtain Cleaning (CUR)
    if (name.includes('curtain')) {
        return 'CUR';
    }

    // Shampoo Vacuum Cleaning (SVC)
    if (name.includes('sofa') || name.includes('mattress') || name.includes('carpet')) {
        return 'SVC';
    }

    // Home/Office Cleaning (HOC)
    if (name.includes('house') || name.includes('office') || name.includes('general cleaning') || name.includes('deep cleaning') || name.includes('commercial') || name.includes('floor')) {
        return 'HOC';
    }

    return null;
};

/**
 * Determines the invoice prefix and unique categories for a list of service items
 * @param {Array} serviceItems - Array of service item objects { name, price }
 * @returns {Object} - { prefix, categories }
 */
const determineInvoiceDetails = (serviceItems) => {
    if (!serviceItems || serviceItems.length === 0) {
        return { prefix: 'GEN', categories: [] };
    }

    const categoriesSet = new Set();
    serviceItems.forEach(item => {
        const cat = getCategoryFromService(item.name);
        if (cat) categoriesSet.add(cat);
    });

    const categories = Array.from(categoriesSet);

    if (categories.length === 0) {
        return { prefix: 'GEN', categories: [] };
    }

    if (categories.length > 1) {
        return { prefix: 'MULTI', categories };
    }

    return { prefix: categories[0], categories };
};

/**
 * Generates a unique sequential invoice number
 * @param {string} prefix - The category prefix (LND, CUR, SVC, HOC, MULTI)
 * @returns {Promise<string>} - The formatted invoice number
 */
const generateInvoiceNumber = async (prefix) => {
    const sequenceName = 'invoiceNumber';
    const counter = await Counter.findOneAndUpdate(
        { name: sequenceName },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
    );

    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const sequenceStr = counter.value.toString().padStart(4, '0');

    return `${prefix}-${dateStr}-${sequenceStr}`;
};

module.exports = {
    getCategoryFromService,
    determineInvoiceDetails,
    generateInvoiceNumber
};

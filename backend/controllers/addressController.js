const User = require('../models/User');

const MAX_ADDRESSES = 5;

/** GET /api/addresses — list all addresses for the logged-in customer */
const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('addresses');
    res.status(200).json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve addresses' });
  }
};

/** POST /api/addresses — add a new address */
const addAddress = async (req, res) => {
  try {
    const { label, line1, city, phone, isDefault } = req.body;

    if (!label || !line1 || !city) {
      return res.status(400).json({ success: false, message: 'label, line1, and city are required' });
    }

    const user = await User.findById(req.user._id);

    if (user.addresses.length >= MAX_ADDRESSES) {
      return res.status(400).json({
        success: false,
        message: `You can save a maximum of ${MAX_ADDRESSES} addresses`,
      });
    }

    // If caller wants this as default (or it's the first address), clear all existing defaults first
    const makeDefault = isDefault || user.addresses.length === 0;
    if (makeDefault) {
      user.addresses.forEach((a) => { a.isDefault = false; });
    }

    user.addresses.push({ label, line1, city, phone, isDefault: makeDefault });
    await user.save();

    const added = user.addresses[user.addresses.length - 1];
    res.status(201).json({ success: true, data: added });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Failed to add address' });
  }
};

/** PUT /api/addresses/:addressId — update an existing address */
const updateAddress = async (req, res) => {
  try {
    const { label, line1, city, phone, isDefault } = req.body;

    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);

    if (!addr) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // When promoting to default, clear all others first
    if (isDefault === true) {
      user.addresses.forEach((a) => { a.isDefault = false; });
    }

    if (label     !== undefined) addr.label     = label;
    if (line1     !== undefined) addr.line1     = line1;
    if (city      !== undefined) addr.city      = city;
    if (phone     !== undefined) addr.phone     = phone;
    if (isDefault !== undefined) addr.isDefault = isDefault;

    await user.save();
    res.status(200).json({ success: true, data: addr });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
};

/** DELETE /api/addresses/:addressId — remove an address */
const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);

    if (!addr) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    const wasDefault = addr.isDefault;

    // pull() removes by _id from the DocumentArray
    user.addresses.pull(req.params.addressId);

    // Promote the next address to default so there's always one default when addresses remain
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.status(200).json({ success: true, message: 'Address deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
};

/** PATCH /api/addresses/:addressId/default — mark an address as the default */
const setDefault = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);

    if (!addr) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    user.addresses.forEach((a) => { a.isDefault = false; });
    addr.isDefault = true;

    await user.save();
    res.status(200).json({ success: true, data: user.addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to set default address' });
  }
};

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress, setDefault };

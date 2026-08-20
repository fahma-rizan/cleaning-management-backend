const tokenService = require('../services/tokenService');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = tokenService.verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -__v');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Access token expired'
      : 'Invalid access token';
    res.status(401).json({ success: false, message });
  }
};

const checkPasswordChange = (req, res, next) => {
  if (req.user && req.user.mustChangePassword) {
    return res.status(403).json({
      success: false,
      code: 'MUST_CHANGE_PASSWORD',
      message: 'You must change your password before continuing',
    });
  }
  next();
};

module.exports = { protect, checkPasswordChange };

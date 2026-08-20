const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const AUTH = require('../constants/auth');

const generateAccessToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: AUTH.JWT_ACCESS_EXPIRY,
  });

const generateRefreshToken = async (userId, ip) => {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + AUTH.REFRESH_TOKEN_DAYS);

  await RefreshToken.create({ userId, token, expiresAt, createdByIp: ip });
  return token;
};

const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

const rotateRefreshToken = async (oldToken, ip) => {
  const existing = await RefreshToken.findOne({ token: oldToken });
  if (!existing || existing.expiresAt < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }

  await RefreshToken.deleteOne({ _id: existing._id });
  const newToken = await generateRefreshToken(existing.userId, ip);
  return { userId: existing.userId, newToken };
};

const revokeAllUserTokens = async (userId) => {
  await RefreshToken.deleteMany({ userId });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  rotateRefreshToken,
  revokeAllUserTokens,
};

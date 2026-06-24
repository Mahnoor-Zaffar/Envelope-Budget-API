/**
 * JWT authentication middleware (optional — attaches req.user when valid).
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { STATUS } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-in-production';

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(STATUS.UNAUTHORIZED).json({ error: 'Authorization header with Bearer token is required.' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.sub);
    if (!user) {
      return res.status(STATUS.UNAUTHORIZED).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    return next();
  } catch (_err) {
    return res.status(STATUS.UNAUTHORIZED).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = {
  JWT_SECRET,
  signToken,
  authenticate,
};

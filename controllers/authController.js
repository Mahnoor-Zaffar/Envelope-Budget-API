/**
 * AuthController — register and login (JWT foundation for Part IV).
 */

const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { STATUS, ERRORS } = require('../config/constants');
const { sendError, handleSequelizeError } = require('../utils/controllerHelpers');
const { signToken } = require('../middleware/auth');

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_EMAIL);
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_PASSWORD);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email.trim().toLowerCase(), passwordHash });
    const token = signToken(user);

    return res.status(STATUS.CREATED).json({
      data: { user: formatUser(user), token },
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.DUPLICATE_EMAIL);
    }
    return handleSequelizeError(res, err);
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, STATUS.BAD_REQUEST, ERRORS.INVALID_CREDENTIALS);
    }

    const user = await User.unscoped().findOne({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return sendError(res, STATUS.UNAUTHORIZED, ERRORS.INVALID_CREDENTIALS);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return sendError(res, STATUS.UNAUTHORIZED, ERRORS.INVALID_CREDENTIALS);
    }

    const token = signToken(user);
    return res.status(STATUS.OK).json({
      data: { user: formatUser(user), token },
    });
  } catch (err) {
    return handleSequelizeError(res, err);
  }
}

async function me(req, res) {
  return res.status(STATUS.OK).json({ data: { user: formatUser(req.user) } });
}

module.exports = { register, login, me };

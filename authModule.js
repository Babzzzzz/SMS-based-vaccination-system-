'use strict';
const bcrypt      = require('bcryptjs');
const db          = require('../../config/db');
const { logAudit } = require('../../utils/audit');

// Login 
async function login(username, password, ip) {
  const [rows] = await db.execute(
    `SELECT u.userID, u.username, u.passwordHash, u.isActive,
            u.roleType, u.facility, r.permissions
     FROM user u
     JOIN user_role r ON u.roleID = r.roleID
     WHERE u.username = ?`,
    [username]
  );
  if (!rows.length) throw new Error('INVALID_CREDENTIALS');

  const user = rows[0];
  if (!user.isActive) throw new Error('ACCOUNT_INACTIVE');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  // Update lastLogin
  await db.execute(
    'UPDATE user SET lastLogin = NOW() WHERE userID = ?',
    [user.userID]
  );
  await logAudit(user.userID, `User logged in`, ip);

  // mysql2 auto-parses JSON columns into objects; older drivers return a
  // string. Handle both so we never call JSON.parse on an object.
  let permissions = user.permissions || {};
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch (_) { permissions = {}; }
  }

  return {
    userID:      user.userID,
    username:    user.username,
    roleType:    user.roleType,
    facility:    user.facility || null,
    permissions,
  };
}

//  Forgot password 
// No email is actually sent in this build; the request is recorded and a
// generic response is returned so we never disclose whether an account exists.
async function requestPasswordReset(identifier, ip) {
  let user = null;
  try {
    const [rows] = await db.execute(
      'SELECT userID FROM user WHERE username = ? OR email = ? LIMIT 1',
      [identifier, identifier]);
    user = rows[0] || null;
  } catch (_) {}
  await logAudit(user ? user.userID : 'SYSTEM',
    `Password reset requested for "${identifier}"`, ip);
  return { message: 'If the account exists, a reset link has been sent to the registered email.' };
}

//  Create user (Admin only) 
async function createUser(adminUserID, { username, password, roleType, facility = null, email = null }, ip) {
  const ROLE_MAP = {
    admin:    'role-admin',
    provider: 'role-provider',
    caregiver:'role-cg',
  };
  const roleID = ROLE_MAP[roleType];
  if (!roleID) throw new Error('INVALID_ROLE');
  if (!username || !password) throw new Error('MISSING_FIELDS');

  const hash = await bcrypt.hash(password, 10);
  await db.execute(
    `INSERT INTO user (userID, roleID, username, passwordHash, isActive, roleType, facility, email)
     VALUES (UUID(), ?, ?, ?, 1, ?, ?, ?)`,
    [roleID, username, hash, roleType, facility, email]
  );
  await logAudit(adminUserID, `Created user: ${username} (role: ${roleType})`, ip);
}

//  List users (Admin only) 
async function listUsers() {
  const [rows] = await db.execute(
    `SELECT userID, username, roleType, facility, email, isActive, lastLogin, createdAt
     FROM user
     ORDER BY roleType, username`
  );
  return rows;
}

//  Set account active flag (Admin only) 
async function setUserActive(adminUserID, targetUserID, active, ip) {
  const [rows] = await db.execute(
    'SELECT username FROM user WHERE userID = ?', [targetUserID]
  );
  if (!rows.length) throw new Error('USER_NOT_FOUND');

  await db.execute(
    'UPDATE user SET isActive = ? WHERE userID = ?', [active ? 1 : 0, targetUserID]
  );
  await logAudit(adminUserID,
    `${active ? 'Reactivated' : 'Deactivated'} user: ${rows[0].username}`, ip);
}

// Back-compat wrapper
async function deactivateUser(adminUserID, targetUserID, ip) {
  return setUserActive(adminUserID, targetUserID, false, ip);
}

//  Middleware: require login 
function requireLogin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Middleware: require specific role 
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.session.user.roleType)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  login, requestPasswordReset, createUser,
  listUsers, setUserActive, deactivateUser,
  requireLogin, requireRole,
};

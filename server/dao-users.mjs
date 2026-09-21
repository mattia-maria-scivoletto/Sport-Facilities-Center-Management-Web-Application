import db from './db.mjs';
import crypto from 'crypto';

// return user by id
const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, username, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak FROM users WHERE id = ?';
    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        resolve(null);
      } else {
        const user = {
          id: row.id,
          username: row.username,
          name: row.username.charAt(0).toUpperCase() + row.username.slice(1),
          score: row.score,
          secret: row.totp_secret,
          lastTotpStep: row.lastTotpStep,
          role: row.role || 'user',
          walletBalance: row.wallet_balance !== undefined ? row.wallet_balance : 500,
          bookingStreak: row.booking_streak !== undefined ? row.booking_streak : 0
        };
        resolve(user);
      }
    });
  });
};

// return user by username and verify password
const getUser = (username, password) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        resolve(false);
      } else {
        const user = {
          id: row.id,
          username: row.username,
          name: row.username.charAt(0).toUpperCase() + row.username.slice(1),
          score: row.score,
          secret: row.totp_secret,
          lastTotpStep: row.lastTotpStep,
          role: row.role || 'user',
          walletBalance: row.wallet_balance !== undefined ? row.wallet_balance : 500,
          bookingStreak: row.booking_streak !== undefined ? row.booking_streak : 0
        };

        crypto.scrypt(password, row.salt, 32, function (err, hashedPassword) {
          if (err) return reject(err);
          if (!crypto.timingSafeEqual(Buffer.from(row.password_hash, 'hex'), hashedPassword)) {
            resolve(false);
          } else {
            resolve(user);
          }
        });
      }
    });
  });
};

// update last TOTP step
const updateLastTotpStep = (userId, lastTotpStep) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET lastTotpStep = ? WHERE id = ?';
    db.run(sql, [lastTotpStep, userId], function (err) {
      if (err) {
        reject(err);
      } else if (this.changes !== 1) {
        resolve({ error: 'User not found.' });
      } else {
        resolve(this.changes);
      }
    });
  });
};

// reset user score to 0 on successful 2FA (TOTP)
const resetUserScoreToZero = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET score = 0 WHERE id = ?';
    db.run(sql, [userId], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ success: true, changes: this.changes });
      }
    });
  });
};

// decrease user score by 1 when deleting a reservation
const decreaseUserScore = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET score = score - 1 WHERE id = ?';
    db.run(sql, [userId], function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ success: true, changes: this.changes });
      }
    });
  });
};

// get current score of a user
const getUserScore = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT score FROM users WHERE id = ?';
    db.get(sql, [userId], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        resolve({ score: 0 });
      } else {
        resolve({ score: row.score });
      }
    });
  });
};

// get user by username
const getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, username, score, totp_secret, lastTotpStep, wallet_balance, booking_streak FROM users WHERE LOWER(username) = LOWER(?)';
    db.get(sql, [username], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        resolve(null);
      } else {
        resolve(row);
      }
    });
  });
};

// create new user
const createUser = (username, password, role = 'user') => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 32, (err, hashedPassword) => {
      if (err) return reject(err);
      const passwordHash = hashedPassword.toString('hex');
      const sql =
        'INSERT INTO users (username, password_hash, salt, score, totp_secret, lastTotpStep, role, wallet_balance, booking_streak) VALUES (?, ?, ?, 0, ?, 0, ?, 500, 0)';
      db.run(sql, [username.trim(), passwordHash, salt, 'LXBSMDTMSP2I5XFXIYRGFVWSFI', role], function (dbErr) {
        if (dbErr) return reject(dbErr);
        const newUserId = this.lastID;
        // insert initial welcome credit transaction
        const txSql = "INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, 500, 'recharge', 'Welcome bonus credit allocation')";
        db.run(txSql, [newUserId], () => {});

        resolve({
          id: newUserId,
          username: username.trim(),
          name: username.trim().charAt(0).toUpperCase() + username.trim().slice(1),
          score: 0,
          role: role,
          walletBalance: 500,
          bookingStreak: 0
        });
      });
    });
  });
};

// get all registered users for admin dashboard
const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT u.id, u.username, u.score, u.role, u.lastTotpStep, u.wallet_balance, u.booking_streak,
             COUNT(r.id) as reservationCount
      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id
      GROUP BY u.id
      ORDER BY u.id ASC
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      const users = (rows || []).map((r) => ({
        id: r.id,
        username: r.username,
        name: r.username.charAt(0).toUpperCase() + r.username.slice(1),
        score: r.score,
        role: r.role || 'user',
        isTotp: r.lastTotpStep > 0,
        reservationCount: r.reservationCount || 0,
        walletBalance: r.wallet_balance !== undefined ? r.wallet_balance : 500,
        bookingStreak: r.booking_streak !== undefined ? r.booking_streak : 0
      }));
      resolve(users);
    });
  });
};

// update password for a logged in user
const updatePassword = (userId, oldPassword, newPassword) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.get(sql, [userId], (err, row) => {
      if (err) {
        return reject(err);
      }
      if (!row) {
        return resolve({ success: false, error: 'User not found' });
      }

      // Verify old password
      crypto.scrypt(oldPassword, row.salt, 32, (scryptErr, oldHashedPassword) => {
        if (scryptErr) return reject(scryptErr);
        if (!crypto.timingSafeEqual(Buffer.from(row.password_hash, 'hex'), oldHashedPassword)) {
          return resolve({ success: false, error: 'Current password is incorrect' });
        }

        // Generate new salt and hash new password
        const newSalt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(newPassword, newSalt, 32, (newScryptErr, newHashedPassword) => {
          if (newScryptErr) return reject(newScryptErr);
          const newPasswordHash = newHashedPassword.toString('hex');
          const updateSql = 'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?';
          db.run(updateSql, [newPasswordHash, newSalt, userId], function (updateErr) {
            if (updateErr) return reject(updateErr);
            resolve({ success: true });
          });
        });
      });
    });
  });
};

// update user role (admin only)
const updateUserRole = (userId, newRole) => {
  return new Promise((resolve, reject) => {
    const validRoles = ['user', 'admin', 'staff'];
    if (!validRoles.includes(newRole)) {
      return reject(new Error('Invalid role'));
    }
    const sql = 'UPDATE users SET role = ? WHERE id = ?';
    db.run(sql, [newRole, userId], function (err) {
      if (err) return reject(err);
      resolve({ updated: this.changes > 0, userId, role: newRole });
    });
  });
};

export default {
  getUserById,
  getUser,
  getUserByUsername,
  createUser,
  getAllUsers,
  updatePassword,
  updateLastTotpStep,
  resetUserScoreToZero,
  decreaseUserScore,
  getUserScore,
  updateUserRole
};
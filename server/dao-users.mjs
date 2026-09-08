import db from './db.mjs';
import crypto from 'crypto';

// return user by id
const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, username, score, totp_secret, lastTotpStep FROM users WHERE id = ?';
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
          lastTotpStep: row.lastTotpStep
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
          lastTotpStep: row.lastTotpStep
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

export default {
  getUserById,
  getUser,
  updateLastTotpStep,
  resetUserScoreToZero,
  decreaseUserScore,
  getUserScore
};
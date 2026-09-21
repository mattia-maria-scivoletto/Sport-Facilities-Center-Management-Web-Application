import db from './db.mjs';

// Get current wallet balance and streak for a user
export const getUserWallet = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, username, score, wallet_balance AS walletBalance, booking_streak AS bookingStreak FROM users WHERE id = ?';
    db.get(sql, [userId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve({
        userId: row.id,
        username: row.username,
        score: row.score,
        walletBalance: row.walletBalance,
        bookingStreak: row.bookingStreak
      });
    });
  });
};

// Calculate pricing breakdown for a booking
export const calculateBookingCost = async (facilityTypeId, equipments = []) => {
  return new Promise((resolve, reject) => {
    const sqlFacility = 'SELECT id, name, base_price AS basePrice FROM facility_types WHERE id = ?';
    db.get(sqlFacility, [facilityTypeId], (err, facility) => {
      if (err) return reject(err);
      if (!facility) return reject(new Error(`Facility type ${facilityTypeId} not found`));

      const basePrice = facility.basePrice || 0;

      if (!equipments || equipments.length === 0) {
        return resolve({
          facilityTypeId,
          facilityName: facility.name,
          basePrice,
          equipmentCost: 0,
          totalCost: basePrice,
          breakdown: []
        });
      }

      const sqlEquip = 'SELECT id, name, unit_price AS unitPrice FROM equipment_types';
      db.all(sqlEquip, [], (err2, eqRows) => {
        if (err2) return reject(err2);

        const priceMap = new Map();
        for (const row of eqRows) {
          priceMap.set(row.id, { name: row.name, unitPrice: row.unitPrice });
        }

        let equipmentCost = 0;
        const breakdown = [];

        for (const eq of equipments) {
          const qty = parseInt(eq.quantity, 10) || 0;
          if (qty > 0) {
            const eqInfo = priceMap.get(eq.equipmentTypeId) || { name: eq.equipmentTypeId, unitPrice: 2 };
            const subtotal = qty * eqInfo.unitPrice;
            equipmentCost += subtotal;
            breakdown.push({
              equipmentTypeId: eq.equipmentTypeId,
              equipmentName: eqInfo.name,
              quantity: qty,
              unitPrice: eqInfo.unitPrice,
              subtotal
            });
          }
        }

        resolve({
          facilityTypeId,
          facilityName: facility.name,
          basePrice,
          equipmentCost,
          totalCost: basePrice + equipmentCost,
          breakdown
        });
      });
    });
  });
};

// Recharge mock credits
export const rechargeWallet = (userId, amount) => {
  return new Promise((resolve, reject) => {
    if (typeof amount !== 'number' || amount <= 0) {
      return reject(new Error('Invalid recharge amount'));
    }

    db.serialize(() => {
      const updateSql = 'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?';
      db.run(updateSql, [amount, userId], function (err) {
        if (err) return reject(err);

        const txSql = `
          INSERT INTO wallet_transactions (user_id, amount, type, description)
          VALUES (?, ?, 'recharge', ?)
        `;
        const description = `Mock credit recharge (+${amount} credits)`;
        db.run(txSql, [userId, amount, description], function (txErr) {
          if (txErr) return reject(txErr);

          db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId], (selErr, row) => {
            if (selErr) return reject(selErr);
            resolve({
              success: true,
              amountAdded: amount,
              newBalance: row.wallet_balance
            });
          });
        });
      });
    });
  });
};

// Deduct credits for booking
export const deductCredits = (userId, amount, description, type = 'booking_payment') => {
  return new Promise((resolve, reject) => {
    if (amount <= 0) {
      return resolve({ success: true, deducted: 0 });
    }

    db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('User not found'));
      if (row.wallet_balance < amount) {
        const error = new Error(`Insufficient credits. Required: ${amount}, available: ${row.wallet_balance}`);
        error.code = 'INSUFFICIENT_CREDITS';
        error.required = amount;
        error.available = row.wallet_balance;
        return reject(error);
      }

      db.serialize(() => {
        const updateSql = 'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?';
        db.run(updateSql, [amount, userId], (upErr) => {
          if (upErr) return reject(upErr);

          const txSql = `
            INSERT INTO wallet_transactions (user_id, amount, type, description)
            VALUES (?, ?, ?, ?)
          `;
          db.run(txSql, [userId, -amount, type, description], (txErr) => {
            if (txErr) return reject(txErr);
            resolve({
              success: true,
              deducted: amount,
              newBalance: row.wallet_balance - amount
            });
          });
        });
      });
    });
  });
};

// Refund credits upon booking cancellation or downgrade
export const refundCredits = (userId, amount, description, type = 'booking_refund') => {
  return new Promise((resolve, reject) => {
    if (amount <= 0) {
      return resolve({ success: true, refunded: 0 });
    }

    db.serialize(() => {
      const updateSql = 'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?';
      db.run(updateSql, [amount, userId], (upErr) => {
        if (upErr) return reject(upErr);

        const txSql = `
          INSERT INTO wallet_transactions (user_id, amount, type, description)
          VALUES (?, ?, ?, ?)
        `;
        db.run(txSql, [userId, amount, type, description], (txErr) => {
          if (txErr) return reject(txErr);

          db.get('SELECT wallet_balance FROM users WHERE id = ?', [userId], (selErr, row) => {
            if (selErr) return reject(selErr);
            resolve({
              success: true,
              refunded: amount,
              newBalance: row.wallet_balance
            });
          });
        });
      });
    });
  });
};

// Increment consecutive booking streak & reward milestone bonus
export const incrementBookingStreak = (userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const sqlStreak = 'UPDATE users SET booking_streak = booking_streak + 1 WHERE id = ?';
      db.run(sqlStreak, [userId], function (err) {
        if (err) return reject(err);

        db.get('SELECT booking_streak, wallet_balance FROM users WHERE id = ?', [userId], (selErr, row) => {
          if (selErr) return reject(selErr);
          const streak = row.booking_streak;

          // Milestone bonus: Every 3 consecutive bookings gives +15 credits
          const isMilestone = streak > 0 && streak % 3 === 0;
          if (isMilestone) {
            const bonusAmount = 15;
            const updateBonusSql = 'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?';
            db.run(updateBonusSql, [bonusAmount, userId], (bErr) => {
              if (bErr) return reject(bErr);

              const txSql = `
                INSERT INTO wallet_transactions (user_id, amount, type, description)
                VALUES (?, ?, 'streak_bonus', ?)
              `;
              const desc = `🌟 Reliable Player streak milestone bonus (+${bonusAmount} credits for ${streak} consecutive bookings!)`;
              db.run(txSql, [userId, bonusAmount, desc], (txErr) => {
                if (txErr) return reject(txErr);
                resolve({
                  streak,
                  bonusAwarded: bonusAmount,
                  newBalance: row.wallet_balance + bonusAmount
                });
              });
            });
          } else {
            resolve({
              streak,
              bonusAwarded: 0,
              newBalance: row.wallet_balance
            });
          }
        });
      });
    });
  });
};

// Reset booking streak to 0 upon cancellation
export const resetBookingStreak = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET booking_streak = 0 WHERE id = ?';
    db.run(sql, [userId], function (err) {
      if (err) return reject(err);
      resolve({ streak: 0 });
    });
  });
};

// Get transaction history
export const getWalletTransactions = (userId, limit = 50) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT id, amount, type, description, created_at AS createdAt
      FROM wallet_transactions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `;
    db.all(sql, [userId, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

// Dynamic badges based on user stats
export const getGamificationBadges = (walletBalance, bookingStreak, score, totalReservations = 0) => {
  const badges = [
    {
      id: 'reliable_player',
      title: 'Reliable Player',
      icon: '🔥',
      unlocked: bookingStreak >= 3,
      criteria: 'Reach a streak of 3+ bookings without cancellations',
      progress: `${Math.min(bookingStreak, 3)}/3 bookings`
    },
    {
      id: 'fair_play',
      title: 'Fair Play Champion',
      icon: '🛡️',
      unlocked: score === 0 && totalReservations >= 1,
      criteria: 'Maintain a 0 penalty score with active reservations',
      progress: score === 0 ? 'Flawless (score: 0)' : `Penalty (score: ${score})`
    },
    {
      id: 'vip_enthusiast',
      title: 'VIP Sport Enthusiast',
      icon: '💎',
      unlocked: walletBalance >= 100,
      criteria: 'Maintain a wallet balance of 100+ credits',
      progress: `${walletBalance}/100 credits`
    },
    {
      id: 'veteran_athlete',
      title: 'Veteran Athlete',
      icon: '🎖️',
      unlocked: totalReservations >= 4,
      criteria: 'Complete 4 or more reservations at the sports center',
      progress: `${totalReservations}/4 bookings`
    },
    {
      id: 'active_member',
      title: 'Active Member',
      icon: '⚡',
      unlocked: totalReservations >= 1 || bookingStreak >= 1,
      criteria: 'Book your first facility reservation',
      progress: totalReservations >= 1 ? 'Unlocked' : '0/1 bookings'
    }
  ];

  return badges;
};

export default {
  getUserWallet,
  calculateBookingCost,
  rechargeWallet,
  deductCredits,
  refundCredits,
  incrementBookingStreak,
  resetBookingStreak,
  getWalletTransactions,
  getGamificationBadges
};

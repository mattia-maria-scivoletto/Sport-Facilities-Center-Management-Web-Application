import db from './db.mjs';

// get all reservations for a given user
// including structured equipment lists
const getUserReservations = (userId) => {
  return new Promise((resolve, reject) => {
    const sqlReservations = `
      SELECT 
        r.id AS reservationId,
        r.facility_id AS facilityId,
        f.name AS facilityName,
        f.facility_type_id AS facilityTypeId,
        ft.name AS typeName
      FROM reservations r
      JOIN facilities f ON f.id = r.facility_id
      JOIN facility_types ft ON ft.id = f.facility_type_id
      WHERE r.user_id = ?
      ORDER BY r.id DESC;
    `;

    const sqlEquipments = `
      SELECT 
        re.reservation_id AS reservationId,
        re.equipment_type_id AS equipmentTypeId,
        eq.name AS equipmentName,
        re.quantity AS quantity,
        COALESCE(fer.min_quantity, 0) AS minQuantity
      FROM reservation_equipment re
      JOIN equipment_types eq ON eq.id = re.equipment_type_id
      JOIN reservations r ON r.id = re.reservation_id
      JOIN facilities f ON f.id = r.facility_id
      LEFT JOIN facility_equipment_rules fer 
        ON fer.facility_type_id = f.facility_type_id AND fer.equipment_type_id = re.equipment_type_id
      WHERE r.user_id = ?
      ORDER BY re.reservation_id, fer.min_quantity DESC, eq.name;
    `;

    db.all(sqlReservations, [userId], (err, resRows) => {
      if (err) return reject(err);

      db.all(sqlEquipments, [userId], (err2, eqRows) => {
        if (err2) return reject(err2);

        const reservations = resRows.map((r) => {
          const equipments = eqRows
            .filter((eq) => eq.reservationId === r.reservationId)
            .map((eq) => ({
              equipmentTypeId: eq.equipmentTypeId,
              equipmentName: eq.equipmentName,
              quantity: eq.quantity,
              minQuantity: eq.minQuantity,
              isMandatory: eq.minQuantity > 0
            }));

          return {
            ...r,
            equipments
          };
        });

        resolve(reservations);
      });
    });
  });
};

// check if user is in 30-second cooldown
// window for a facility type
const checkCooldownConstraint = (userId, facilityTypeId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT released_at,
                (strftime('%s', 'now') - strftime('%s', released_at)) AS elapsed_seconds
                FROM facility_release_logs 
                WHERE user_id = ? 
                AND facility_type_id = ?;`;
    db.get(sql, [userId, facilityTypeId], (err, row) => {
      if (err) return reject(err);
      if (!row) {
        return resolve({ inCooldown: false, remainingSeconds: 0 });
      }
      const elapsed = row.elapsed_seconds;
      if (elapsed !== null && elapsed < 30) {
        const remaining = 30 - elapsed;
        return resolve({ inCooldown: true, remainingSeconds: remaining > 0 ? remaining : 1 });
      }
      resolve({ inCooldown: false, remainingSeconds: 0 });
    });
  });
};

// record or update timestamp when
// a user cancels a reservation
const recordCooldownTimestamp = (userId, facilityTypeId) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO facility_release_logs (user_id, facility_type_id, released_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, facility_type_id) 
                DO UPDATE SET released_at = CURRENT_TIMESTAMP;`;
    db.run(sql, [userId, facilityTypeId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

// create a new reservation and all associated equipment entries
const createReservation = (userId, facilityId, equipments) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const sqlRes = 'INSERT INTO reservations (user_id, facility_id) VALUES (?, ?);';
      db.run(sqlRes, [userId, facilityId], function (err) {
        if (err) return reject(err);
        const reservationId = this.lastID;

        if (!equipments || equipments.length === 0) {
          return resolve({ id: reservationId });
        }

        const sqlEq = 'INSERT INTO reservation_equipment (reservation_id, equipment_type_id, quantity) VALUES (?, ?, ?);';
        const stmt = db.prepare(sqlEq);
        let errorOccurred = null;

        for (const item of equipments) {
          if (item.quantity > 0) {
            stmt.run(reservationId, item.equipmentTypeId, item.quantity, (stmtErr) => {
              if (stmtErr) errorOccurred = stmtErr;
            });
          }
        }

        stmt.finalize((finalizeErr) => {
          if (finalizeErr || errorOccurred) {
            reject(finalizeErr || errorOccurred);
          } else {
            resolve({ id: reservationId });
          }
        });
      });
    });
  });
};

// verify reservation ownership
const verifyReservationOwnership = (reservationId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT r.id, r.user_id, r.facility_id, f.facility_type_id, f.name AS facilityName
                FROM reservations r
                JOIN facilities f ON f.id = r.facility_id
                WHERE r.id = ?;`;
    db.get(sql, [reservationId], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

// get equipments reserved for a single reservation
const getReservedEquipmentsbyReservation = (reservationId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT equipment_type_id AS equipmentTypeId, quantity
                FROM reservation_equipment
                WHERE reservation_id = ?;`;
    db.all(sql, [reservationId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// replace equipment quantities for an existing reservation
const updateReservationEquipments = (reservationId, equipments) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const deleteSql = 'DELETE FROM reservation_equipment WHERE reservation_id = ?;';
      db.run(deleteSql, [reservationId], (delErr) => {
        if (delErr) return reject(delErr);

        if (!equipments || equipments.length === 0) {
          return resolve({ success: true });
        }

        const insertSql = 'INSERT INTO reservation_equipment (reservation_id, equipment_type_id, quantity) VALUES (?, ?, ?);';
        const stmt = db.prepare(insertSql);
        let errorOccurred = null;

        for (const item of equipments) {
          if (item.quantity > 0) {
            stmt.run(reservationId, item.equipmentTypeId, item.quantity, (stmtErr) => {
              if (stmtErr) errorOccurred = stmtErr;
            });
          }
        }

        stmt.finalize((finErr) => {
          if (finErr || errorOccurred) {
            reject(finErr || errorOccurred);
          } else {
            resolve({ success: true });
          }
        });
      });
    });
  });
};

// delete reservation and related equipments on cascade
const deleteReservationAndRelatedEquipments = (reservationId) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM reservations WHERE id = ?;';
    db.run(sql, [reservationId], function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
};

export default {
  getUserReservations,
  checkCooldownConstraint,
  recordCooldownTimestamp,
  createReservation,
  verifyReservationOwnership,
  getReservedEquipmentsbyReservation,
  updateReservationEquipments,
  deleteReservationAndRelatedEquipments,
};
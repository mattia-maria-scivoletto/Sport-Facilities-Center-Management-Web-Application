import db from './db.mjs';

// get all reservations for a given user including date, time slots, and equipment
const getUserReservations = (userId) => {
  return new Promise((resolve, reject) => {
    const sqlReservations = `
      SELECT 
        r.id AS reservationId,
        r.facility_id AS facilityId,
        r.booking_date AS bookingDate,
        r.start_time AS startTime,
        r.end_time AS endTime,
        r.total_cost AS totalCost,
        f.name AS facilityName,
        f.facility_type_id AS facilityTypeId,
        ft.name AS typeName,
        ft.base_price AS basePrice
      FROM reservations r
      JOIN facilities f ON f.id = r.facility_id
      JOIN facility_types ft ON ft.id = f.facility_type_id
      WHERE r.user_id = ?
      ORDER BY r.booking_date DESC, r.start_time DESC, r.id DESC;
    `;

    const sqlEquipments = `
      SELECT 
        re.reservation_id AS reservationId,
        re.equipment_type_id AS equipmentTypeId,
        eq.name AS equipmentName,
        eq.unit_price AS unitPrice,
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
              unitPrice: eq.unitPrice,
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

// check if user is in 30-second cooldown window for a facility type
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

// record or update timestamp when a user cancels a reservation
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

// check court collision for date and time slot
const checkCourtCollision = (facilityId, bookingDate, startTime, excludeReservationId = null) => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT id FROM reservations WHERE facility_id = ? AND booking_date = ? AND start_time = ?';
    const params = [facilityId, bookingDate, startTime];
    if (excludeReservationId) {
      sql += ' AND id != ?';
      params.push(excludeReservationId);
    }
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });
};

// create a new reservation with date, time slots, equipment, and totalCost
const createReservation = (userId, facilityId, bookingDate, startTime, endTime, equipments, totalCost = 0) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const sqlRes = `INSERT INTO reservations (user_id, facility_id, booking_date, start_time, end_time, total_cost) 
                      VALUES (?, ?, ?, ?, ?, ?);`;
      db.run(sqlRes, [userId, facilityId, bookingDate, startTime, endTime, totalCost], function (err) {
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

// verify reservation ownership and retrieve details
const verifyReservationOwnership = (reservationId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT r.id, r.user_id, r.facility_id, r.booking_date AS bookingDate, 
                        r.start_time AS startTime, r.end_time AS endTime, r.total_cost AS totalCost,
                        f.facility_type_id, f.name AS facilityName, ft.name AS typeName, ft.base_price AS basePrice
                FROM reservations r
                JOIN facilities f ON f.id = r.facility_id
                JOIN facility_types ft ON ft.id = f.facility_type_id
                WHERE r.id = ?;`;
    db.get(sql, [reservationId], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

// get schedule matrix for interactive calendar
const getScheduleMatrix = (startDate, endDate, facilityTypeId) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        r.id AS reservationId,
        r.user_id AS userId,
        r.facility_id AS facilityId,
        r.booking_date AS bookingDate,
        r.start_time AS startTime,
        r.end_time AS endTime,
        f.name AS facilityName,
        f.facility_type_id AS facilityTypeId,
        ft.name AS typeName,
        u.username AS bookedByUsername
      FROM reservations r
      JOIN facilities f ON f.id = r.facility_id
      JOIN facility_types ft ON ft.id = f.facility_type_id
      JOIN users u ON u.id = r.user_id
      WHERE r.booking_date >= ? AND r.booking_date <= ?
    `;
    const params = [startDate, endDate];
    if (facilityTypeId) {
      sql += ' AND f.facility_type_id = ?';
      params.push(facilityTypeId);
    }
    sql += ' ORDER BY r.booking_date, r.start_time, f.id;';

    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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

// update full reservation details (date, time slot, facility) and equipment
const updateReservation = (reservationId, facilityId, bookingDate, startTime, endTime, equipments, totalCost = null) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const sqlRes = totalCost !== null
        ? `UPDATE reservations 
           SET facility_id = ?, booking_date = ?, start_time = ?, end_time = ?, total_cost = ?
           WHERE id = ?;`
        : `UPDATE reservations 
           SET facility_id = ?, booking_date = ?, start_time = ?, end_time = ?
           WHERE id = ?;`;
      const params = totalCost !== null
        ? [facilityId, bookingDate, startTime, endTime, totalCost, reservationId]
        : [facilityId, bookingDate, startTime, endTime, reservationId];

      db.run(sqlRes, params, function (err) {
        if (err) return reject(err);

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

// get admin operational analytics and insights
const getAdminAnalytics = () => {
  return new Promise((resolve, reject) => {
    // 1. KPI Counts
    const kpiSql = `
      SELECT 
        (SELECT COUNT(*) FROM reservations) AS totalReservations,
        (SELECT COUNT(*) FROM reservations WHERE booking_date >= date('now')) AS activeReservations,
        (SELECT COUNT(*) FROM facility_release_logs) AS totalCancellations,
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM users WHERE score < 0) AS totalPenalizedUsers,
        (SELECT COUNT(*) FROM facilities) AS totalFacilities,
        (SELECT COUNT(*) FROM facilities WHERE is_maintenance = 1) AS maintenanceFacilities;
    `;

    // 2. Discipline Popularity
    const disciplineSql = `
      SELECT 
        ft.id AS typeId,
        ft.name AS typeName,
        COUNT(r.id) AS bookingCount
      FROM facility_types ft
      LEFT JOIN facilities f ON f.facility_type_id = ft.id
      LEFT JOIN reservations r ON r.facility_id = f.id
      GROUP BY ft.id, ft.name
      ORDER BY bookingCount DESC, ft.name;
    `;

    // 3. Hourly utilization across the 14 time slots
    const hourlySql = `
      SELECT 
        r.start_time AS startTime,
        COUNT(r.id) AS bookingCount
      FROM reservations r
      GROUP BY r.start_time
      ORDER BY r.start_time;
    `;

    // 4. Facility utilization
    const facilitySql = `
      SELECT 
        f.id AS facilityId,
        f.name AS facilityName,
        ft.name AS typeName,
        f.is_maintenance AS isMaintenance,
        f.maintenance_reason AS maintenanceReason,
        COUNT(r.id) AS bookingCount
      FROM facilities f
      JOIN facility_types ft ON ft.id = f.facility_type_id
      LEFT JOIN reservations r ON r.facility_id = f.id
      GROUP BY f.id, f.name, ft.name, f.is_maintenance, f.maintenance_reason
      ORDER BY bookingCount DESC, f.id;
    `;

    // 5. Recent cancellations & release logs
    const cancellationsSql = `
      SELECT 
        frl.id,
        u.username,
        u.score AS currentScore,
        frl.facility_type_id AS facilityTypeId,
        ft.name AS typeName,
        frl.released_at AS releasedAt
      FROM facility_release_logs frl
      JOIN users u ON u.id = frl.user_id
      JOIN facility_types ft ON ft.id = frl.facility_type_id
      ORDER BY frl.released_at DESC
      LIMIT 10;
    `;

    // 6. Equipment utilization summary
    const equipmentSql = `
      SELECT 
        eq.id,
        eq.name,
        eq.total_quantity AS totalQuantity,
        COALESCE(SUM(re.quantity), 0) AS totalUnitsRented
      FROM equipment_types eq
      LEFT JOIN reservation_equipment re ON re.equipment_type_id = eq.id
      GROUP BY eq.id, eq.name, eq.total_quantity
      ORDER BY totalUnitsRented DESC, eq.id;
    `;

    db.get(kpiSql, [], (err, kpis) => {
      if (err) return reject(err);

      db.all(disciplineSql, [], (err2, disciplines) => {
        if (err2) return reject(err2);

        db.all(hourlySql, [], (err3, hourlyRows) => {
          if (err3) return reject(err3);

          db.all(facilitySql, [], (err4, facilityRows) => {
            if (err4) return reject(err4);

            db.all(cancellationsSql, [], (err5, cancelRows) => {
              if (err5) return reject(err5);

              db.all(equipmentSql, [], (err6, equipmentRows) => {
                if (err6) return reject(err6);

                const totalResCount = kpis.totalReservations || 1;
                const disciplinePopularity = disciplines.map((d) => ({
                  ...d,
                  percentage: Math.round((d.bookingCount / (totalResCount || 1)) * 100)
                }));

                const allHourlySlots = [
                  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
                  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
                ];
                const hourlyMap = new Map();
                for (const row of hourlyRows) {
                  hourlyMap.set(row.startTime, row.bookingCount);
                }
                const hourlyUtilization = allHourlySlots.map((slot) => {
                  const [h] = slot.split(':').map(Number);
                  const nextH = String(h + 1).padStart(2, '0');
                  const count = hourlyMap.get(slot) || 0;
                  return {
                    slot,
                    label: `${slot} - ${nextH}:00`,
                    bookingCount: count
                  };
                });

                resolve({
                  kpis,
                  disciplinePopularity,
                  hourlyUtilization,
                  facilityUtilization: facilityRows,
                  recentCancellations: cancelRows,
                  equipmentUtilization: equipmentRows
                });
              });
            });
          });
        });
      });
    });
  });
};

export default {
  getUserReservations,
  checkCooldownConstraint,
  recordCooldownTimestamp,
  checkCourtCollision,
  createReservation,
  verifyReservationOwnership,
  getScheduleMatrix,
  getReservedEquipmentsbyReservation,
  updateReservationEquipments,
  updateReservation,
  deleteReservationAndRelatedEquipments,
  getAdminAnalytics,
};
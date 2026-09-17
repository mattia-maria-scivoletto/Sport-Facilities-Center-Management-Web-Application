import db from './db.mjs';

const resolveDate = (date) => date || new Date().toISOString().split('T')[0];
const resolveTime = (time) => time || '10:00';

// get public overview of facilities and equipment for a given date and time slot
const getPublicAvailability = (bookingDate, startTime) => {
  const date = resolveDate(bookingDate);
  const time = resolveTime(startTime);

  return new Promise((resolve, reject) => {
    const sqlFacilities = `
      SELECT 
        f.id AS code,
        f.facility_type_id AS typeId,
        ft.name AS typeName,
        CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS isBooked
      FROM facilities f
      JOIN facility_types ft ON f.facility_type_id = ft.id
      LEFT JOIN reservations r ON r.facility_id = f.id AND r.booking_date = ? AND r.start_time = ?
      ORDER BY f.facility_type_id, f.id;
    `;

    const sqlEquipment = `
      SELECT 
        eq.id AS id,
        eq.name AS name,
        eq.total_quantity AS totalQuantity,
        eq.total_quantity - COALESCE(SUM(re.quantity), 0) AS availableQuantity
      FROM equipment_types eq
      LEFT JOIN (
        SELECT re.equipment_type_id, re.quantity
        FROM reservation_equipment re
        JOIN reservations r ON r.id = re.reservation_id
        WHERE r.booking_date = ? AND r.start_time = ?
      ) re ON re.equipment_type_id = eq.id
      GROUP BY eq.id, eq.name, eq.total_quantity
      ORDER BY eq.id;
    `;

    db.all(sqlFacilities, [date, time], (err, facilityRows) => {
      if (err) return reject(err);

      db.all(sqlEquipment, [date, time], (err2, equipmentRows) => {
        if (err2) return reject(err2);

        const facilitiesMap = new Map();
        for (const row of facilityRows) {
          if (!facilitiesMap.has(row.typeId)) {
            facilitiesMap.set(row.typeId, {
              typeId: row.typeId,
              typeName: row.typeName,
              totalCount: 0,
              availableCount: 0,
              facilityCodes: []
            });
          }
          const group = facilitiesMap.get(row.typeId);
          group.totalCount += 1;
          const isBooked = row.isBooked === 1;
          if (!isBooked) {
            group.availableCount += 1;
          }
          group.facilityCodes.push({
            code: row.code,
            isBooked: isBooked
          });
        }

        const facilities = Array.from(facilitiesMap.values());
        resolve({
          selectedDate: date,
          selectedTimeSlot: time,
          facilities,
          equipment: equipmentRows
        });
      });
    });
  });
};

// get list of all individual facilities with booking status for a date and time slot
const getAllFacilities = (bookingDate, startTime) => {
  const date = resolveDate(bookingDate);
  const time = resolveTime(startTime);

  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        f.id AS id,
        f.facility_type_id AS facilityTypeId,
        f.name AS name,
        ft.name AS typeName,
        CASE WHEN r.id IS NOT NULL THEN 0 ELSE 1 END AS isAvailable
      FROM facilities f
      JOIN facility_types ft ON f.facility_type_id = ft.id
      LEFT JOIN reservations r ON r.facility_id = f.id AND r.booking_date = ? AND r.start_time = ?
      ORDER BY f.facility_type_id, f.id;
    `;
    db.all(sql, [date, time], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// get all facility types
const getAllFacilityTypes = () => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, name FROM facility_types ORDER BY name;';
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// get equipment rules and current stock for a facility type and slot
const getFacilityEquipmentRules = (facilityTypeId, bookingDate, startTime, excludeReservationId = null) => {
  const date = resolveDate(bookingDate);
  const time = resolveTime(startTime);

  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        fer.equipment_type_id AS equipmentTypeId,
        eq.name AS equipmentName,
        fer.min_quantity AS minQuantity,
        eq.total_quantity AS totalQuantity,
        eq.total_quantity - COALESCE(SUM(re.quantity), 0) AS availableQuantity
      FROM facility_equipment_rules fer
      JOIN equipment_types eq ON eq.id = fer.equipment_type_id
      LEFT JOIN (
        SELECT re.equipment_type_id, re.quantity
        FROM reservation_equipment re
        JOIN reservations r ON r.id = re.reservation_id
        WHERE r.booking_date = ? AND r.start_time = ?
        ${excludeReservationId ? 'AND r.id != ?' : ''}
      ) re ON re.equipment_type_id = eq.id
      WHERE fer.facility_type_id = ?
      GROUP BY fer.equipment_type_id, eq.name, fer.min_quantity, eq.total_quantity
      ORDER BY fer.min_quantity DESC, eq.name;
    `;
    const params = excludeReservationId
      ? [date, time, excludeReservationId, facilityTypeId]
      : [date, time, facilityTypeId];

    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// get available facility for manual selection in a date and slot
const getFacilityManualSelection = (facilityId, bookingDate, startTime) => {
  const date = resolveDate(bookingDate);
  const time = resolveTime(startTime);

  return new Promise((resolve, reject) => {
    const sql = `SELECT id, facility_type_id AS facilityTypeId, name FROM facilities 
                WHERE id = ? 
                AND id NOT IN (
                  SELECT facility_id FROM reservations 
                  WHERE booking_date = ? AND start_time = ?
                );`;
    db.get(sql, [facilityId, date, time], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// get first available facility for automatic selection in a date and slot
const getFacilityAutomaticSelection = (facilityType, bookingDate, startTime) => {
  const date = resolveDate(bookingDate);
  const time = resolveTime(startTime);

  return new Promise((resolve, reject) => {
    const sql = `SELECT id, facility_type_id AS facilityTypeId, name FROM facilities 
                WHERE facility_type_id = ? 
                AND id NOT IN (
                  SELECT facility_id FROM reservations 
                  WHERE booking_date = ? AND start_time = ?
                )
                LIMIT 1;`;
    db.get(sql, [facilityType, date, time], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export default {
  getPublicAvailability,
  getAllFacilities,
  getAllFacilityTypes,
  getFacilityEquipmentRules,
  getFacilityManualSelection,
  getFacilityAutomaticSelection,
};
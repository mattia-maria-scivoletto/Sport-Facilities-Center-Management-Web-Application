import db from './db.mjs';

// get public overview of facilities and equipment
const getPublicAvailability = () => {
  return new Promise((resolve, reject) => {
    const sqlFacilities = `
      SELECT 
        f.id AS code,
        f.facility_type_id AS typeId,
        ft.name AS typeName,
        CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END AS isBooked
      FROM facilities f
      JOIN facility_types ft ON f.facility_type_id = ft.id
      LEFT JOIN reservations r ON r.facility_id = f.id
      ORDER BY f.facility_type_id, f.id;
    `;

    const sqlEquipment = `
      SELECT 
        eq.id AS id,
        eq.name AS name,
        eq.total_quantity AS totalQuantity,
        eq.total_quantity - COALESCE(SUM(re.quantity), 0) AS availableQuantity
      FROM equipment_types eq
      LEFT JOIN reservation_equipment re ON re.equipment_type_id = eq.id
      GROUP BY eq.id, eq.name, eq.total_quantity
      ORDER BY eq.id;
    `;

    db.all(sqlFacilities, [], (err, facilityRows) => {
      if (err) return reject(err);

      db.all(sqlEquipment, [], (err2, equipmentRows) => {
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
          facilities,
          equipment: equipmentRows
        });
      });
    });
  });
};

// get list of all individual facilities with booking status
const getAllFacilities = () => {
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
      LEFT JOIN reservations r ON r.facility_id = f.id
      ORDER BY f.facility_type_id, f.id;
    `;
    db.all(sql, [], (err, rows) => {
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

// get equipment rules and current stock for a facility type
const getFacilityEquipmentRules = (facilityTypeId) => {
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
      LEFT JOIN reservation_equipment re ON re.equipment_type_id = eq.id
      WHERE fer.facility_type_id = ?
      GROUP BY fer.equipment_type_id, eq.name, fer.min_quantity, eq.total_quantity
      ORDER BY fer.min_quantity DESC, eq.name;
    `;
    db.all(sql, [facilityTypeId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// get available facility for manual selection
const getFacilityManualSelection = (facilityId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id, facility_type_id AS facilityTypeId, name FROM facilities 
                WHERE id = ? 
                AND id NOT IN (SELECT facility_id FROM reservations);`;
    db.get(sql, [facilityId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// get first available facility for automatic selection
const getFacilityAutomaticSelection = (facilityType) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT id, facility_type_id AS facilityTypeId, name FROM facilities 
                WHERE facility_type_id = ? 
                AND id NOT IN (SELECT facility_id FROM reservations)
                LIMIT 1;`;
    db.get(sql, [facilityType], (err, row) => {
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
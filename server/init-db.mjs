import fs from 'fs';
import path from 'path';
import sqlite from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'sports_database.db');
const sqlPath = path.join(__dirname, 'init-db.sql');

console.log('Initializing SQLite database at:', dbPath);

const sql = fs.readFileSync(sqlPath, 'utf8');
const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
    process.exit(1);
  }
  
  db.exec(sql, (execErr) => {
    if (execErr) {
      console.error('Error executing seed SQL:', execErr);
      process.exit(1);
    }
    console.log('Database successfully initialized and seeded with test data.');
    db.close();
  });
});

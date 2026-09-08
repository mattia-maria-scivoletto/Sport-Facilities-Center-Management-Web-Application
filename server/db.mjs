import sqlite from 'sqlite3';

const db = new sqlite.Database('sports_database.db', (err) => {
  if (err) throw err;

  // enable foreign key enforcement for this connection
  // so that foreign key and ON CASCADE properly work
  db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
    if (pragmaErr) throw pragmaErr;
  });
});

export default db;
'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            process.env.DB_PORT     || 3306,
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'vacc_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit:      0,
  timezone:        '+03:00',          // East Africa Time
  charset:         'utf8mb4',
});

// Probe the connection on startup (skipped under tests). We log a clear
// message instead of killing the process, so the app still boots and serves
// the front end even if MySQL is momentarily unavailable.
if (process.env.NODE_ENV !== 'test') {
  pool.getConnection()
    .then(conn => {
      console.log('[DB] Connected to MySQL — vacc_system');
      conn.release();
    })
    .catch(err => {
      console.error('[DB] Connection failed:', err.message);
      console.error('[DB] Make sure MySQL is running and your .env DB_* settings are correct, then restart.');
    });
}

module.exports = pool;

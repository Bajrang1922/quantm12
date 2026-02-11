import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'quantumalphaindiadb',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'quantumalphaindiadb',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Backwards-compatible helper used by many routes expecting getDatabase()
export async function getDatabase() {
  return db;
}

/**
 * Database Connection Pool and Utilities
 * File: src/lib/db.ts
 */

import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

/**
 * Initialize database connection pool
 */
export async function initializePool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'quantumalphaindiadb',
    password: process.env.DB_PASSWORD || 'quantumalphaindia@2026',
    database: process.env.DB_NAME || 'quantumalphaindiadb',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
  });

  console.log('✅ Database connection pool initialized');
  return pool;
}

/**
 * Get database connection from pool
 */
export async function getConnection() {
  const dbPool = pool || (await initializePool());
  return await dbPool.getConnection();
}

/**
 * Execute query with automatic connection management
 */
export async function query(sql: string, values?: any[]) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.query(sql, values);
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Execute query and return first result
 */
export async function queryOne(sql: string, values?: any[]) {
  const rows = await query(sql, values);
  return Array.isArray(rows) ? rows[0] : null;
}

/**
 * Insert record and return inserted ID
 */
export async function insert(table: string, data: Record<string, any>) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(',');
  
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
  const connection = await getConnection();
  
  try {
    const [result] = await connection.query(sql, values);
    return result;
  } finally {
    connection.release();
  }
}

/**
 * Update record
 */
export async function update(table: string, data: Record<string, any>, where: Record<string, any>) {
  const updates = Object.keys(data).map(key => `${key} = ?`).join(',');
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
  
  const sql = `UPDATE ${table} SET ${updates} WHERE ${whereClause}`;
  const values = [...Object.values(data), ...Object.values(where)];
  
  const connection = await getConnection();
  try {
    const [result] = await connection.query(sql, values);
    return result;
  } finally {
    connection.release();
  }
}

/**
 * Delete record
 */
export async function deleteRecord(table: string, where: Record<string, any>) {
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  const values = Object.values(where);
  
  const connection = await getConnection();
  try {
    const [result] = await connection.query(sql, values);
    return result;
  } finally {
    connection.release();
  }
}

/**
 * Find records by condition
 */
export async function find(table: string, where: Record<string, any>, limit?: number) {
  const whereClause = Object.keys(where).length > 0 
    ? Object.keys(where).map(key => `${key} = ?`).join(' AND ')
    : '1=1';
  
  let sql = `SELECT * FROM ${table} WHERE ${whereClause}`;
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  
  const values = Object.values(where);
  return await query(sql, values);
}

/**
 * Find all records
 */
export async function findAll(table: string, limit?: number) {
  let sql = `SELECT * FROM ${table}`;
  if (limit) {
    sql += ` LIMIT ${limit}`;
  }
  return await query(sql);
}

/**
 * Find by ID
 */
export async function findById(table: string, id: string | number) {
  return await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

/**
 * Count records
 */
export async function count(table: string, where?: Record<string, any>) {
  const whereClause = where && Object.keys(where).length > 0
    ? Object.keys(where).map(key => `${key} = ?`).join(' AND ')
    : '';
  
  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  if (whereClause) {
    sql += ` WHERE ${whereClause}`;
  }
  
  const result = await queryOne(sql, where ? Object.values(where) : []);
  return result?.count || 0;
}

/**
 * Check if record exists
 */
export async function exists(table: string, where: Record<string, any>) {
  const count = await count(table, where);
  return count > 0;
}

/**
 * Execute raw query with full control
 */
export async function raw(sql: string, values?: any[]) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.query(sql, values);
    return rows;
  } finally {
    connection.release();
  }
}

/**
 * Execute transaction
 */
export async function transaction(callback: (connection: mysql.PoolConnection) => Promise<any>) {
  const connection = await getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Save OAuth token
 */
export async function saveOAuthToken(userId: string, token: { access_token: string; refresh_token?: string; expires_at?: string; scope?: string }) {
  return await insert('oauth_tokens', {
    user_id: userId,
    account_id: userId,
    access_token: token.access_token,
    refresh_token: token.refresh_token || null,
    expires_at: token.expires_at || null,
    scope: token.scope || null,
  });
}

/**
 * Get OAuth token
 */
export async function getOAuthToken(userId: string) {
  return await queryOne('SELECT * FROM oauth_tokens WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [userId]);
}

/**
 * Save follower credentials
 */
export async function saveFollowerCredentials(followerId: string, credentials: any) {
  return await insert('follower_credentials', {
    follower_id: followerId,
    login_username: credentials.login_username,
    login_password_hash: credentials.login_password_hash,
    api_key: credentials.api_key,
    api_secret: credentials.api_secret,
    client_id: credentials.client_id,
    lot_multiplier: credentials.lot_multiplier || 1.0,
    max_quantity: credentials.max_quantity || null,
    max_order_value: credentials.max_order_value || null,
    max_daily_loss: credentials.max_daily_loss || null,
  });
}

/**
 * Get follower by login username
 */
export async function getFollowerByUsername(username: string) {
  return await queryOne(
    `SELECT f.*, fc.* FROM followers f
     LEFT JOIN follower_credentials fc ON f.id = fc.follower_id
     WHERE fc.login_username = ?`,
    [username]
  );
}

/**
 * Log copy trade
 */
export async function logCopyTrade(tradeData: any) {
  return await insert('copy_trades', {
    id: tradeData.id,
    master_id: tradeData.master_id,
    follower_id: tradeData.follower_id,
    symbol: tradeData.symbol,
    side: tradeData.side,
    master_qty: tradeData.master_qty,
    follower_qty: tradeData.follower_qty,
    price: tradeData.price,
    status: tradeData.status || 'PENDING',
  });
}

/**
 * Update copy trade status
 */
export async function updateCopyTradeStatus(tradeId: string, status: string, reason?: string) {
  return await update('copy_trades', 
    { status, ...(reason && { reason }) },
    { id: tradeId }
  );
}

/**
 * Get follower copy trades
 */
export async function getFollowerCopyTrades(followerId: string, limit: number = 50) {
  return await query(
    `SELECT * FROM copy_trades WHERE follower_id = ? ORDER BY created_at DESC LIMIT ?`,
    [followerId, limit]
  );
}

/**
 * Create session
 */
export async function createSession(userId: string, token: string, expiresAt: Date) {
  return await insert('sessions', {
    id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    user_id: userId,
    token,
    expires_at: expiresAt,
  });
}

/**
 * Get session by token
 */
export async function getSession(token: string) {
  return await queryOne(
    `SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()`,
    [token]
  );
}

/**
 * Close connection pool
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database connection pool closed');
  }
}

// Export pool for direct access if needed
export { pool };

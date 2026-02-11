#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Usage: npm run db:test
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'quantumalphaindiadb',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'quantumalphaindiadb',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function testConnection() {
  let connection;

  try {
    console.log('\n🔍 Database Connection Test\n');
    console.log('📋 Configuration:');
    console.log(`   Host: ${DB_CONFIG.host}`);
    console.log(`   Port: ${DB_CONFIG.port}`);
    console.log(`   Database: ${DB_CONFIG.database}`);
    console.log(`   User: ${DB_CONFIG.user}\n`);

    console.log('🔄 Attempting connection...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connection successful!\n');

    // Test basic query
    console.log('📊 Running diagnostic queries...\n');

    // Check version
    const [[{ version }]] = await connection.query('SELECT VERSION() as version');
    console.log(`✅ MySQL Version: ${version}`);

    // Check tables
    const [tables] = await connection.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [DB_CONFIG.database]
    );
    console.log(`✅ Tables found: ${tables.length}`);
    if (tables.length > 0) {
      tables.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.TABLE_NAME}`);
      });
    }

    // Check views
    console.log('');
    const [views] = await connection.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = "VIEW" ORDER BY TABLE_NAME',
      [DB_CONFIG.database]
    );
    console.log(`✅ Views found: ${views.length}`);
    if (views.length > 0) {
      views.forEach((v, i) => {
        console.log(`   ${i + 1}. ${v.TABLE_NAME}`);
      });
    }

    // Check data
    console.log('');
    const [settings] = await connection.query('SELECT COUNT(*) as count FROM system_settings');
    console.log(`✅ System Settings: ${settings[0].count} records`);

    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Users: ${users[0].count} records`);

    const [followers] = await connection.query('SELECT COUNT(*) as count FROM followers');
    console.log(`✅ Followers: ${followers[0].count} records`);

    const [trades] = await connection.query('SELECT COUNT(*) as count FROM copy_trades');
    console.log(`✅ Copy Trades: ${trades[0].count} records`);

    const [tokens] = await connection.query('SELECT COUNT(*) as count FROM oauth_tokens');
    console.log(`✅ OAuth Tokens: ${tokens[0].count} records\n`);

    // Performance test
    console.log('🚀 Performance Test...');
    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      await connection.query('SELECT 1');
    }
    const endTime = Date.now();
    const avgTime = ((endTime - startTime) / 100).toFixed(2);
    console.log(`✅ 100 simple queries in ${endTime - startTime}ms (avg: ${avgTime}ms per query)\n`);

    console.log('🎉 All tests passed!\n');
    console.log('✅ Database is ready for use');
    console.log('📝 Next steps:');
    console.log('   1. Review DATABASE_SETUP.md for configuration details');
    console.log('   2. Review DATABASE_MIGRATION_GUIDE.md for code integration');
    console.log('   3. Update API routes to use database functions from src/lib/database.ts\n');

  } catch (error) {
    console.error('\n❌ Test failed!\n');
    console.error(`Error: ${error.message}\n`);

    if (error.code === 'ER_ACCESS_DENIED_FOR_USER') {
      console.error('💡 Troubleshooting Tips:');
      console.error('   1. Check database credentials in .env.local');
      console.error('   2. Verify database user exists');
      console.error('   3. Verify database user has correct permissions\n');
      console.error('To reset password in CloudPanel:');
      console.error('   1. Go to CloudPanel Dashboard');
      console.error('   2. Click on Databases');
      console.error('   3. Select your database');
      console.error('   4. Click Edit User and reset password\n');

    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Troubleshooting Tips:');
      console.error('   1. Database does not exist');
      console.error('   2. Create with: CREATE DATABASE quantumalphaindiadb;');
      console.error('   3. Then run: npm run db:migrate\n');

    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Troubleshooting Tips:');
      console.error('   1. MySQL server is not running');
      console.error('   2. Verify host and port in .env.local');
      console.error('   3. Check CloudPanel MySQL service status\n');

    } else if (error.code === 'PROTOCOL_PACKETS_OUT_OF_ORDER') {
      console.error('💡 Troubleshooting Tips:');
      console.error('   1. Connection pool issue');
      console.error('   2. Clear and recreate connection pool');
      console.error('   3. Check for concurrent connection issues\n');
    }

    process.exit(1);

  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testConnection();

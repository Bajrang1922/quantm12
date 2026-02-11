#!/usr/bin/env node

/**
 * Database Migration Script for Quantum Alpha India
 * Usage: node scripts/migrate-db.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'quantumalphaindiadb',
  password: process.env.DB_PASSWORD || 'quantumalphaindia@2026',
  database: process.env.DB_NAME || 'quantumalphaindiadb',
  port: parseInt(process.env.DB_PORT || '3306'),
};

const SCHEMA_FILE = path.join(__dirname, '../database/schema.sql');

/**
 * Read schema file
 */
function readSchemaFile() {
  try {
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
    return schema;
  } catch (error) {
    console.error('❌ Error reading schema file:', error.message);
    process.exit(1);
  }
}

/**
 * Split SQL statements (handle comments and line breaks)
 */
function splitSqlStatements(sql) {
  // Remove comments (single line and multi-line)
  let cleaned = sql
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Split by semicolon and filter empty statements
  const statements = cleaned
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  return statements;
}

/**
 * Execute migration
 */
async function migrate() {
  let connection;

  try {
    console.log('🔄 Connecting to database...');
    console.log(`   Host: ${DB_CONFIG.host}`);
    console.log(`   Database: ${DB_CONFIG.database}`);
    console.log(`   User: ${DB_CONFIG.user}\n`);

    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database\n');

    // Read schema
    console.log('📖 Reading schema file...');
    const schema = readSchemaFile();
    const statements = splitSqlStatements(schema);
    console.log(`✅ Found ${statements.length} SQL statements\n`);

    // Execute statements
    console.log('🚀 Executing SQL statements...\n');
    let executedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const lineNum = i + 1;

      try {
        // Extract statement type for logging
        const match = statement.match(/^(CREATE|INSERT|DROP|ALTER)\s+(\w+)/i);
        const statementType = match ? `${match[1].toUpperCase()} ${match[2].toUpperCase()}` : 'EXECUTE';
        
        // Extract table/view name if available
        const nameMatch = statement.match(/(?:CREATE|INSERT INTO|DROP)\s+(?:TABLE|VIEW)?\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?`?(\w+)`?/i);
        const name = nameMatch ? nameMatch[1] : '';

        console.log(`   [${lineNum}/${statements.length}] ${statementType}${name ? ` - ${name}` : ''}... `, {replace: false});

        await connection.query(statement);
        executedCount++;
        console.log('✅');
      } catch (error) {
        errorCount++;
        console.log(`❌ Error: ${error.message}`);
        
        // Continue on warnings (like "already exists")
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Migration Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Executed: ${executedCount}/${statements.length} statements`);
    if (errorCount > 0) {
      console.log(`⚠️  Warnings/Errors: ${errorCount} (usually non-critical)`);
    }
    console.log(`${'='.repeat(60)}\n`);

    // Verify installation
    console.log('🔍 Verifying installation...\n');

    // Check tables
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
      [DB_CONFIG.database]
    );
    console.log(`✅ Tables created: ${tables.length}`);
    tables.forEach(t => console.log(`   • ${t.TABLE_NAME}`));

    // Check views
    const [views] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW'",
      [DB_CONFIG.database]
    );
    console.log(`\n✅ Views created: ${views.length}`);
    views.forEach(v => console.log(`   • ${v.TABLE_NAME}`));

    // Check system settings
    const [settings] = await connection.query('SELECT * FROM system_settings');
    console.log(`\n✅ System settings initialized: ${settings.length} entries`);
    settings.forEach(s => console.log(`   • ${s.setting_key}: ${s.setting_value}`));

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Database migration completed successfully!');
    console.log(`${'='.repeat(60)}\n`);

    console.log('📝 Next steps:');
    console.log('   1. Update API route handlers to use database instead of file storage');
    console.log('   2. Test database connectivity with: npm run test:db');
    console.log('   3. Review database/schema.sql for table structures');
    console.log('   4. Check DATABASE_SETUP.md for additional configuration\n');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error(`Error: ${error.message}\n`);
    
    if (error.code === 'ER_ACCESS_DENIED_FOR_USER') {
      console.error('💡 Tip: Check your database credentials in .env.local');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('💡 Tip: Database does not exist. Create it with:');
      console.error('   CREATE DATABASE quantumalphaindiadb;');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run migration
migrate();

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool with SSL disabled for local testing
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This allows connecting to Neon Tech with self-signed certificates
  }
});

async function addWebsiteColumn() {
  try {
    console.log('Adding website column to users table...');
    
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS website VARCHAR(255)
    `);
    
    console.log('Website column added successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error adding website column:', err);
    process.exit(1);
  }
}

addWebsiteColumn();
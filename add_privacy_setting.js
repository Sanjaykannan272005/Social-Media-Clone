const pool = require('./db');

async function addPrivacySetting() {
  try {
    // Add is_private column to users table with default false (public account)
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
    `);
    
    console.log('Successfully added is_private column to users table');
    process.exit(0);
  } catch (err) {
    console.error('Error adding privacy setting:', err);
    process.exit(1);
  }
}

addPrivacySetting();
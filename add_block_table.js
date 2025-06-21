const pool = require('./db');

async function addBlockTable() {
  try {
    // Create blocked_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (blocker_id, blocked_id)
      );
    `);
    
    console.log('Successfully created blocked_users table');
    process.exit(0);
  } catch (err) {
    console.error('Error creating blocked_users table:', err);
    process.exit(1);
  }
}

addBlockTable();
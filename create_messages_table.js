const pool = require('./db');

async function createMessagesTable() {
  try {
    // Check if messages table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'messages'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating messages table...');
      
      // Create messages table
      await pool.query(`
        CREATE TABLE messages (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP WITH TIME ZONE
        );
      `);
      
      // Create indexes for better performance
      await pool.query(`
        CREATE INDEX idx_messages_sender_id ON messages(sender_id);
        CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
        CREATE INDEX idx_messages_created_at ON messages(created_at);
      `);
      
      console.log('Messages table created successfully');
    } else {
      console.log('Messages table already exists');
    }
    
    return { success: true };
  } catch (err) {
    console.error('Error creating messages table:', err);
    return { success: false, error: err.message };
  } finally {
    // Don't close the pool here if it's used elsewhere
  }
}

// Run the migration
createMessagesTable()
  .then(result => {
    console.log('Migration result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
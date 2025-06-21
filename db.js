const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool for Neon Tech PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb',
    ssl: {
        require: true,
        rejectUnauthorized: false // Required for Neon Tech connections
    }
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully to Neon Tech at:', res.rows[0].now);
    }
});

module.exports = pool;
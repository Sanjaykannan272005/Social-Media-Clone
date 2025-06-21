const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dir = path.join(__dirname, '../public/uploads/chat');
        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        cb(null, 'chat-' + Date.now() + '-' + Math.floor(Math.random() * 1000000000) + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Get messages between current user and another user
router.get('/messages/:userId', ensureAuthenticated, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Verify the other user exists
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [userId]
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if messages table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'messages'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            // Return empty array if table doesn't exist yet
            return res.json([]);
        }
        
        // Get messages between the two users
        const messages = await pool.query(
            `SELECT m.*, 
            sender.username as sender_username, 
            sender.avatar as sender_avatar,
            receiver.username as receiver_username,
            receiver.avatar as receiver_avatar
            FROM messages m
            JOIN users sender ON m.sender_id = sender.id
            JOIN users receiver ON m.receiver_id = receiver.id
            WHERE (m.sender_id = $1 AND m.receiver_id = $2)
            OR (m.sender_id = $2 AND m.receiver_id = $1)
            ORDER BY m.created_at ASC`,
            [req.user.id, userId]
        );
        
        res.json(messages.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Send a message
router.post('/messages', ensureAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const { receiver_id, content } = req.body;
        const imageFile = req.file;
        
        // Either content or image must be provided
        if ((!content || !content.trim()) && !imageFile) {
            return res.status(400).json({ error: 'Message content or image is required' });
        }
        
        // Verify the receiver exists
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [receiver_id]
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Recipient not found' });
        }
        
        // Check if messages table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'messages'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            // Create messages table if it doesn't exist
            await pool.query(`
                CREATE TABLE messages (
                    id SERIAL PRIMARY KEY,
                    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content TEXT,
                    image_url TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    read_at TIMESTAMP WITH TIME ZONE
                );
                
                CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
                CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
                CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
            `);
        } else {
            // Check if image_url column exists, add it if not
            const columnCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'messages' AND column_name = 'image_url'
                );
            `);
            
            if (!columnCheck.rows[0].exists) {
                await pool.query(`
                    ALTER TABLE messages 
                    ADD COLUMN image_url TEXT,
                    ALTER COLUMN content DROP NOT NULL;
                `);
            }
        }
        
        // Process image if uploaded
        let imageUrl = null;
        if (imageFile) {
            imageUrl = `/uploads/chat/${imageFile.filename}`;
        }
        
        // Insert the message
        const result = await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, content, image_url, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [req.user.id, receiver_id, content || '', imageUrl]
        );
        
        // Get sender info
        const userResult = await pool.query(
            'SELECT username, avatar FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const message = {
            ...result.rows[0],
            sender_username: userResult.rows[0].username,
            sender_avatar: userResult.rows[0].avatar
        };
        
        // Emit to socket if available
        if (req.app.get('io')) {
            req.app.get('io').to(`user_${receiver_id}`).emit('newMessage', message);
        }
        
        res.status(201).json(message);
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
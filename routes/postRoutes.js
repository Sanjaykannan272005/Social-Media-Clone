const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const mediaType = file.mimetype.startsWith('image/') ? 'images' : 'videos';
        const uploadPath = path.join(__dirname, `../public/uploads/${mediaType}`);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// File filter to only allow images and videos
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images and videos are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Create a new post with optional media
router.post('/', ensureAuthenticated, upload.single('media'), async (req, res) => {
    try {
        const { content } = req.body;
        let mediaUrl = null;
        let mediaType = null;
        
        // If media was uploaded, save the path
        if (req.file) {
            const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
            const relativePath = `/uploads/${mediaType === 'image' ? 'images' : 'videos'}/${req.file.filename}`;
            mediaUrl = relativePath;
        }
        
        // Insert post into database
        const result = await pool.query(
            'INSERT INTO posts (user_id, content, media_url, media_type, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [req.user.id, content, mediaUrl, mediaType]
        );
        
        // Get user info for the post
        const userResult = await pool.query(
            'SELECT username, avatar FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const post = {
            ...result.rows[0],
            username: userResult.rows[0].username,
            avatar: userResult.rows[0].avatar
        };
        
        res.status(201).json(post);
    } catch (err) {
        console.error('Error creating post:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get all posts (feed)
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username, u.avatar 
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.is_public = true OR p.user_id = $1
            ORDER BY p.created_at DESC
            LIMIT 50
        `, [req.user.id]);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching posts:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get a specific post
router.get('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username, u.avatar 
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = $1 AND (p.is_public = true OR p.user_id = $2)
        `, [req.params.id, req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching post:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
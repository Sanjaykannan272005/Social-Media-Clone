const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
}).single('media');

// Create a new post
exports.createPost = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        
        try {
            const { content } = req.body;
            
            if (!content && !req.file) {
                return res.status(400).json({ error: 'Post must have content or media' });
            }
            
            let mediaUrl = null;
            let mediaType = null;
            
            // If media was uploaded, save the path
            if (req.file) {
                mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
                const relativePath = `/uploads/${mediaType === 'image' ? 'images' : 'videos'}/${req.file.filename}`;
                mediaUrl = relativePath;
            }
            
            // Insert post into database
            const result = await pool.query(
                'INSERT INTO posts (user_id, content, media_url, media_type, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
                [req.user.id, content || '', mediaUrl, mediaType]
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
};

// Get all posts (feed)
exports.getPosts = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username, u.avatar,
            COALESCE((SELECT COUNT(*) FROM likes WHERE post_id = p.id), 0) as likes_count,
            EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as user_liked,
            (
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'id', c.id,
                            'content', c.content,
                            'created_at', c.created_at,
                            'username', cu.username,
                            'avatar', cu.avatar
                        )
                        ORDER BY c.created_at DESC
                    ),
                    '[]'::json
                )
                FROM comments c
                JOIN users cu ON c.user_id = cu.id
                WHERE c.post_id = p.id
            ) as comments
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
};

// Get a specific post
exports.getPost = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username, u.avatar,
            COALESCE((SELECT COUNT(*) FROM likes WHERE post_id = p.id), 0) as likes_count,
            EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) as user_liked,
            (
                SELECT COALESCE(
                    json_agg(
                        json_build_object(
                            'id', c.id,
                            'content', c.content,
                            'created_at', c.created_at,
                            'username', cu.username,
                            'avatar', cu.avatar
                        )
                        ORDER BY c.created_at DESC
                    ),
                    '[]'::json
                )
                FROM comments c
                JOIN users cu ON c.user_id = cu.id
                WHERE c.post_id = p.id
            ) as comments
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = $2 AND (p.is_public = true OR p.user_id = $1)
        `, [req.user.id, req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching post:', err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Update a post
exports.updatePost = async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Post content cannot be empty' });
        }
        
        // Check if user owns the post
        const postResult = await pool.query(
            'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        
        if (postResult.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to update this post' });
        }
        
        // Update the post
        const result = await pool.query(
            'UPDATE posts SET content = $1 WHERE id = $2 RETURNING *',
            [content, req.params.id]
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
        
        res.json(post);
    } catch (err) {
        console.error('Error updating post:', err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Toggle like on a post
exports.toggleLike = async (req, res) => {
    try {
        // Check if user already liked the post
        const checkResult = await pool.query(
            'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2',
            [req.user.id, req.params.id]
        );
        
        if (checkResult.rows.length > 0) {
            // Unlike
            await pool.query(
                'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
                [req.user.id, req.params.id]
            );
            res.json({ liked: false });
        } else {
            // Like
            await pool.query(
                'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
                [req.user.id, req.params.id]
            );
            res.json({ liked: true });
        }
    } catch (err) {
        console.error('Error toggling like:', err);
        res.status(500).json({ error: 'Server Error' });
    }
};

// Delete a post
exports.deletePost = async (req, res) => {
    try {
        // Check if user owns the post
        const postResult = await pool.query(
            'SELECT * FROM posts WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.id]
        );
        
        if (postResult.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }
        
        const post = postResult.rows[0];
        
        // Delete the post
        await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
        
        // Delete the media file if exists
        if (post.media_url) {
            const filePath = path.join(__dirname, '../public', post.media_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting post:', err);
        res.status(500).json({ error: 'Server Error' });
    }
};
const pool = require('../db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { username, bio, email, website } = req.body;
        
        // Validate required fields
        if (!username || !email) {
            return res.status(400).json({ error: 'Username and email are required' });
        }
        
        // Check if username is already taken by another user
        const usernameCheck = await pool.query(
            'SELECT id FROM users WHERE username = $1 AND id != $2',
            [username, req.user.id]
        );
        
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Username is already taken' });
        }
        
        // Check if email is already taken by another user
        const emailCheck = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, req.user.id]
        );
        
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Email is already taken' });
        }
        
        // Update user profile with website field
        await pool.query(
            `UPDATE users 
             SET username = $1, bio = $2, email = $3, website = $4
             WHERE id = $5`,
            [username, bio || null, email, website || null, req.user.id]
        );
        
        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Failed to update profile', details: err.message });
    }
};

// Get user posts for profile page
exports.getUserPosts = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        
        // Check if the profile is private and if the current user is allowed to view it
        if (userId != req.user.id) {
            const privacyCheck = await pool.query(`
                SELECT is_private, 
                EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) as is_following,
                EXISTS(SELECT 1 FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2) as is_blocked_by_me,
                EXISTS(SELECT 1 FROM blocked_users WHERE blocker_id = $2 AND blocked_id = $1) as is_blocked_by_them
                FROM users WHERE id = $2
            `, [req.user.id, userId]);
            
            // If user is blocked, return empty posts
            if (privacyCheck.rows[0] && (privacyCheck.rows[0].is_blocked_by_me || privacyCheck.rows[0].is_blocked_by_them)) {
                return res.json({
                    blocked: true,
                    message: 'User not available.',
                    posts: []
                });
            }
            
            // If account is private and user is not following, return empty posts
            if (privacyCheck.rows[0] && privacyCheck.rows[0].is_private && !privacyCheck.rows[0].is_following) {
                return res.json({
                    private: true,
                    message: 'This account is private. Follow this user to see their posts.',
                    posts: []
                });
            }
        }
        
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
            WHERE p.user_id = $2
            ORDER BY p.created_at DESC
        `, [req.user.id, userId]);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching user posts:', err);
        res.status(500).json({ error: 'Server Error' });
    }
};

exports.updateAvatar = async (req, res) => {
    try {
        const { avatarUrl } = req.body;
        
        if (!avatarUrl) {
            return res.status(400).json({ error: 'Avatar URL is required' });
        }
        
        // Extract the base64 data from the data URL
        const matches = avatarUrl.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid image data' });
        }
        
        const imageType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Create a unique filename
        const filename = `avatar-${req.user.id}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${imageType === 'jpeg' ? 'jpg' : imageType}`;
        const uploadDir = path.join(__dirname, '../public/uploads/avatars');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filePath = path.join(uploadDir, filename);
        const fileUrl = `/uploads/avatars/${filename}`;
        
        // Write the file
        fs.writeFileSync(filePath, buffer);
        
        // Update the user's avatar in the database
        await pool.query(
            'UPDATE users SET avatar = $1 WHERE id = $2',
            [fileUrl, req.user.id]
        );
        
        res.status(200).json({ 
            message: 'Avatar updated',
            avatarUrl: fileUrl
        });
    } catch (err) {
        console.error('Error updating avatar:', err);
        res.status(500).json({ error: 'Avatar update failed', details: err.message });
    }
};

exports.updateCover = async (req, res) => {
    try {
        const { coverUrl } = req.body;
        
        if (!coverUrl) {
            return res.status(400).json({ error: 'Cover image URL is required' });
        }
        
        // Extract the base64 data from the data URL
        const matches = coverUrl.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid image data' });
        }
        
        const imageType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Create a unique filename
        const filename = `cover-${req.user.id}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${imageType === 'jpeg' ? 'jpg' : imageType}`;
        const uploadDir = path.join(__dirname, '../public/uploads/covers');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filePath = path.join(uploadDir, filename);
        const fileUrl = `/uploads/covers/${filename}`;
        
        // Write the file
        fs.writeFileSync(filePath, buffer);
        
        // Update the user's cover image in the database
        await pool.query(
            'UPDATE users SET cover_image = $1 WHERE id = $2',
            [fileUrl, req.user.id]
        );
        
        res.status(200).json({ 
            message: 'Cover image updated',
            coverUrl: fileUrl
        });
    } catch (err) {
        console.error('Error updating cover image:', err);
        res.status(500).json({ error: 'Cover image update failed', details: err.message });
    }
};
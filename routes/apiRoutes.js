const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ensureAuthenticated } = require('../middleware/authMiddleware');
const postController = require('../controllers/postController');
const userController = require('../controllers/userController');

// Posts routes
router.get('/posts', ensureAuthenticated, postController.getPosts);
router.post('/posts', ensureAuthenticated, postController.createPost);
router.post('/posts/:id/like', ensureAuthenticated, postController.toggleLike);
router.get('/posts/:id', ensureAuthenticated, postController.getPost);
router.put('/posts/:id', ensureAuthenticated, postController.updatePost);
router.delete('/posts/:id', ensureAuthenticated, postController.deletePost);

// Add comment
router.post('/posts/:id/comments', ensureAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content cannot be empty' });
        }
        
        const result = await pool.query(
            'INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, req.params.id, content]
        );
        
        // Get user info
        const userResult = await pool.query(
            'SELECT username, avatar FROM users WHERE id = $1',
            [req.user.id]
        );
        
        const newComment = {
            ...result.rows[0],
            username: userResult.rows[0].username,
            avatar: userResult.rows[0].avatar
        };
        
        // Emit to all clients
        if (req.app.get('io')) {
            req.app.get('io').emit('newComment', newComment);
        }
        
        res.status(201).json(newComment);
    } catch (err) {
        console.error('Error creating comment:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Search users
router.get('/search/users', ensureAuthenticated, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) {
            return res.json([]);
        }

        const searchResults = await pool.query(
            `SELECT u.id, u.username, u.email, u.avatar, u.bio, u.is_verified,
             EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
             FROM users u 
             WHERE u.username ILIKE $2 
             AND u.id != $1
             AND u.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1)
             AND u.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $1)
             ORDER BY 
                CASE WHEN u.username ILIKE $3 THEN 0 ELSE 1 END,
                u.username
             LIMIT 10`,
            [req.user.id, `%${query}%`, query]
        );

        res.json(searchResults.rows);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed', details: err.message });
    }
});

// Add follow/unfollow routes
router.post('/users/:id/follow', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, req.params.id]
        );
        res.status(204).send();
    } catch (err) {
        console.error('Error following user:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

router.delete('/users/:id/follow', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
            [req.user.id, req.params.id]
        );
        res.status(204).send();
    } catch (err) {
        console.error('Error unfollowing user:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Profile routes
router.put('/users/profile', ensureAuthenticated, userController.updateProfile);

// User profile image routes
router.post('/profile/avatar', ensureAuthenticated, userController.updateAvatar);
router.post('/profile/cover', ensureAuthenticated, userController.updateCover);
router.get('/users/:userId/posts', ensureAuthenticated, userController.getUserPosts);

// Get user followers and following
router.get('/users/:userId/followers', ensureAuthenticated, async (req, res) => {
    try {
        const followers = await pool.query(`
            SELECT u.id, u.username, u.avatar, u.bio, u.is_verified,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            WHERE f.following_id = $2
            ORDER BY u.username
        `, [req.user.id, req.params.userId]);
        
        res.json(followers.rows);
    } catch (err) {
        console.error('Error fetching followers:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

router.get('/users/:userId/following', ensureAuthenticated, async (req, res) => {
    try {
        const following = await pool.query(`
            SELECT u.id, u.username, u.avatar, u.bio, u.is_verified,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
            FROM follows f
            JOIN users u ON f.following_id = u.id
            WHERE f.follower_id = $2
            ORDER BY u.username
        `, [req.user.id, req.params.userId]);
        
        res.json(following.rows);
    } catch (err) {
        console.error('Error fetching following:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

// Block/Unblock user
router.post('/users/:id/block', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, req.params.id]
        );
        res.status(204).send();
    } catch (err) {
        console.error('Error blocking user:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

router.delete('/users/:id/block', ensureAuthenticated, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
            [req.user.id, req.params.id]
        );
        res.status(204).send();
    } catch (err) {
        console.error('Error unblocking user:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get blocked users
router.get('/users/blocked', ensureAuthenticated, async (req, res) => {
    try {
        const blocked = await pool.query(`
            SELECT u.id, u.username, u.avatar, u.bio
            FROM blocked_users b
            JOIN users u ON b.blocked_id = u.id
            WHERE b.blocker_id = $1
            ORDER BY b.created_at DESC
        `, [req.user.id]);
        
        res.json(blocked.rows);
    } catch (err) {
        console.error('Error fetching blocked users:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get suggested users
router.get('/users/suggestions', ensureAuthenticated, async (req, res) => {
    try {
        const suggestions = await pool.query(`
            SELECT u.id, u.username, u.avatar, u.bio, u.is_verified,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
            FROM users u
            WHERE u.id != $1
            AND u.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1)
            AND u.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $1)
            ORDER BY u.created_at DESC
        `, [req.user.id]);
        
        res.json(suggestions.rows);
    } catch (err) {
        console.error('Error fetching suggestions:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get user profile by username
router.get('/users/:username', ensureAuthenticated, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user data with stats
        const userQuery = await pool.query(
            `SELECT u.*, 
            COALESCE((SELECT COUNT(*) FROM posts WHERE user_id = u.id), 0) as posts_count,
            COALESCE((SELECT COUNT(*) FROM follows WHERE following_id = u.id), 0) as followers_count,
            COALESCE((SELECT COUNT(*) FROM follows WHERE follower_id = u.id), 0) as following_count,
            EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
            FROM users u 
            WHERE u.username = $2`,
            [req.user.id, username]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's posts
        const postsQuery = await pool.query(
            `SELECT p.*, u.username, u.avatar,
            COALESCE((SELECT COUNT(*) FROM likes WHERE post_id = p.id), 0) as likes,
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
                LIMIT 10
            ) as comments
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $1
            ORDER BY p.created_at DESC`,
            [userQuery.rows[0].id]
        );

        const userData = {
            user: userQuery.rows[0],
            posts: postsQuery.rows
        };

        res.json(userData);
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Get user profile page
router.get('/profile/:username?', ensureAuthenticated, async (req, res) => {
    try {
        const username = req.params.username || req.session.user.username;
        
        // Get user data
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        // Get stats
        const statsResult = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM posts WHERE user_id = $1) as posts,
                (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers,
                (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following
            `,
            [user.id]
        );
        
        const stats = statsResult.rows[0];
        
        // Check if current user is following this user
        const followResult = await pool.query(
            'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
            [req.session.user.id, user.id]
        );
        
        const isFollowing = followResult.rows.length > 0;
        
        res.render('profile', {
            user,
            currentUser: req.session.user,
            stats,
            isFollowing
        });
    } catch (err) {
        console.error('Error loading profile:', err);
        res.status(500).render('error', { message: 'Failed to load profile' });
    }
});

// Get followers page
router.get('/profile/:username/followers', ensureAuthenticated, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user data
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        res.render('follow-list', {
            user,
            currentUser: req.session.user,
            type: 'followers',
            users: [] // Will be loaded via API
        });
    } catch (err) {
        console.error('Error loading followers:', err);
        res.status(500).render('error', { message: 'Failed to load followers' });
    }
});

// Get following page
router.get('/profile/:username/following', ensureAuthenticated, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user data
        const userResult = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).render('error', { message: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        res.render('follow-list', {
            user,
            currentUser: req.session.user,
            type: 'following',
            users: [] // Will be loaded via API
        });
    } catch (err) {
        console.error('Error loading following:', err);
        res.status(500).render('error', { message: 'Failed to load following' });
    }
});

module.exports = router;
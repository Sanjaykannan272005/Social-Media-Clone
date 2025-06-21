const path = require('path');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { ensureAuthenticated, ensureGuest } = require('../middleware/authMiddleware');

// Login routes
router.get('/login', (req, res) => {
  res.render('login', { 
    message: req.flash ? (req.flash('error')[0] || req.flash('info')[0]) : null
  });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Set user in session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar
    };
    
    console.log('Successful login, redirecting to dashboard');
    res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Registration routes
router.get('/register', (req, res) => {
  res.render('register', { 
    message: req.flash ? (req.flash('error')[0] || req.flash('info')[0]) : null
  });
});

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    // 1. Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // 2. Check for existing user
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2', 
      [email, username]
    );
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 4. Create user
    const newUser = await pool.query(
      `INSERT INTO users (username, email, password, avatar, updated_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id, username, email, avatar`,
      [username, email, hashedPassword, null]
    );

    // 5. Set user in session
    req.session.user = {
      id: newUser.rows[0].id,
      username: newUser.rows[0].username,
      email: newUser.rows[0].email,
      avatar: newUser.rows[0].avatar
    };
    
    res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Dashboard route
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    // Verify user exists in database
    const user = await pool.query(
      'SELECT id, username, email, avatar FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user.rows[0]) {
      req.session.destroy();
      return res.redirect('/login');
    }

    res.render('dashboard', {
      title: 'Dashboard',
      user: user.rows[0]
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Failed to load dashboard');
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Profile route - for current user
router.get('/profile', ensureAuthenticated, async (req, res) => {
  try {
    // Get user data with stats
    const userQuery = await pool.query(
      `SELECT u.*, 
      COALESCE((SELECT COUNT(*) FROM posts WHERE user_id = u.id), 0) as posts_count,
      COALESCE((SELECT COUNT(*) FROM follows WHERE following_id = u.id), 0) as followers_count,
      COALESCE((SELECT COUNT(*) FROM follows WHERE follower_id = u.id), 0) as following_count
      FROM users u 
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (!userQuery.rows[0]) {
      return res.redirect('/dashboard');
    }

    // Get user's posts
    const postsQuery = await pool.query(
      `SELECT p.*, u.username, u.avatar,
      COALESCE((SELECT COUNT(*) FROM likes WHERE post_id = p.id), 0) as likes
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    const stats = {
      posts: userQuery.rows[0].posts_count,
      followers: userQuery.rows[0].followers_count,
      following: userQuery.rows[0].following_count
    };

    res.render('profile', {
      user: userQuery.rows[0],
      currentUser: req.user,
      posts: postsQuery.rows,
      stats: stats
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).send('Failed to load profile');
  }
});

// Profile route - for any user by username
router.get('/profile/:username', ensureAuthenticated, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get user data with stats
    const userQuery = await pool.query(
      `SELECT u.*, 
      COALESCE((SELECT COUNT(*) FROM posts WHERE user_id = u.id), 0) as posts_count,
      COALESCE((SELECT COUNT(*) FROM follows WHERE following_id = u.id), 0) as followers_count,
      COALESCE((SELECT COUNT(*) FROM follows WHERE follower_id = u.id), 0) as following_count,
      EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following,
      EXISTS(SELECT 1 FROM blocked_users WHERE blocker_id = $1 AND blocked_id = u.id) as is_blocked
      FROM users u 
      WHERE u.username = $2`,
      [req.user.id, username]
    );

    if (!userQuery.rows[0]) {
      return res.redirect('/dashboard');
    }

    // Get user's posts
    const postsQuery = await pool.query(
      `SELECT p.*, u.username, u.avatar,
      COALESCE((SELECT COUNT(*) FROM likes WHERE post_id = p.id), 0) as likes
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC`,
      [userQuery.rows[0].id]
    );

    const stats = {
      posts: userQuery.rows[0].posts_count,
      followers: userQuery.rows[0].followers_count,
      following: userQuery.rows[0].following_count
    };

    res.render('profile', {
      user: userQuery.rows[0],
      currentUser: req.user,
      posts: postsQuery.rows,
      stats: stats,
      isFollowing: userQuery.rows[0].is_following
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).send('Failed to load profile');
  }
});

// Followers page
router.get('/profile/:username/followers', ensureAuthenticated, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get user data
    const userQuery = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    
    const user = userQuery.rows[0];
    
    // Get followers
    const followersQuery = await pool.query(
      `SELECT u.*, 
      EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $2
      ORDER BY f.created_at DESC`,
      [req.user.id, user.id]
    );
    
    const followers = followersQuery.rows;
    
    res.render('follow-list', { 
      user,
      currentUser: req.user,
      listType: 'followers',
      users: followers
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Following page
router.get('/profile/:username/following', ensureAuthenticated, async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get user data
    const userQuery = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).render('error', { message: 'User not found' });
    }
    
    const user = userQuery.rows[0];
    
    // Get following
    const followingQuery = await pool.query(
      `SELECT u.*, 
      EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $2
      ORDER BY f.created_at DESC`,
      [req.user.id, user.id]
    );
    
    const following = followingQuery.rows;
    
    res.render('follow-list', { 
      user,
      currentUser: req.user,
      listType: 'following',
      users: following
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.get('/messages', ensureAuthenticated, async (req, res) => {
  try {
    // Check if messages table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'messages'
      );
    `);
    
    let contacts = [];
    
    // Get user's contacts (people they follow)
    if (tableCheck.rows[0].exists) {
      // If messages table exists, include message data
      contacts = await pool.query(
        `SELECT u.id, u.username, u.avatar,
        (SELECT content FROM messages 
         WHERE (sender_id = $1 AND receiver_id = u.id) 
         OR (sender_id = u.id AND receiver_id = $1)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages 
         WHERE (sender_id = $1 AND receiver_id = u.id) 
         OR (sender_id = u.id AND receiver_id = $1)
         ORDER BY created_at DESC LIMIT 1) as last_message_time
        FROM users u
        INNER JOIN follows f ON f.following_id = u.id
        WHERE f.follower_id = $1
        AND u.id NOT IN (SELECT blocked_id FROM blocked_users WHERE blocker_id = $1)
        AND u.id NOT IN (SELECT blocker_id FROM blocked_users WHERE blocked_id = $1)
        ORDER BY last_message_time DESC NULLS LAST`,
        [req.user.id]
      );
    } else {
      // If messages table doesn't exist yet, just get contacts without message data
      contacts = await pool.query(
        `SELECT u.id, u.username, u.avatar
        FROM users u
        INNER JOIN follows f ON f.following_id = u.id
        WHERE f.follower_id = $1
        ORDER BY u.username`,
        [req.user.id]
      );
    }

    res.render('messages', {
      user: req.user,
      contacts: contacts.rows
    });
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).send('Error loading messages');
  }
});

// Root route
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

module.exports = router;
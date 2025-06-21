const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// Get settings page
router.get('/settings', ensureAuthenticated, async (req, res) => {
  try {
    // Get user data with privacy setting
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.session.user.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.redirect('/logout');
    }
    
    const user = userResult.rows[0];
    
    res.render('settings', {
      user,
      currentUser: req.session.user,
      message: req.flash ? (req.flash('success')[0] || req.flash('error')[0]) : null
    });
  } catch (err) {
    console.error('Error loading settings:', err);
    res.status(500).render('error', { message: 'Failed to load settings' });
  }
});

// Update privacy settings
router.post('/settings/privacy', ensureAuthenticated, async (req, res) => {
  try {
    const { isPrivate } = req.body;
    const isPrivateValue = isPrivate === 'true' || isPrivate === true;
    
    // Update user privacy setting
    await pool.query(
      'UPDATE users SET is_private = $1 WHERE id = $2',
      [isPrivateValue, req.session.user.id]
    );
    
    req.flash('success', 'Privacy settings updated successfully');
    res.redirect('/settings');
  } catch (err) {
    console.error('Error updating privacy settings:', err);
    req.flash('error', 'Failed to update privacy settings');
    res.redirect('/settings');
  }
});

// Change password
router.post('/settings/password', ensureAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/settings');
    }
    
    // Get current user password
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.session.user.id]
    );
    
    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/settings');
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    
    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/settings');
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedNewPassword, req.session.user.id]
    );
    
    req.flash('success', 'Password changed successfully');
    res.redirect('/settings');
  } catch (err) {
    console.error('Error changing password:', err);
    req.flash('error', 'Failed to change password');
    res.redirect('/settings');
  }
});

// Delete account
router.post('/settings/delete-account', ensureAuthenticated, async (req, res) => {
  try {
    const { password } = req.body;
    
    // Verify password
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.session.user.id]
    );
    
    if (userResult.rows.length === 0) {
      req.flash('error', 'User not found');
      return res.redirect('/settings');
    }
    
    const isMatch = await bcrypt.compare(password, userResult.rows[0].password);
    
    if (!isMatch) {
      req.flash('error', 'Incorrect password');
      return res.redirect('/settings');
    }
    
    // Delete user account (will cascade to posts, comments, etc.)
    await pool.query(
      'DELETE FROM users WHERE id = $1',
      [req.session.user.id]
    );
    
    // Destroy session
    req.session.destroy();
    res.redirect('/login?deleted=true');
  } catch (err) {
    console.error('Error deleting account:', err);
    req.flash('error', 'Failed to delete account');
    res.redirect('/settings');
  }
});

module.exports = router;
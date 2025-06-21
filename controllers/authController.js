const { pool } = require('../server');
const bcrypt = require('bcryptjs');

module.exports = {
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      // Check if user exists
      const userExists = await pool.query(
        'SELECT * FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (userExists.rows.length > 0) {
        req.flash('error', 'Username or email already exists');
        return res.redirect('/register');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await pool.query(
        'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, hashedPassword]
      );

      // Automatically log in the new user
      req.login(newUser.rows[0], (err) => {
        if (err) {
          req.flash('error', 'Registration successful but login failed');
          return res.redirect('/login');
        }
        return res.redirect('/dashboard');
      });

    } catch (err) {
      console.error(err);
      }
    },

    logout: (req, res) => {
      req.logout(() => {
        res.redirect('/');
      });
    }
};
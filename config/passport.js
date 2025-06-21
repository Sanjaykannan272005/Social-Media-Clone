const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

module.exports = (passport, pool) => {
  // Serialization
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialization
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [id]);
      done(null, result.rows[0]);
    } catch (err) {
      done(err);
    }
  });

  // Local strategy
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        
        if (!user) return done(null, false, { message: 'Email not found' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Password incorrect' });
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
};
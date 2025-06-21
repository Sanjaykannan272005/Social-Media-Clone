const { pool } = require('../db');
const CryptoJS = require('crypto-js');

module.exports = {
  createPost: async (userId, content) => {
    const encryptedContent = CryptoJS.AES.encrypt(
      content, 
      process.env.ENCRYPTION_SECRET
    ).toString();
    
    const result = await pool.query(
      `INSERT INTO posts (user_id, content, is_encrypted)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, encryptedContent, true]
    );
    
    return result.rows[0];
  },
  
  getPosts: async (userId) => {
    const posts = await pool.query(
      `SELECT p.*, u.username 
       FROM posts p
       JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC`
    );
    
    return posts.rows.map(post => {
      if (post.is_encrypted) {
        post.content = CryptoJS.AES.decrypt(
          post.content,
          process.env.ENCRYPTION_SECRET
        ).toString(CryptoJS.enc.Utf8);
      }
      return post;
    });
  }
};
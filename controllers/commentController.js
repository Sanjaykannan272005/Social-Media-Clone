const pool = require('../db');

exports.getComments = async (req, res) => {
    try {
        const { postId } = req.params;
        
        const commentsQuery = await pool.query(
            `SELECT c.*, u.username, u.avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = $1
            ORDER BY c.created_at DESC`,
            [postId]
        );
        
        res.json(commentsQuery.rows);
    } catch (err) {
        console.error('Error getting comments:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
};

exports.createComment = async (req, res) => {
    try {
        const { content, postId } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content cannot be empty' });
        }
        
        const result = await pool.query(
            'INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, postId, content]
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
        
        res.status(201).json(newComment);
    } catch (err) {
        console.error('Error creating comment:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if comment exists and belongs to user
        const commentCheck = await pool.query(
            'SELECT * FROM comments WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        
        if (commentCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }
        
        // Delete comment
        await pool.query('DELETE FROM comments WHERE id = $1', [id]);
        
        res.json({ message: 'Comment deleted successfully' });
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ error: 'Server Error', details: err.message });
    }
};
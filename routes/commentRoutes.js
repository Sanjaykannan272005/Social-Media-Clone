const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

router.get('/:postId', commentController.getComments);
router.post('/', ensureAuthenticated, commentController.createComment);
router.delete('/:id', ensureAuthenticated, commentController.deleteComment);

module.exports = router;
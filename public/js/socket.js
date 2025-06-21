const socket = io();

// Handle new posts
socket.on('addPost', (post) => {
  if (document.getElementById('postList')) {
    const postList = document.getElementById('postList');
    const postElement = createPostElement(post);
    postList.prepend(postElement);
    updateStats();
  }
});

// Handle new comments
socket.on('addComment', (comment) => {
  const commentSection = document.getElementById(`comments-${comment.post_id}`);
  if (commentSection) {
    const commentElement = createCommentElement(comment);
    commentSection.appendChild(commentElement);
  }
});

// Handle like updates
socket.on('updateLikes', (data) => {
  const likeBtn = document.querySelector(`.like-btn[data-id="${data.postId}"]`);
  if (likeBtn) {
    likeBtn.innerHTML = `<i class="${data.liked ? 'fas' : 'far'} fa-heart"></i> ${data.likes}`;
    if (data.liked) {
      likeBtn.querySelector('i').style.color = '#e74c3c';
    } else {
      likeBtn.querySelector('i').style.color = '';
    }
  }
});

function createPostElement(post) {
  // Implementation to create post DOM element
}

function createCommentElement(comment) {
  // Implementation to create comment DOM element
}

function updateStats() {
  // Implementation to update stats
}
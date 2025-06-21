document.addEventListener('DOMContentLoaded', function() {
    const postForm = document.getElementById('postForm');
    const mediaUpload = document.getElementById('mediaUpload');
    const mediaFileName = document.getElementById('mediaFileName');
    const mediaPreview = document.getElementById('mediaPreview');
    const imagePreview = document.getElementById('imagePreview');
    const videoPreview = document.getElementById('videoPreview');
    const removeMedia = document.getElementById('removeMedia');
    const feed = document.getElementById('feed');
    const loadingFeed = document.getElementById('loadingFeed');
    
    // Get current user ID from the page
    const currentUserId = document.querySelector('meta[name="user-id"]')?.content;
    console.log('Current user ID:', currentUserId);
    
    // Edit post modal elements
    const editPostModalElement = document.getElementById('editPostModal');
    console.log('Edit post modal element:', editPostModalElement);
    
    let editPostModal;
    if (editPostModalElement) {
        editPostModal = new bootstrap.Modal(editPostModalElement, {
            keyboard: false
        });
    } else {
        console.error('Edit post modal element not found');
    }
    const editPostForm = document.getElementById('editPostForm');
    const editPostContent = document.getElementById('editPostContent');
    let currentEditingPostId = null;
    
    // Handle media file selection
    mediaUpload.addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            mediaFileName.textContent = file.name;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                if (file.type.startsWith('image/')) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                    videoPreview.style.display = 'none';
                } else if (file.type.startsWith('video/')) {
                    videoPreview.src = e.target.result;
                    videoPreview.style.display = 'block';
                    imagePreview.style.display = 'none';
                }
                mediaPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Remove selected media
    removeMedia.addEventListener('click', function() {
        mediaUpload.value = '';
        mediaFileName.textContent = '';
        mediaPreview.style.display = 'none';
        imagePreview.src = '';
        videoPreview.src = '';
    });
    
    // Handle post submission
    postForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const content = document.getElementById('postContent').value.trim();
        if (!content && !mediaUpload.files[0]) {
            alert('Please enter some content or add media to post.');
            return;
        }
        
        const formData = new FormData();
        formData.append('content', content);
        
        if (mediaUpload.files[0]) {
            formData.append('media', mediaUpload.files[0]);
        }
        
        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const post = await response.json();
                // Reset form
                postForm.reset();
                mediaFileName.textContent = '';
                mediaPreview.style.display = 'none';
                
                // Add new post to feed
                addPostToFeed(post, true);
            } else {
                const error = await response.json();
                alert('Error creating post: ' + (error.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error creating post:', err);
            alert('Error creating post. Please try again.');
        }
    });
    
    // Handle edit post form submission
    if (editPostForm) {
        editPostForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!currentEditingPostId) {
                console.error('No post ID set for editing');
                return;
            }
            
            const content = editPostContent.value.trim();
            if (!content) {
                alert('Post content cannot be empty.');
                return;
            }
            
            try {
                console.log('Updating post:', currentEditingPostId, 'with content:', content);
                
                const response = await fetch(`/api/posts/${currentEditingPostId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content })
                });
                
                console.log('Update response status:', response.status);
                
                if (response.ok) {
                    const updatedPost = await response.json();
                    console.log('Post updated successfully:', updatedPost);
                    
                    // Update post in the UI
                    const postElement = document.querySelector(`[data-post-id="${currentEditingPostId}"]`);
                    if (postElement) {
                        const contentElement = postElement.querySelector('.card-text');
                        contentElement.textContent = updatedPost.content;
                    } else {
                        console.error('Post element not found in DOM after update');
                    }
                    
                    // Close modal
                    editPostModal.hide();
                } else {
                    const errorText = await response.text();
                    console.error('Error response:', errorText);
                    try {
                        const error = JSON.parse(errorText);
                        alert('Error updating post: ' + (error.error || 'Unknown error'));
                    } catch (e) {
                        alert('Error updating post: Server error');
                    }
                }
            } catch (err) {
                console.error('Error updating post:', err);
                alert('Error updating post. Please try again.');
            }
        });
    }
    
    // Load feed on page load
    loadFeed();
    
    // Set up event delegation for post actions
    document.addEventListener('click', function(e) {
        // Edit post button
        if (e.target.classList.contains('edit-post-btn') || e.target.closest('.edit-post-btn')) {
            e.preventDefault();
            const btn = e.target.classList.contains('edit-post-btn') ? e.target : e.target.closest('.edit-post-btn');
            const postId = btn.dataset.postId;
            editPost(postId);
        }
        
        // Delete post button
        if (e.target.classList.contains('delete-post-btn') || e.target.closest('.delete-post-btn')) {
            e.preventDefault();
            const btn = e.target.classList.contains('delete-post-btn') ? e.target : e.target.closest('.delete-post-btn');
            const postId = btn.dataset.postId;
            deletePost(postId);
        }
    });
    
    async function loadFeed() {
        try {
            console.log('Loading feed...');
            const response = await fetch('/api/posts');
            if (response.ok) {
                const posts = await response.json();
                console.log('Posts loaded:', posts.length);
                loadingFeed.style.display = 'none';
                
                if (posts.length === 0) {
                    feed.innerHTML = '<div class="alert alert-info">No posts yet. Be the first to post!</div>';
                } else {
                    feed.innerHTML = '';
                    posts.forEach(post => {
                        console.log('Adding post to feed:', post.id);
                        addPostToFeed(post);
                    });
                }
            } else {
                const errorData = await response.json();
                console.error('API error:', errorData);
                loadingFeed.style.display = 'none';
                feed.innerHTML = '<div class="alert alert-danger">Failed to load feed. Please refresh the page.</div>';
            }
        } catch (err) {
            console.error('Error loading feed:', err);
            loadingFeed.style.display = 'none';
            feed.innerHTML = '<div class="alert alert-danger">Failed to load feed. Please refresh the page.</div>';
        }
    }
    
    function addPostToFeed(post, prepend = false) {
        const postElement = document.createElement('div');
        postElement.className = 'card mb-3';
        postElement.dataset.postId = post.id;
        
        // Prepare media HTML if post has media
        let mediaHtml = '';
        if (post.media_url) {
            if (post.media_type === 'image') {
                mediaHtml = `<img src="${post.media_url}" class="card-img-top" alt="Post image">`;
            } else if (post.media_type === 'video') {
                mediaHtml = `<video src="${post.media_url}" class="card-img-top" controls></video>`;
            }
        }
        
        // Create post HTML
        postElement.innerHTML = `
            <div class="card-body">
                <div class="d-flex mb-3">
                    <img src="${post.avatar || '/images/default-avatar.png'}" class="rounded-circle me-2" width="40" height="40">
                    <div>
                        <a href="/profile/${post.username}" class="fw-bold text-decoration-none text-dark">${post.username}</a>
                        <div class="text-muted small">${new Date(post.created_at).toLocaleString()}</div>
                    </div>
                    ${post.user_id == currentUserId ? `
                        <div class="dropdown ms-auto">
                            <button class="btn btn-sm btn-link text-muted" type="button" data-bs-toggle="dropdown">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item edit-post-btn" href="#" data-post-id="${post.id}">Edit</a></li>
                                <li><a class="dropdown-item delete-post-btn" href="#" data-post-id="${post.id}">Delete</a></li>
                            </ul>
                        </div>
                    ` : ''}
                </div>
                <p class="card-text">${post.content}</p>
                ${mediaHtml}
                <div class="d-flex mt-3">
                    <button class="btn btn-sm btn-outline-secondary me-2 like-btn" data-post-id="${post.id}">
                        <i class="${post.user_liked ? 'fas' : 'far'} fa-heart" ${post.user_liked ? 'style="color: #e74c3c;"' : ''}></i> <span>${post.likes_count || 0}</span>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary me-2 comment-btn" data-post-id="${post.id}">
                        <i class="far fa-comment"></i> <span>${post.comments ? post.comments.length : 0}</span>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary share-btn" data-post-id="${post.id}">
                        <i class="far fa-share-square"></i>
                    </button>
                </div>
            </div>
            <div class="card-footer comments-section" style="display: none;">
                <form class="comment-form mb-3" data-post-id="${post.id}">
                    <div class="input-group">
                        <input type="text" class="form-control" placeholder="Write a comment..." required>
                        <button class="btn btn-primary" type="submit">Reply</button>
                    </div>
                </form>
                <div class="comments-container">
                    ${post.comments && post.comments.length > 0 ? 
                        post.comments.map(comment => `
                            <div class="d-flex mb-2">
                                <img src="${comment.avatar || '/images/default-avatar.png'}" class="rounded-circle me-2" width="32" height="32">
                                <div class="p-2 bg-light rounded">
                                    <div class="fw-bold">${comment.username}</div>
                                    <div>${comment.content}</div>
                                    <div class="text-muted small">${new Date(comment.created_at).toLocaleString()}</div>
                                </div>
                            </div>
                        `).join('') : 
                        '<div class="text-muted text-center py-2">No comments yet</div>'
                    }
                </div>
            </div>
        `;
        
        // Add event listeners
        const likeBtn = postElement.querySelector(`.like-btn[data-post-id="${post.id}"]`);
        likeBtn.addEventListener('click', () => toggleLike(post.id));
        
        const commentBtn = postElement.querySelector(`.comment-btn[data-post-id="${post.id}"]`);
        commentBtn.addEventListener('click', () => toggleComments(post.id));
        
        const commentForm = postElement.querySelector(`.comment-form[data-post-id="${post.id}"]`);
        commentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitComment(e, post.id);
        });
        
        // Add to feed
        if (prepend) {
            feed.prepend(postElement);
        } else {
            feed.appendChild(postElement);
        }
    }
    
    // Toggle like on a post
    async function toggleLike(postId) {
        try {
            const response = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const result = await response.json();
                const likeBtn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
                const likeCount = likeBtn.querySelector('span');
                const likeIcon = likeBtn.querySelector('i');
                
                if (result.liked) {
                    likeIcon.classList.remove('far');
                    likeIcon.classList.add('fas');
                    likeIcon.style.color = '#e74c3c';
                } else {
                    likeIcon.classList.remove('fas');
                    likeIcon.classList.add('far');
                    likeIcon.style.color = '';
                }
                
                // Update like count
                likeCount.textContent = parseInt(likeCount.textContent) + (result.liked ? 1 : -1);
            }
        } catch (err) {
            console.error('Error toggling like:', err);
        }
    }
    
    // Toggle comments section visibility
    function toggleComments(postId) {
        const post = document.querySelector(`[data-post-id="${postId}"]`);
        const commentsSection = post.querySelector('.comments-section');
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    }
    
    // Submit a comment
    async function submitComment(event, postId) {
        const input = event.target.querySelector('input');
        const content = input.value.trim();
        
        if (!content) return;
        
        try {
            const response = await fetch(`/api/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            
            if (response.ok) {
                const comment = await response.json();
                input.value = '';
                
                // Add comment to UI
                const commentsContainer = document.querySelector(`[data-post-id="${postId}"] .comments-container`);
                const noCommentsMsg = commentsContainer.querySelector('.text-muted.text-center');
                if (noCommentsMsg) {
                    commentsContainer.innerHTML = '';
                }
                
                const commentElement = document.createElement('div');
                commentElement.className = 'd-flex mb-2';
                commentElement.innerHTML = `
                    <img src="${comment.avatar || '/images/default-avatar.png'}" class="rounded-circle me-2" width="32" height="32">
                    <div class="p-2 bg-light rounded">
                        <div class="fw-bold">${comment.username}</div>
                        <div>${comment.content}</div>
                        <div class="text-muted small">Just now</div>
                    </div>
                `;
                
                commentsContainer.prepend(commentElement);
                
                // Update comment count
                const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
                const commentCount = commentBtn.querySelector('span');
                commentCount.textContent = parseInt(commentCount.textContent) + 1;
            }
        } catch (err) {
            console.error('Error submitting comment:', err);
        }
    }
    
    // Edit post
    async function editPost(postId) {
        try {
            console.log('Editing post:', postId);
            
            // Get post content
            const postElement = document.querySelector(`[data-post-id="${postId}"]`);
            if (!postElement) {
                console.error('Post element not found:', postId);
                return;
            }
            
            const postContent = postElement.querySelector('.card-text').textContent;
            console.log('Post content:', postContent);
            
            // Set current editing post ID
            currentEditingPostId = postId;
            
            // Set content in edit form
            editPostContent.value = postContent;
            
            // Show modal
            if (editPostModal) {
                editPostModal.show();
            } else {
                console.error('Edit post modal not found');
            }
        } catch (err) {
            console.error('Error editing post:', err);
        }
    }
    
    // Delete post
    async function deletePost(postId) {
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove post from UI
                const postElement = document.querySelector(`[data-post-id="${postId}"]`);
                if (postElement) {
                    postElement.remove();
                }
            } else {
                const error = await response.json();
                alert('Error deleting post: ' + (error.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Error deleting post:', err);
            alert('Error deleting post. Please try again.');
        }
    }
});
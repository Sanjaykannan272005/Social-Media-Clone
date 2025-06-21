document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearchInput');
    const searchResults = document.getElementById('searchResults');
    
    // Search as you type with debounce
    let debounceTimer;
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(performSearch, 300); // 300ms delay to avoid too many requests
    });
    
    // Search when Enter key is pressed
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(debounceTimer);
            performSearch();
        }
    });
    
    // Perform search
    async function performSearch() {
        const query = searchInput.value.trim();
        
        // Clear results if query is empty
        if (query.length === 0) {
            searchResults.innerHTML = '';
            return;
        }
        
        // Show message for very short queries but don't return
        if (query.length === 1) {
            searchResults.innerHTML = '<p class="text-muted small p-2">Keep typing to search...</p>';
            return;
        }
        
        // Show loading indicator
        searchResults.innerHTML = `
            <div class="text-center py-2">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                    <span class="visually-hidden">Searching...</span>
                </div>
            </div>
        `;
        
        try {
            const response = await fetch(`/api/search/users?query=${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error('Search failed');
            }
            
            const users = await response.json();
            
            if (users.length === 0) {
                searchResults.innerHTML = '<p class="text-muted small">No users found</p>';
                return;
            }
            
            // Display results
            searchResults.innerHTML = '';
            users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'border-bottom p-2';
                
                userElement.innerHTML = `
                    <div class="d-flex align-items-center">
                        <img src="${user.avatar || '/images/default-avatar.png'}" class="rounded-circle me-2" width="40" height="40" alt="${user.username}">
                        <div>
                            <div class="d-flex align-items-center">
                                <a href="/profile/${user.username}" class="text-decoration-none">
                                    <strong>${user.username}</strong>
                                </a>
                                ${user.is_verified ? '<i class="fas fa-check-circle text-primary ms-1" style="font-size: 0.8rem;"></i>' : ''}
                            </div>
                            <small class="text-muted">${user.bio ? user.bio.substring(0, 30) + (user.bio.length > 30 ? '...' : '') : ''}</small>
                        </div>
                        <div class="ms-auto">
                            <button class="btn btn-sm ${user.is_following ? 'btn-primary' : 'btn-outline-primary'} follow-btn" 
                                    data-user-id="${user.id}" 
                                    data-following="${user.is_following}">
                                ${user.is_following ? 'Following' : 'Follow'}
                            </button>
                        </div>
                    </div>
                `;
                
                searchResults.appendChild(userElement);
                
                // Add event listener to follow button
                const followBtn = userElement.querySelector('.follow-btn');
                followBtn.addEventListener('click', function() {
                    toggleFollow(user.id, followBtn);
                });
            });
            
        } catch (err) {
            console.error('Search error:', err);
            searchResults.innerHTML = '<p class="text-danger">Failed to search users. Please try again.</p>';
        }
    }
    
    // Toggle follow/unfollow
    async function toggleFollow(userId, button) {
        const isFollowing = button.getAttribute('data-following') === 'true';
        
        try {
            const response = await fetch(`/api/users/${userId}/follow`, {
                method: isFollowing ? 'DELETE' : 'POST'
            });
            
            if (!response.ok) {
                throw new Error('Failed to update follow status');
            }
            
            // Update button state
            button.setAttribute('data-following', !isFollowing);
            button.textContent = !isFollowing ? 'Following' : 'Follow';
            button.classList.toggle('btn-primary');
            button.classList.toggle('btn-outline-primary');
            
        } catch (err) {
            console.error('Follow error:', err);
            alert('Failed to update follow status. Please try again.');
        }
    }
});
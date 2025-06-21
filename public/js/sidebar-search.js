// Sidebar Search Functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebarSearchInput = document.getElementById('sidebarSearchInput');
    const sidebarSearchResults = document.getElementById('sidebarSearchResults');
    const defaultAvatar = '/images/default-avatar.png';
    let searchTimeout;

    if (sidebarSearchInput) {
        sidebarSearchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            // Hide results if query is too short
            if (query.length < 2) {
                sidebarSearchResults.innerHTML = '';
                sidebarSearchResults.style.display = 'none';
                return;
            }
            
            // Show loading indicator
            sidebarSearchResults.innerHTML = '<div class="sidebar-search-result-item">Searching...</div>';
            sidebarSearchResults.style.display = 'block';
            
            // Debounce search requests
            searchTimeout = setTimeout(async function() {
                try {
                    const response = await fetch(`/api/search/users?query=${encodeURIComponent(query)}`);
                    if (!response.ok) throw new Error('Search failed');
                    
                    const users = await response.json();
                    
                    // Display results
                    if (!Array.isArray(users) || users.length === 0) {
                        sidebarSearchResults.innerHTML = '<div class="sidebar-search-result-item">No users found</div>';
                    } else {
                        sidebarSearchResults.innerHTML = users.map(user => `
                            <div class="sidebar-search-result-item">
                                <img src="${user.avatar || defaultAvatar}" 
                                     alt="${user.username}" 
                                     class="avatar-small"
                                     onerror="this.src='${defaultAvatar}'">
                                <div class="user-info">
                                    <a href="/profile/${user.username}" class="username">
                                        @${user.username} ${user.is_verified ? '✓' : ''}
                                    </a>
                                    <div class="bio">${user.bio || ''}</div>
                                </div>
                                <button onclick="toggleSidebarFollow(${user.id}, this)" 
                                        class="follow-btn ${user.is_following ? 'following' : ''}" 
                                        data-userid="${user.id}">
                                    ${user.is_following ? 'Following' : 'Follow'}
                                </button>
                            </div>
                        `).join('');
                    }
                } catch (err) {
                    console.error('Search error:', err);
                    sidebarSearchResults.innerHTML = '<div class="sidebar-search-result-item">Error performing search</div>';
                }
            }, 300);
        });

        // Close search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!sidebarSearchInput.contains(e.target) && !sidebarSearchResults.contains(e.target)) {
                sidebarSearchResults.style.display = 'none';
            }
        });
    }
});

// Follow/unfollow from sidebar
function toggleSidebarFollow(userId, button) {
    const isFollowing = button.classList.contains('following');
    
    fetch(`/api/users/${userId}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            button.classList.toggle('following');
            button.textContent = isFollowing ? 'Follow' : 'Following';
            
            // Add animation effect
            const parent = button.closest('.sidebar-search-result-item');
            parent.style.transition = 'background-color 0.3s';
            parent.style.backgroundColor = 'rgba(29, 161, 242, 0.1)';
            setTimeout(() => {
                parent.style.backgroundColor = '';
            }, 300);
        }
    })
    .catch(err => {
        console.error('Follow error:', err);
    });
}
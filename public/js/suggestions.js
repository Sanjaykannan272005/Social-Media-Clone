document.addEventListener('DOMContentLoaded', function() {
    loadSuggestedUsers();
});

async function loadSuggestedUsers() {
    try {
        const response = await fetch('/api/users/suggestions');
        if (!response.ok) throw new Error('Failed to load suggestions');
        
        const users = await response.json();
        const container = document.getElementById('suggestedUsers');
        
        if (users.length === 0) {
            container.innerHTML = '<div class="text-center py-3 text-muted">No suggestions available</div>';
            return;
        }
        
        container.innerHTML = '';
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'p-3 border-bottom';
            
            userElement.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${user.avatar || '/images/default-avatar.png'}" class="rounded-circle me-2" width="40" height="40" alt="${user.username}">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center">
                            <a href="/profile/${user.username}" class="text-decoration-none">
                                <strong>${user.username}</strong>
                            </a>
                            ${user.is_verified ? '<i class="fas fa-check-circle text-primary ms-1" style="font-size: 0.8rem;"></i>' : ''}
                        </div>
                        <small class="text-muted">${user.bio ? user.bio.substring(0, 30) + (user.bio.length > 30 ? '...' : '') : ''}</small>
                    </div>
                    <button class="btn btn-sm ${user.is_following ? 'btn-primary' : 'btn-outline-primary'} follow-btn" 
                            data-user-id="${user.id}" data-following="${user.is_following}">
                        ${user.is_following ? 'Following' : 'Follow'}
                    </button>
                </div>
            `;
            
            container.appendChild(userElement);
            
            // Add follow functionality
            const followBtn = userElement.querySelector('.follow-btn');
            followBtn.addEventListener('click', function() {
                followUser(user.id, followBtn);
            });
        });
        
    } catch (err) {
        console.error('Error loading suggestions:', err);
        document.getElementById('suggestedUsers').innerHTML = 
            '<div class="text-center py-3 text-danger">Failed to load suggestions</div>';
    }
}

async function followUser(userId, button) {
    try {
        const isFollowing = button.getAttribute('data-following') === 'true';
        
        const response = await fetch(`/api/users/${userId}/follow`, {
            method: isFollowing ? 'DELETE' : 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to update follow status');
        
        button.setAttribute('data-following', !isFollowing);
        button.textContent = !isFollowing ? 'Following' : 'Follow';
        button.classList.toggle('btn-primary');
        button.classList.toggle('btn-outline-primary');
        
    } catch (err) {
        console.error('Follow error:', err);
        alert('Failed to update follow status. Please try again.');
    }
}
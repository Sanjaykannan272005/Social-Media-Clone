document.addEventListener('DOMContentLoaded', function() {
    const userId = document.querySelector('.follow-header h1').dataset.userId;
    const listType = document.querySelector('.follow-tabs .active').dataset.type;
    
    loadUsers(userId, listType);
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            const query = this.value.trim();
            filterUsers(query);
        }, 300));
    }
});

async function loadUsers(userId, type) {
    try {
        const followList = document.querySelector('.follow-list');
        followList.innerHTML = '<div class="loading">Loading...</div>';
        
        const response = await fetch(`/api/users/${userId}/${type}`);
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        
        if (users.length === 0) {
            followList.innerHTML = `
                <div class="no-follows">
                    <i class="fas fa-user-friends"></i>
                    <p>No ${type} yet</p>
                </div>
            `;
            return;
        }
        
        followList.innerHTML = '';
        
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'follow-item';
            userElement.dataset.username = user.username.toLowerCase();
            
            userElement.innerHTML = `
                <div class="follow-user-info">
                    <img src="${user.avatar || '/images/default-avatar.png'}" alt="${user.username}" class="follow-avatar">
                    <div class="follow-details">
                        <div class="follow-name">
                            ${user.username}
                            ${user.is_verified ? '<i class="fas fa-check-circle verified-icon"></i>' : ''}
                        </div>
                        <div class="follow-bio">${user.bio || ''}</div>
                    </div>
                </div>
                <div class="follow-actions">
                    ${currentUserId !== user.id ? 
                        `<button onclick="toggleFollow('${user.id}', this)" class="follow-btn ${user.is_following ? 'following' : ''}">
                            ${user.is_following ? 'Following' : 'Follow'}
                        </button>` : 
                        ''}
                </div>
            `;
            
            followList.appendChild(userElement);
        });
    } catch (err) {
        console.error(`Error loading ${type}:`, err);
        document.querySelector('.follow-list').innerHTML = `
            <div class="error-message">
                Failed to load ${type}. Please try again later.
            </div>
        `;
    }
}

function filterUsers(query) {
    const items = document.querySelectorAll('.follow-item');
    
    if (!query) {
        items.forEach(item => item.style.display = 'flex');
        return;
    }
    
    query = query.toLowerCase();
    
    items.forEach(item => {
        const username = item.dataset.username;
        if (username.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

async function toggleFollow(userId, button) {
    try {
        const isFollowing = button.classList.contains('following');
        
        const response = await fetch(`/api/users/${userId}/follow`, {
            method: isFollowing ? 'DELETE' : 'POST'
        });

        if (response.ok) {
            button.classList.toggle('following');
            button.textContent = isFollowing ? 'Follow' : 'Following';
        }
    } catch (err) {
        console.error('Follow error:', err);
    }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
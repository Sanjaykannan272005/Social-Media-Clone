document.addEventListener('DOMContentLoaded', function() {
    // Bio editing functionality
    const bioElement = document.querySelector('.bio');
    const editProfileBtn = document.querySelector('.edit-profile-btn');
    
    if (editProfileBtn && bioElement) {
        editProfileBtn.addEventListener('click', toggleEditMode);
    }
    
    function toggleEditMode() {
        const bio = document.querySelector('.bio');
        if (bio.contentEditable === 'true') {
            // Save changes
            saveBio(bio.textContent);
            bio.contentEditable = 'false';
            bio.classList.remove('editing');
            editProfileBtn.textContent = 'Edit Profile';
        } else {
            bio.contentEditable = 'true';
            bio.classList.add('editing');
            bio.focus();
            editProfileBtn.textContent = 'Save Profile';
        }
    }
    
    async function saveBio(content) {
        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio: content })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update bio');
            }
            
            console.log('Bio updated successfully');
        } catch (err) {
            console.error('Error updating bio:', err);
            alert('Failed to update bio. Please try again.');
        }
    }
    
    // Avatar upload functionality
    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarChange);
    }
    
    async function handleAvatarChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check file size (limit to 1MB)
        if (file.size > 1 * 1024 * 1024) {
            alert('Image size must be less than 1MB');
            return;
        }
        
        // Show loading status
        const statusElement = document.getElementById('avatarUploadStatus');
        if (statusElement) {
            statusElement.textContent = 'Uploading...';
            statusElement.style.display = 'block';
            statusElement.style.color = '#1da1f2';
        }
        
        // Create a canvas to resize the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions (max 150x150)
            let width = img.width;
            let height = img.height;
            const maxSize = 150;
            
            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            
            // Resize image
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get resized image as data URL with reduced quality
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // Preview the image
            const avatarImage = document.getElementById('avatarImage');
            if (avatarImage) {
                avatarImage.src = resizedDataUrl;
                
                // Update the avatar in the database
                updateAvatarInDatabase(resizedDataUrl, statusElement);
            }
        };
        
        // Read the file as data URL
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    async function updateAvatarInDatabase(dataUrl, statusElement) {
        try {
            console.log('Sending avatar update request...');
            const response = await fetch('/api/profile/avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatarUrl: dataUrl })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update avatar');
            }
            
            console.log('Avatar updated successfully');
            
            // Update status
            if (statusElement) {
                statusElement.textContent = 'Avatar updated!';
                statusElement.style.color = 'green';
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 3000);
            }
            
            // Update the sidebar avatar as well
            const sidebarAvatar = document.querySelector('.profile-section .profile-pic');
            if (sidebarAvatar) {
                sidebarAvatar.src = dataUrl;
            }
        } catch (err) {
            console.error('Error updating avatar:', err);
            
            // Update status
            if (statusElement) {
                statusElement.textContent = 'Failed to update avatar';
                statusElement.style.color = 'red';
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 3000);
            }
        }
    }
});
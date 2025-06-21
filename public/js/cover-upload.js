document.addEventListener('DOMContentLoaded', function() {
    console.log('Cover upload script loaded');
    
    // Cover photo upload functionality
    const coverInput = document.getElementById('coverInput');
    if (coverInput) {
        console.log('Cover input found, adding event listener');
        coverInput.addEventListener('change', handleCoverChange);
    } else {
        console.log('Cover input not found');
    }
    
    async function handleCoverChange(e) {
        console.log('Cover input changed');
        const file = e.target.files[0];
        if (!file) return;
        
        // Check file size (limit to 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size must be less than 2MB');
            return;
        }
        
        // Show loading status
        const coverPhoto = document.querySelector('.cover-photo');
        if (coverPhoto) {
            coverPhoto.classList.add('uploading');
        }
        
        // Preview the image immediately
        const coverImage = document.getElementById('coverImage');
        if (coverImage) {
            const reader = new FileReader();
            reader.onload = function(e) {
                coverImage.src = e.target.result;
                
                // Create a resized version for upload
                resizeAndUploadCover(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }
    
    function resizeAndUploadCover(dataUrl) {
        // Create a canvas to resize the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = function() {
            // Calculate new dimensions (maintain aspect ratio, max width 800px)
            let width = img.width;
            let height = img.height;
            const maxWidth = 800;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            // Resize image
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get resized image as data URL with reduced quality
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
            
            // Update the cover in the database
            updateCoverInDatabase(resizedDataUrl);
        };
        
        img.src = dataUrl;
    }
    
    async function updateCoverInDatabase(dataUrl) {
        try {
            console.log('Sending cover update request...');
            const response = await fetch('/api/profile/cover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coverUrl: dataUrl })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update cover image');
            }
            
            console.log('Cover image updated successfully');
            
            // Remove loading state
            const coverPhoto = document.querySelector('.cover-photo');
            if (coverPhoto) {
                coverPhoto.classList.remove('uploading');
            }
            
        } catch (err) {
            console.error('Error updating cover image:', err);
            alert('Failed to update cover image. Please try again.');
            
            // Remove loading state
            const coverPhoto = document.querySelector('.cover-photo');
            if (coverPhoto) {
                coverPhoto.classList.remove('uploading');
            }
        }
    }
});
document.addEventListener('DOMContentLoaded', () => {
    // Handle new post submission
    const postForm = document.getElementById('postForm');
    postForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('postContent').value;
      
      try {
        const response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content })
        });
        
        if (response.ok) {
          location.reload(); // Refresh to show new post
        } else {
          alert('Failed to create post');
        }
      } catch (err) {
        console.error('Error:', err);
        alert('Error creating post');
      }
    });
  
    // Handle like button clicks
    document.querySelectorAll('.like-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const postId = e.currentTarget.getAttribute('data-id');
        
        try {
          const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST'
          });
          
          if (response.ok) {
            const result = await response.json();
            const icon = e.currentTarget.querySelector('i');
            e.currentTarget.innerHTML = `<i class="far fa-heart"></i> ${result.likes}`;
            
            // Toggle heart color
            if (icon.classList.contains('far')) {
              icon.classList.replace('far', 'fas');
              icon.style.color = '#e74c3c';
            } else {
              icon.classList.replace('fas', 'far');
              icon.style.color = '';
            }
          }
        } catch (err) {
          console.error('Error:', err);
        }
      });
    });
  });
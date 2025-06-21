let currentPage = 1;
const postsContainer = document.getElementById('postList');
const loadMoreBtn = document.getElementById('loadMore');

async function loadPosts(page) {
  try {
    const response = await fetch(`/api/posts?page=${page}`);
    const data = await response.json();
    
    data.posts.forEach(post => {
      const postElement = createPostElement(post);
      postsContainer.appendChild(postElement);
    });
    
    currentPage = data.pagination.currentPage;
    
    if (!data.pagination.hasNext) {
      loadMoreBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('Error loading posts:', err);
  }
}

loadMoreBtn.addEventListener('click', () => {
  loadPosts(currentPage + 1);
});

// Initial load
loadPosts(1);
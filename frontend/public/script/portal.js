// ==========================================
// 1. ROUTE GUARD & SESSION CHECK
// ==========================================
const sessionToken = localStorage.getItem('authToken');

if (!sessionToken && window.location.pathname !== '/index.html') {
    window.location.href = '/index.html';
}

const API_BASE = 'http://localhost:3000/api/portal';

// ==========================================
// 2. DOM CONTENT LOADED & INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadPublicPosts();

    // Theme Toggle Listener
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Refresh Sync Listener
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadPublicPosts();
            showToast('sync_complete', 'success');
        });
    }

    // New Post Form Submission Listener
    const postForm = document.getElementById('postForm');
    if (postForm) {
        postForm.addEventListener('submit', handleCreatePost);
    }
});

// ==========================================
// 3. THEME MANAGEMENT
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const themeText = document.getElementById('themeText');

    if (savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeText) themeText.textContent = 'DARK_MODE';
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeText) themeText.textContent = 'LIGHT_MODE';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const themeText = document.getElementById('themeText');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    if (newTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeText) themeText.textContent = 'DARK_MODE';
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeText) themeText.textContent = 'LIGHT_MODE';
    }

    localStorage.setItem('theme', newTheme);
}

// ==========================================
// 4. FETCH AND RENDER PUBLIC POSTS (GET)
// ==========================================
async function loadPublicPosts() {
    const postsContainer = document.getElementById('portalFeed');
    const template = document.getElementById('postTemplate');
    const totalPostsElem = document.getElementById('totalPosts');

    if (!postsContainer || !template) return;

    try {
        const response = await fetch(`${API_BASE}/public-portal/posts`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('authToken');
            window.location.href = '/index.html';
            return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`Server error (${response.status}) when loading posts.`);
            postsContainer.innerHTML = '<p class="error-text">status // 500_invalid_response</p>';
            return;
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.posts)) {
            postsContainer.innerHTML = '<p class="error-text">status // query_failed</p>';
            return;
        }

        postsContainer.innerHTML = '';

        // Update Stats Bar
        if (totalPostsElem) {
            totalPostsElem.textContent = data.posts.length;
        }

        if (data.posts.length === 0) {
            postsContainer.innerHTML = '<p class="empty-text">stream // no_active_nodes</p>';
            return;
        }

        data.posts.forEach(post => {
            const clone = template.content.cloneNode(true);
            const linkElem = clone.querySelector('.portalLink');
            
            if (linkElem) {
                linkElem.href = post.url;
                linkElem.textContent = post.url;
            }

            postsContainer.appendChild(clone);
        });

    } catch (err) {
        console.error('Error fetching public portal posts:', err);
        postsContainer.innerHTML = '<p class="error-text">status // network_unreachable</p>';
    }
}

// ==========================================
// 5. CREATE NEW POST (POST)
// ==========================================
async function handleCreatePost(event) {
    event.preventDefault();

    const urlInput = document.getElementById('linkInput');
    const submitBtn = document.getElementById('postBtn');
    const url = urlInput ? urlInput.value.trim() : '';

    if (!url) {
        showToast('err // missing_target_url', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'executing...';
        }

        const response = await fetch(`${API_BASE}/public-portal/post`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.error || 'err // execution_failed', 'error');
            return;
        }

        if (urlInput) urlInput.value = '';
        showToast('status // published_successfully', 'success');
        loadPublicPosts();

    } catch (err) {
        console.error('Error posting link:', err);
        showToast('err // transmission_error', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'execute_publish';
        }
    }
}

// ==========================================
// 6. TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

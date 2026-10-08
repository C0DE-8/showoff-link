document.addEventListener('DOMContentLoaded', async () => {
  // Inject CSS styles for the action button into the document head
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    .showoff-btn {
      margin-top: 24px;
      padding: 12px 28px;
      font-size: 0.95rem;
      font-weight: 600;
      color: #ffffff;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border: none;
      border-radius: 30px;
      cursor: pointer;
      transition: all 0.25s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
      outline: none;
    }
    .showoff-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
      opacity: 0.95;
    }
    .showoff-btn:active {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(styleTag);

  const storyViewport = document.getElementById('storyViewport');
  const quoteText = document.getElementById('quoteText');
  const loader = document.getElementById('loader');
  const progressFill = document.getElementById('progressFill');

  // Error Overlay Elements
  const errorStage = document.getElementById('errorStage');
  const errorIcon = document.getElementById('errorIcon');
  const errorTitle = document.getElementById('errorTitle');
  const errorSubtitle = document.getElementById('errorSubtitle');

  const DURATION_MS = 25000; 

  // Get note ID from query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const noteId = urlParams.get('viewId');

  if (!noteId) {
    showErrorScreen('Invalid Link', 'No note identifier provided.');
    return;
  }

  // Optional Auth Header
  const token = localStorage.getItem('authToken');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let registered = false;

  // Register view count update & redirect to dashboard
  const registerAndViewFinished = async () => {
    if (registered) return;
    registered = true;

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API.note}/register-view/${noteId}`);
      } else {
        await fetch(`${API.note}/register-view/${noteId}`, { method: 'POST' });
      }
    } catch (e) {
      console.error('Failed to register view:', e);
    } finally {
      window.location.href = './dashboard.html';
    }
  };

  // Helper function to force browser to load and decode image before rendering
  const preloadImage = (src) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  try {
    const response = await fetch(`${API.note}/read-note/${noteId}`, { headers });
    const data = await response.json();

    if (!response.ok) {
      // Handle error status codes
      if (response.status === 410) {
        showErrorScreen('Payload Purged', 'This quote reached its view limit and has self-destructed.');
      } else if (response.status === 403) {
        showErrorScreen('Access Restricted', data.error || 'You are not the authorized viewer for this note.');
      } else if (response.status === 404) {
        showErrorScreen('Not Found', 'This note does not exist or has been deleted.');
      } else {
        showErrorScreen('Unavailable', data.error || 'Failed to open note.');
      }
      return;
    }

    // Determine target skin image URL
    const imageUrl = data.skin_image ? data.skin_image : './skins/Out.jpg';

    // 1. Wait for skin image to fully load before revealing content
    await preloadImage(imageUrl);

    // 2. Set Background Skin Image
    storyViewport.style.backgroundImage = `url('${imageUrl}')`;

    // 3. Render Note Text & Hide Loader
    quoteText.textContent = `"${data.note_content}"`;
    loader.style.display = 'none';
    quoteText.style.display = 'block';

    // 4. Trigger Progress Fill Animation & Start Countdown
    progressFill.classList.add('active');

    setTimeout(() => {
      registerAndViewFinished();
    }, DURATION_MS);

    // Backup: If user closes tab before time expires
    window.addEventListener('beforeunload', () => {
      if (!registered) {
        registered = true;
        navigator.sendBeacon(`${API.note}/register-view/${noteId}`);
      }
    });

  } catch (err) {
    showErrorScreen('Connection Error', 'Unable to connect to vault server.');
  }

  function showErrorScreen(title, subtitle, icon = '') {
    loader.style.display = 'none';
    errorIcon.textContent = icon;
    errorTitle.textContent = title;
    errorSubtitle.textContent = subtitle;
    errorStage.style.display = 'flex';

    // Dynamically append the redirect button if it doesn't exist
    let actionBtn = document.getElementById('showoffActionBtn');
    if (!actionBtn) {
      actionBtn = document.createElement('button');
      actionBtn.id = 'showoffActionBtn';
      actionBtn.className = 'showoff-btn';
      actionBtn.textContent = ' Start Creating Showoff Links now!';
      actionBtn.addEventListener('click', () => {
        window.location.href = './index.html';
      });
      errorStage.appendChild(actionBtn);
    }
  }
});
document.addEventListener('DOMContentLoaded', async () => {
  const storyViewport = document.getElementById('storyViewport');
  const quoteText = document.getElementById('quoteText');
  const loader = document.getElementById('loader');
  const progressFill = document.getElementById('progressFill');

  // Error Overlay Elements
  const errorStage = document.getElementById('errorStage');
  const errorIcon = document.getElementById('errorIcon');
  const errorTitle = document.getElementById('errorTitle');
  const errorSubtitle = document.getElementById('errorSubtitle');

  const DURATION_MS = 15000; // 15 seconds

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
        navigator.sendBeacon(`http://localhost:3000/api/note/register-view/${noteId}`);
      } else {
        await fetch(`http://localhost:3000/api/note/register-view/${noteId}`, { method: 'POST' });
      }
    } catch (e) {
      console.error('Failed to register view:', e);
    } finally {
      window.location.href = '/dashboard.html';
    }
  };

  try {
    const response = await fetch(`http://localhost:3000/api/note/read-note/${noteId}`, { headers });
    const data = await response.json();

    if (!response.ok) {
      // 410: Reached limit / self-destructed -> Show notification & redirect to dashboard
      if (response.status === 410) {
        showErrorScreen('Payload Purged', 'This quote reached its view limit. Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 3000);
      } else if (response.status === 403) {
        showErrorScreen('Access Restricted', data.error || 'Unauthorized reader.');
      } else if (response.status === 404) {
        showErrorScreen('Not Found', 'This note does not exist or has been deleted.');
      } else {
        showErrorScreen('Unavailable', data.error || 'Failed to open note.');
      }
      return;
    }

    // Set Background Skin Image using base64 data payload from updated read-note route
    if (data.skin_image) {
      storyViewport.style.backgroundImage = `url('${data.skin_image}')`;
    } else {
      storyViewport.style.backgroundImage = "url('/skins/Out.jpg')";
    }

    // Render Note Text
    quoteText.textContent = `"${data.note_content}"`;
    loader.style.display = 'none';
    quoteText.style.display = 'block';

    // Trigger 35s Instagram Loader Animation
    progressFill.classList.add('active');

    // Automatically trigger self-destruct registration & redirect after 35s
    setTimeout(() => {
      registerAndViewFinished();
    }, DURATION_MS);

    // Backup: If user closes tab before 35s completes
    window.addEventListener('beforeunload', () => {
      if (!registered) {
        registered = true;
        navigator.sendBeacon(`http://localhost:3000/api/note/register-view/${noteId}`);
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
  }
});

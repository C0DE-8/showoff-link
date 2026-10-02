const API_BASE = 'http://localhost:3000/api/audio';
const urlParams = new URLSearchParams(window.location.search);
const viewId = urlParams.get('viewId');
const token = localStorage.getItem('authToken');
let audio = null;

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
};

document.addEventListener("DOMContentLoaded", () => {
  // Inject clean dark-mode styles for the expired/error card layout
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    .expired-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      text-align: center;
    }
    .expired-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .expired-subtitle {
      font-size: 0.9rem;
      color: #8e8e93;
      margin-bottom: 24px;
      line-height: 1.4;
    }
    .showoff-btn {
      padding: 13px 26px;
      font-size: 0.95rem;
      font-weight: 600;
      color: #ffffff;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.25s ease;
      box-shadow: 0 4px 15px rgba(168, 85, 247, 0.35);
      outline: none;
    }
    .showoff-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(168, 85, 247, 0.55);
      opacity: 0.95;
    }
    .showoff-btn:active {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(styleTag);

  if (!viewId) {
    showFatal("Link Invalid", "Missing voice note identification token.");
    return;
  }
  setupStream();
});

async function setupStream() {
  try {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const streamUrl = `${API_BASE}/stream-voice/${viewId}${token ? `?token=${token}` : ''}`;
    const response = await fetch(streamUrl, { headers });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        showFatal("Access Restricted", data.error || "This voice note was not intended for your account.");
      } else if (response.status === 410) {
        showFatal("Payload Expired", "This voice note reached its viewing limit and self-destructed.");
      } else if (response.status === 404) {
        showFatal("Link Expired", "This voice note does not exist or has already been purged.");
      } else {
        showFatal("Unavailable", data.error || "Database access denied.");
      }
      return;
    }

    const skinImage = response.headers.get('X-Skin-Image');

    if (skinImage && skinImage.trim() !== '') {
      if (skinImage.startsWith('data:') || skinImage.startsWith('http') || skinImage.startsWith('/')) {
        document.body.style.backgroundImage = `url('${skinImage}')`;
      } else {
        document.body.style.backgroundImage = `url('/Skins/${skinImage}')`;
      }
    } else {
      document.body.style.backgroundImage = "url('./Skins/Sad.jpg')";
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    audio = new Audio(audioUrl);

    audio.addEventListener('loadedmetadata', () => {
      const playBtn = document.getElementById('play');
      const durationEl = document.getElementById('duration');
      const loader = document.getElementById('loader');
      const panel = document.getElementById('panel');

      if (playBtn) playBtn.disabled = false;
      if (durationEl) durationEl.innerText = formatTime(audio.duration);

      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 400);
      }
      if (panel) panel.classList.add('ready');
    });

    audio.addEventListener('timeupdate', () => {
      const currentEl = document.getElementById('current');
      if (currentEl) currentEl.innerText = formatTime(audio.currentTime);
    });

    audio.addEventListener('error', () => {
      showFatal("Playback Error", "Failed to stream or decode audio payload.");
    });

    audio.addEventListener('ended', burnPayload);

    const playBtn = document.getElementById('play');
    if (playBtn) {
      playBtn.addEventListener('click', toggle);
    }
  } catch (e) {
    showFatal("Connection Sync Error", "Unable to establish secure stream channel.");
  }
}

function toggle() {
  const btn = document.getElementById('play');
  const wave = document.getElementById('wave');
  if (!btn || !wave || !audio) return;

  if (audio.paused) {
    audio.play();
    btn.innerHTML = ICONS.pause;
    wave.classList.add('active');
  } else {
    audio.pause();
    btn.innerHTML = ICONS.play;
    wave.classList.remove('active');
  }
}

async function burnPayload() {
  const btn = document.getElementById('play');
  const wave = document.getElementById('wave');
  const label = document.getElementById('statusLabel');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = ICONS.lock;
  }
  if (wave) wave.classList.remove('active');
  if (label) {
    label.className = "status destructing";
    label.innerText = "☣️ Purging voice note...";
  }

  try {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${API_BASE}/register-play/${viewId}`, { method: 'POST', headers });
  } catch (e) {
    console.error(e);
  }

  setTimeout(() => {
    window.location.href = "./dashboard.html";
  }, 3000);
}

function formatTime(secs) {
  if (isNaN(secs)) return "--:--";
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function showFatal(title, subtitle = '') {
  const loader = document.getElementById('loader');
  const panel = document.getElementById('panel');

  if (loader) loader.remove();

  if (panel) {
    panel.classList.add('ready');
    panel.style.opacity = '1';
    
    // Replace player elements cleanly inside panel without banner/red styling
    panel.innerHTML = `
      <div class="expired-card-content">
        <div class="expired-title">${title}</div>
        <div class="expired-subtitle">${subtitle}</div>
        <button id="showoffActionBtn" class="showoff-btn"> Start Creating Showoff Links now!</button>
      </div>
    `;

    document.getElementById('showoffActionBtn').addEventListener('click', () => {
      window.location.href = './index.html';
    });
  }
}
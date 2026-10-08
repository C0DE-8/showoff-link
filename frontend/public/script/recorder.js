const API_BASE = API.audio;
const token = localStorage.getItem('authToken');

if (!token) {
  window.location.href = './index.html';
}

let mediaRecorder;
let audioChunks = [];
let audioBlob;
let audioUrl;
let audioPlayInstance;
let recordingTimer;
let secondsElapsed = 0;

// SVG Icons for state changes
const ICONS = {
  mic: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
  stop: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
  play: `<svg class="icon-svg" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
};

document.addEventListener("DOMContentLoaded", () => {
  setupUIInteractions();
  setupThemeEngine();
});

function setupUIInteractions() {
  const recordBtn = document.getElementById('recordBtn');
  const playBtn = document.getElementById('playBtn');
  const clearBtn = document.getElementById('clearBtn');
  const uploadForm = document.getElementById('uploadForm');
  const copyBtn = document.getElementById('copyBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');

  recordBtn.addEventListener('click', toggleRecording);
  playBtn.addEventListener('click', previewAudio);
  clearBtn.addEventListener('click', discardAudio);
  uploadForm.addEventListener('submit', uploadPayload);
  copyBtn.addEventListener('click', copyShareableUrl);
  
  uploadTriggerBtn.addEventListener('click', () => {
    document.getElementById('configModal').classList.add('active');
  });
  
  closeModalBtn.addEventListener('click', () => {
    document.getElementById('configModal').classList.remove('active');
  });
}

async function toggleRecording() {
  const recordBtn = document.getElementById('recordBtn');
  const MAX_RECORDING_SECONDS = 300; // 5 minutes limit
  
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordBtn.classList.remove('recording');
    recordBtn.innerHTML = ICONS.mic;
    clearInterval(recordingTimer);
  } else {
    audioChunks = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

      mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioUrl = URL.createObjectURL(audioBlob);
        
        // Stop all tracks to release hardware microphone
        stream.getTracks().forEach(track => track.stop());

        // Enable preview controls safely
        document.getElementById('playBtn').disabled = false;
        document.getElementById('clearBtn').disabled = false;
        document.getElementById('resultContainer').style.display = 'none';
        
        // Reveal manual upload trigger button
        document.getElementById('uploadTriggerBtn').classList.add('visible');
      };

      mediaRecorder.start();
      
      recordBtn.classList.add('recording');
      recordBtn.innerHTML = ICONS.stop;
      
      secondsElapsed = 0;
      updateTimerDisplay();
      
      recordingTimer = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();

        // Check if maximum duration (5 minutes) is reached
        if (secondsElapsed >= MAX_RECORDING_SECONDS) {
          mediaRecorder.stop();
          recordBtn.classList.remove('recording');
          recordBtn.innerHTML = ICONS.mic;
          clearInterval(recordingTimer);
          triggerToast("Maximum recording limit of 5 minutes reached.", "error");
        }
      }, 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        triggerToast("Microphone access was denied in browser permissions.", "error");
      } else {
        triggerToast("Unable to access microphone device.", "error");
      }
    }
  }
}


function previewAudio() {
  if (audioUrl) {
    const playBtn = document.getElementById('playBtn');
    if (audioPlayInstance && !audioPlayInstance.paused) {
      audioPlayInstance.pause();
      playBtn.innerHTML = ICONS.play;
    } else {
      audioPlayInstance = new Audio(audioUrl);
      audioPlayInstance.play();
      playBtn.innerHTML = ICONS.pause;
      audioPlayInstance.onended = () => playBtn.innerHTML = ICONS.play;
    }
  }
}

function discardAudio() {
  audioBlob = null;
  audioUrl = null;
  audioChunks = [];
  if (audioPlayInstance) audioPlayInstance.pause();
  
  const playBtn = document.getElementById('playBtn');
  playBtn.disabled = true;
  playBtn.innerHTML = ICONS.play;

  document.getElementById('clearBtn').disabled = true;
  document.getElementById('timer').innerText = "00:00";
  
  document.getElementById('uploadTriggerBtn').classList.remove('visible');
  document.getElementById('configModal').classList.remove('active');
  
  triggerToast("Voice cache discarded.", "success");
}

function updateTimerDisplay() {
  const minutes = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
  const seconds = (secondsElapsed % 60).toString().padStart(2, '0');
  document.getElementById('timer').innerText = `${minutes}:${seconds}`;
}

async function uploadPayload(e) {
  e.preventDefault();
  if (!audioBlob) return;

  const btn = document.getElementById('submitPayloadBtn');
  btn.disabled = true;
  btn.innerText = "Encrypting Stream...";

  const formData = new FormData();
  formData.append('audio', audioBlob, 'voiceNote.webm'); 
  formData.append('allowed_plays', document.getElementById('allowedPlays').value);
  formData.append('recipient_tagname', document.getElementById('recipientTag').value);

  try {
    const res = await fetch(`${API_BASE}/upload-voice`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    const data = await res.json();

    if (res.ok) {
      triggerToast("Secure envelope generated!", "success");
      document.getElementById('resultContainer').style.display = 'block';
      document.getElementById('shareableUrl').value = data.shareableUrl;
    } else {
      triggerToast(data.error || "Failed to process audio payload.", "error");
    }
  } catch (err) {
    triggerToast("Network server gateway timeout.", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Process and Upload Envelope";
  }
}

function copyShareableUrl() {
  const urlField = document.getElementById('shareableUrl');
  urlField.select();
  navigator.clipboard.writeText(urlField.value);
  triggerToast("Secure destination copied!", "success");
}

function triggerToast(message, type = 'error') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}

function setupThemeEngine() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const btn = document.getElementById('themeBtn');
  if (btn) {const API_BASE = API.audio;
const token = localStorage.getItem('authToken');

// Redirect if no token is found
if (!token) {
  window.location.href = './index.html';
}

let mediaRecorder;
let audioChunks = [];
let audioBlob;
let audioUrl;
let audioPlayInstance;
let recordingTimer;
let secondsElapsed = 0;

// SVG Icons for state changes
const ICONS = {
  mic: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
  stop: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
  play: `<svg class="icon-svg" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  pause: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
};

document.addEventListener("DOMContentLoaded", () => {
  setupUIInteractions();
  setupThemeEngine();
});

function setupUIInteractions() {
  const recordBtn = document.getElementById('recordBtn');
  const playBtn = document.getElementById('playBtn');
  const clearBtn = document.getElementById('clearBtn');
  const uploadForm = document.getElementById('uploadForm');
  const copyBtn = document.getElementById('copyBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');

  recordBtn.addEventListener('click', toggleRecording);
  playBtn.addEventListener('click', previewAudio);
  clearBtn.addEventListener('click', discardAudio);
  uploadForm.addEventListener('submit', uploadPayload);
  copyBtn.addEventListener('click', copyShareableUrl);
  
  uploadTriggerBtn.addEventListener('click', () => {
    document.getElementById('configModal').classList.add('active');
  });
  
  closeModalBtn.addEventListener('click', () => {
    document.getElementById('configModal').classList.remove('active');
  });
}

async function toggleRecording() {
  const recordBtn = document.getElementById('recordBtn');
  const MAX_RECORDING_SECONDS = 300; // 5 minutes limit
  
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordBtn.classList.remove('recording');
    recordBtn.innerHTML = ICONS.mic;
    clearInterval(recordingTimer);
  } else {
    audioChunks = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

      mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioUrl = URL.createObjectURL(audioBlob);
        
        // Stop all tracks to release hardware microphone
        stream.getTracks().forEach(track => track.stop());

        // Enable preview controls safely
        document.getElementById('playBtn').disabled = false;
        document.getElementById('clearBtn').disabled = false;
        document.getElementById('resultContainer').style.display = 'none';
        
        // Reveal manual upload trigger button
        document.getElementById('uploadTriggerBtn').classList.add('visible');
      };

      mediaRecorder.start();
      
      recordBtn.classList.add('recording');
      recordBtn.innerHTML = ICONS.stop;
      
      // FIX ADDED HERE: Clear any rogue timers before starting a new one
      clearInterval(recordingTimer); 
      secondsElapsed = 0;
      updateTimerDisplay();
      
      recordingTimer = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();

        // Check if maximum duration (5 minutes) is reached
        if (secondsElapsed >= MAX_RECORDING_SECONDS) {
          mediaRecorder.stop();
          recordBtn.classList.remove('recording');
          recordBtn.innerHTML = ICONS.mic;
          clearInterval(recordingTimer);
          triggerToast("Maximum recording limit of 5 minutes reached.", "error");
        }
      }, 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        triggerToast("Microphone access was denied in browser permissions.", "error");
      } else {
        triggerToast("Unable to access microphone device.", "error");
      }
    }
  }
}

function previewAudio() {
  if (audioUrl) {
    const playBtn = document.getElementById('playBtn');
    if (audioPlayInstance && !audioPlayInstance.paused) {
      audioPlayInstance.pause();
      playBtn.innerHTML = ICONS.play;
    } else {
      audioPlayInstance = new Audio(audioUrl);
      audioPlayInstance.play();
      playBtn.innerHTML = ICONS.pause;
      audioPlayInstance.onended = () => playBtn.innerHTML = ICONS.play;
    }
  }
}

function discardAudio() {
  audioBlob = null;
  audioUrl = null;
  audioChunks = [];
  if (audioPlayInstance) audioPlayInstance.pause();
  
  const playBtn = document.getElementById('playBtn');
  playBtn.disabled = true;
  playBtn.innerHTML = ICONS.play;

  document.getElementById('clearBtn').disabled = true;
  document.getElementById('timer').innerText = "00:00";
  
  document.getElementById('uploadTriggerBtn').classList.remove('visible');
  document.getElementById('configModal').classList.remove('active');
  
  triggerToast("Voice cache discarded.", "success");
}

function updateTimerDisplay() {
  const minutes = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
  const seconds = (secondsElapsed % 60).toString().padStart(2, '0');
  document.getElementById('timer').innerText = `${minutes}:${seconds}`;
}

async function uploadPayload(e) {
  e.preventDefault();
  if (!audioBlob) return;

  const btn = document.getElementById('submitPayloadBtn');
  btn.disabled = true;
  btn.innerText = "Encrypting Stream...";

  const formData = new FormData();
  formData.append('audio', audioBlob, 'voiceNote.webm'); 
  formData.append('allowed_plays', document.getElementById('allowedPlays').value);
  formData.append('recipient_tagname', document.getElementById('recipientTag').value);

  try {
    const res = await fetch(`${API_BASE}/upload-voice`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    const data = await res.json();

    if (res.ok) {
      triggerToast("Secure envelope generated!", "success");
      document.getElementById('resultContainer').style.display = 'block';
      document.getElementById('shareableUrl').value = data.shareableUrl;
    } else {
      triggerToast(data.error || "Failed to process audio payload.", "error");
    }
  } catch (err) {
    triggerToast("Network server gateway timeout.", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Process and Upload Envelope";
  }
}

function copyShareableUrl() {
  const urlField = document.getElementById('shareableUrl');
  urlField.select();
  navigator.clipboard.writeText(urlField.value);
  triggerToast("Secure destination copied!", "success");
}

function triggerToast(message, type = 'error') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  
  // Trigger reflow for animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}

function setupThemeEngine() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.innerHTML = savedTheme === 'light' 
      ? `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode`
      : `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> Light Mode`;

    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      btn.innerHTML = newTheme === 'light' 
        ? `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode`
        : `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> Light Mode`;
    });
  }
}
    btn.innerHTML = savedTheme === 'light' 
      ? `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode`
      : `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> Light Mode`;

    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      btn.innerHTML = newTheme === 'light' 
        ? `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode`
        : `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> Light Mode`;
    });
  }
}
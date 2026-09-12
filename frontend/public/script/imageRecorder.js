// Base Configuration Constants
const ENCRYPTION_API_TARGET = 'http://localhost:3000/api/image'; 
const sessionToken = localStorage.getItem('authToken');

// Session verification gate
if (!sessionToken && window.location.pathname !== '/index.html') {
  window.location.href = '/index.html';
}

// Track file selection in global scope for form submission
let targetedFile = null;

// Guarantees DOM is fully parsed before event mapping runs
document.addEventListener("DOMContentLoaded", () => {
  initializeCardEngine();
  initializeThemeCore();
});

/**
 * Attaches structural DOM element handlers and event hooks
 */
function initializeCardEngine() {
  const interactionBox = document.getElementById('interactionBox');
  const fileInput = document.getElementById('graphicAsset');
  const uploadForm = document.getElementById('vaultUploadForm');
  const clearBtn = document.getElementById('clearAssetBtn');
  const copyBtn = document.getElementById('copyUrlBtn');

  // Prevent crashes by validating structural nodes exist first
  if (!interactionBox || !fileInput) return;

  // Let the invisible stretched input capture native click selections cleanly
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processFileTarget(e.target.files[0]);
  });

  // Drag-and-drop mechanics
  interactionBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    interactionBox.classList.add('drag-active');
  });

  ['dragleave', 'dragend'].forEach(evt => {
    interactionBox.addEventListener(evt, () => interactionBox.classList.remove('drag-active'));
  });

  interactionBox.addEventListener('drop', (e) => {
    e.preventDefault();
    interactionBox.classList.remove('drag-active');
    if (e.dataTransfer.files.length > 0) {
      processFileTarget(e.dataTransfer.files[0]);
      fileInput.files = e.dataTransfer.files; // Synchronize file state into DOM node
    }
  });

  if (clearBtn) clearBtn.addEventListener('click', wipeSelectedAsset);
  if (uploadForm) uploadForm.addEventListener('submit', dispatchAssetPayload);
  if (copyBtn) copyBtn.addEventListener('click', handleClipboardCopy);
}

/**
 * Validates the file target type and sets up the live preview stream
 */
function processFileTarget(file) {
  if (!file || !file.type.startsWith('image/')) {
    displayNotification("Invalid asset specification. Target file must be an image.", "err");
    return;
  }

  targetedFile = file;

  // Read file data stream to generate live UI preview source
  const parser = new FileReader();
  parser.onload = (e) => {
    const previewImg = document.getElementById('renderPreview');
    const overlay = document.getElementById('previewOverlay');
    if (previewImg && overlay) {
      previewImg.src = e.target.result;
      overlay.style.display = 'flex';
    }
  };
  parser.readAsDataURL(file);

  const clearAssetBtn = document.getElementById('clearAssetBtn');
  const executeUploadBtn = document.getElementById('executeUploadBtn');
  const envelopeResult = document.getElementById('envelopeResult');

  if (clearAssetBtn) clearAssetBtn.disabled = false;
  if (executeUploadBtn) executeUploadBtn.disabled = false;
  if (envelopeResult) envelopeResult.style.display = 'none';
}

/**
 * Resets the entire interactive graphic asset card state
 */
function wipeSelectedAsset() {
  targetedFile = null;
  
  const fileInput = document.getElementById('graphicAsset');
  const overlay = document.getElementById('previewOverlay');
  const previewImg = document.getElementById('renderPreview');
  const clearAssetBtn = document.getElementById('clearAssetBtn');
  const executeUploadBtn = document.getElementById('executeUploadBtn');
  const envelopeResult = document.getElementById('envelopeResult');

  if (fileInput) fileInput.value = "";
  if (overlay) overlay.style.display = 'none';
  if (previewImg) previewImg.src = "";
  if (clearAssetBtn) clearAssetBtn.disabled = true;
  if (executeUploadBtn) executeUploadBtn.disabled = true;
  if (envelopeResult) envelopeResult.style.display = 'none';
  
  displayNotification("Asset workspace initialized.", "succ");
}

/**
 * Formats multi-part data structures and handles backend payload routing
 */
async function dispatchAssetPayload(e) {
  e.preventDefault();
  if (!targetedFile) return;

  const actionBtn = document.getElementById('executeUploadBtn');
  if (actionBtn) {
    actionBtn.disabled = true;
    actionBtn.innerText = "Encrypting...";
  }

  // Pack variables into standard multipart form fields
  const dataPayload = new FormData();
  dataPayload.append('graphicAsset', targetedFile);
  
  const viewsInput = document.getElementById('allowedViews');
  const tagInput = document.getElementById('recipientTag');
  
  if (viewsInput) dataPayload.append('allowed_views', viewsInput.value);
  
  if (tagInput) {
    let runtimeTag = tagInput.value;
    if (runtimeTag.startsWith('@')) runtimeTag = runtimeTag.substring(1);
    dataPayload.append('recipient_tagname', runtimeTag);
  }

  try {
    // Hits exactly http://localhost:3000/api/iamge/upload-asset
    const response = await fetch(`${ENCRYPTION_API_TARGET}/upload-asset`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${sessionToken}` 
        // Note: Explicitly left content type unassigned here so the browser 
        // sets dynamic multi-part boundaries cleanly for multer memory buffers.
      },
      body: dataPayload
    });

    const bodyResponse = await response.json();

    if (response.ok) {
      displayNotification("Asset deployed inside secure container.", "succ");
      const resContainer = document.getElementById('envelopeResult');
      const urlField = document.getElementById('envelopeUrl');
      if (resContainer && urlField) {
        resContainer.style.display = 'block';
        urlField.value = bodyResponse.shareableUrl;
      }
    } else {
      displayNotification(bodyResponse.error || "Failed execution criteria.", "err");
    }
  } catch (netErr) {
    console.error("Network gateway error diagnostic info:", netErr);
    displayNotification("Network gateway failure.", "err");
  } finally {
    if (actionBtn) {
      actionBtn.disabled = false;
      actionBtn.innerText = "Deploy Asset";
    }
  }
}

/**
 * Handles raw visual clipboard saving functions
 */
function handleClipboardCopy() {
  const urlBuffer = document.getElementById('envelopeUrl');
  if (urlBuffer) {
    urlBuffer.select();
    navigator.clipboard.writeText(urlBuffer.value);
    displayNotification("Envelope link saved to clipboard.", "succ");
  }
}

/**
 * Spawns customized animated toast notifications inside the page wrapper
 */
function displayNotification(text, layoutType = 'err') {
  const dock = document.getElementById('toastBox');
  if (!dock) return;
  
  const notice = document.createElement('div');
  notice.className = `toast-node ${layoutType}`;
  notice.innerHTML = `<span>${text}</span>`;
  dock.appendChild(notice);
  
  setTimeout(() => notice.classList.add('visible'), 10);
  setTimeout(() => {
    notice.classList.remove('visible');
    notice.addEventListener('transitionend', () => notice.remove());
  }, 3500);
}

/**
 * Core light/dark page styling modifier logic
 */
function initializeThemeCore() {
  const trigger = document.getElementById('themeToggler');
  if (!trigger) return;

  const currentSelectedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentSelectedTheme);
  
  trigger.innerText = currentSelectedTheme === 'light' ? '🌙 Dark' : '☀️ Light';
  trigger.addEventListener('click', () => {
    const activeState = document.documentElement.getAttribute('data-theme');
    const alternateState = activeState === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', alternateState);
    localStorage.setItem('theme', alternateState);
    trigger.innerText = alternateState === 'light' ? '🌙 Dark' : '☀️ Light';
  });
}
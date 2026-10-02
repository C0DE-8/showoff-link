// Base Configuration Constants
const ENCRYPTION_API_TARGET = 'http://localhost:3000/api/image'; 
const sessionToken = localStorage.getItem('authToken');

// Session verification gate (Prevents infinite reload loops if already on index.html)
if (!sessionToken && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
  window.location.href = 'index.html';
}

// Track file selection in global scope
let targetedFile = null;

// Guarantees DOM is fully parsed before event mapping runs
document.addEventListener("DOMContentLoaded", () => {
  initializeCardEngine();
});

/**
 * Attaches structural DOM element handlers and event hooks
 */
function initializeCardEngine() {
  const interactionBox = document.getElementById('interactionBox');
  const fileInput = document.getElementById('graphicAsset');
  const clearBtn = document.getElementById('clearAssetBtn');
  const executeBtn = document.getElementById('executeUploadBtn');
  const copyBtn = document.getElementById('copyUrlBtn');

  // Allow clicking anywhere in the dropzone to trigger the file browser
  if (interactionBox && fileInput) {
    interactionBox.addEventListener('click', (e) => {
      if (e.target !== fileInput && e.target !== document.getElementById('renderPreview')) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) processFileTarget(e.target.files[0]);
    });

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
        fileInput.files = e.dataTransfer.files;
      }
    });
  }

  // Bind direct click events
  if (executeBtn) {
    executeBtn.type = 'button';
    executeBtn.addEventListener('click', (e) => dispatchAssetPayload(e));
  }

  if (clearBtn) {
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', wipeSelectedAsset);
  }

  if (copyBtn) {
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', handleClipboardCopy);
  }
}

/**
 * Validates the file target type and sets up the live preview stream
 */
function processFileTarget(file) {
  if (!file || !file.type.startsWith('image/')) {
    displayNotification("Target file must be a valid image format.", "err");
    return;
  }

  targetedFile = file;

  const parser = new FileReader();
  parser.onload = (e) => {
    const previewImg = document.getElementById('renderPreview');
    const overlay = document.getElementById('previewOverlay');
    if (previewImg && overlay) {
      previewImg.src = e.target.result;
      overlay.style.display = 'flex';
      
      const promptText = document.querySelector('.upload-msg');
      if (promptText) promptText.style.display = 'none';
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
  const promptText = document.querySelector('.upload-msg');

  if (fileInput) fileInput.value = "";
  if (overlay) overlay.style.display = 'none';
  if (previewImg) previewImg.src = "";
  if (promptText) promptText.style.display = 'block';
  if (clearAssetBtn) clearAssetBtn.disabled = true;
  if (executeUploadBtn) executeUploadBtn.disabled = true;
  if (envelopeResult) envelopeResult.style.display = 'none';
  
  displayNotification("Asset workspace reset.", "succ");
}

/**
 * Formats multi-part data structures and handles backend payload routing
 */
async function dispatchAssetPayload(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (!targetedFile) {
    displayNotification("Please select an image file first.", "err");
    return;
  }

  const actionBtn = document.getElementById('executeUploadBtn');
  if (actionBtn) {
    // Prevent double-clicking without disabling mid-click event loop
    actionBtn.style.pointerEvents = 'none';
    actionBtn.innerText = "Encrypting...";
  }

  const dataPayload = new FormData();
  dataPayload.append('graphicAsset', targetedFile);
  
  const viewsInput = document.getElementById('allowedViews');
  const tagInput = document.getElementById('recipientTag');
  
  if (viewsInput) {
    dataPayload.append('allowed_views', viewsInput.value);
  }
  
  if (tagInput && tagInput.value.trim() !== "") {
    let runtimeTag = tagInput.value.trim();
    if (runtimeTag.startsWith('@')) runtimeTag = runtimeTag.substring(1);
    dataPayload.append('recipient_tagname', runtimeTag);
  }

  try {
    const response = await fetch(`${ENCRYPTION_API_TARGET}/upload-asset`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${sessionToken}` 
      },
      body: dataPayload
    });

    const bodyResponse = await response.json();

    if (response.ok) {
      displayNotification("Asset successfully deployed.", "succ");
      
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
      actionBtn.style.pointerEvents = 'auto';
      actionBtn.innerHTML = `<span>upload</span><span class="btn-cost">• 2 Tokens</span>`;
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
    displayNotification("Link copied to clipboard!", "succ");
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
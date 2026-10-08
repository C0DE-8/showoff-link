// Base Configuration Constants
const ASSET_API_BASE = API.image;
const sessionToken = localStorage.getItem('authToken');

document.addEventListener("DOMContentLoaded", () => {
  executeAssetDecryptionPipeline();
});

/**
 * Fetches asset binary, renders image in original dimensions, and syncs progress bar.
 */
async function executeAssetDecryptionPipeline() {
  const urlParams = new URLSearchParams(window.location.search);
  const assetId = urlParams.get('id');

  const chillLoader = document.getElementById('chillLoader');
  const decryptedAsset = document.getElementById('decryptedAsset');
  const statusTimeline = document.getElementById('statusTimeline');

  if (!assetId) {
    terminateSessionWithError("Invalid link parameter.");
    return;
  }

  try {
    const response = await fetch(`${ASSET_API_BASE}/view-asset/${assetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken || ''}`
      }
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      
      // If link expired / limit reached, redirect after brief notice
      if (response.status === 410) {
        terminateSessionWithError("This asset reached its view limit and expired.");
        setTimeout(() => {
          window.location.href = './dashboard.html';
        }, 3000);
        return;
      }

      terminateSessionWithError(errorPayload.error || "Access authorization failed.");
      return;
    }

    const blobPayload = await response.blob();
    const objectUrl = URL.createObjectURL(blobPayload);

    decryptedAsset.src = objectUrl;

    decryptedAsset.onload = () => {
      // Hide spinner and show uncropped image
      if (chillLoader) chillLoader.style.display = 'none';
      decryptedAsset.classList.add('visible');

      // Trigger Instagram top progress bar animation
      if (statusTimeline) {
        statusTimeline.classList.add('active');
      }

      // Start 15-second timer
      beginSelfDestructSequence();
    };

  } catch (err) {
    console.error("Pipeline failure diagnostic:", err);
    terminateSessionWithError("Network connectivity failure.");
  }
}

/**
 * Runs 15-second timer, releases memory, and redirects to dashboard.
 */
function beginSelfDestructSequence() {
  const timerTick = document.getElementById('timerTick');
  let remainingTime = 15;

  const clockInterval = setInterval(() => {
    remainingTime--;
    if (timerTick) timerTick.innerText = remainingTime;

    if (remainingTime <= 0) {
      clearInterval(clockInterval);

      // Revoke memory blob
      const decryptedAsset = document.getElementById('decryptedAsset');
      if (decryptedAsset && decryptedAsset.src) {
        URL.revokeObjectURL(decryptedAsset.src);
      }

      window.location.href = './dashboard.html';
    }
  }, 1000);
}

/**
 * Handles error display cleanly inside the viewport.
 */
function terminateSessionWithError(messageText) {
  const workspace = document.getElementById('displayWorkspace');
  const chillLoader = document.getElementById('chillLoader');
  
  if (chillLoader) chillLoader.style.display = 'none';

  if (workspace) {
    workspace.innerHTML = `
      <div class="error-slate">
        <span class="error-icon">🔒</span>
        <p class="error-msg">${messageText}</p>
        <button onclick="window.location.href='./dashboard.html'" class="return-btn">Return to Dashboard</button>
      </div>
    `;
  }
}
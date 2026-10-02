

const API_BASE = 'http://localhost:3000/api/user';
const token = localStorage.getItem('authToken');

// Routing Guard Check
if (!token) {
  window.location.href = './index.html';
}

// Peer Banking Credit Gift Module
async function handleGiftTokens(e) {
  e.preventDefault();

  const recipient = document.getElementById('inpGiftRecipient').value;
  const amount = document.getElementById('inpGiftAmount').value;
  const password = document.getElementById('inpGiftPassword').value;

  toggleBtnLoading('btnGift', true, 'send');

  try {
    const res = await fetch(`${API_BASE}/gift-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipient_tagname: recipient,
        amount_to_gift: amount,
        confirm_password: password
      })
    });

    const data = await res.json();

    if (res.ok) {
      triggerToast(
        data.message || 'Tokens transferred successfully!',
        'success'
      );

      e.target.reset();

      // Safely trigger profile refresh if function exists globally
      if (typeof fetchUserProfile === 'function') {
        fetchUserProfile();
      }
    } else {
      triggerToast(
        data.error || 'Transaction block dropped by terminal.',
        'error'
      );
    }
  } catch (err) {
    console.error('Gift transaction error:', err);
    triggerToast(
      'Banking transaction pipeline failure.',
      'error'
    );
  } finally {
    toggleBtnLoading('btnGift', false, 'send');
  }
}

// UI Elements & Animation Utility Rules
function toggleBtnLoading(btnId, isLoading, defaultText) {
  const btn = document.getElementById(btnId);

  if (!btn) return;

  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `
      <span class="spinner"></span>
      <span>Verifying...</span>
    `;
  } else {
    btn.disabled = false;
    btn.innerHTML = defaultText;
  }
}

// Toast Notification Utility
function triggerToast(message, type = 'error') {
  const container = document.getElementById('toastContainer');

  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  toast.appendChild(messageSpan);
  container.appendChild(toast);

  // Trigger CSS transition
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Remove toast after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');

    toast.addEventListener(
      'transitionend',
      () => toast.remove(),
      { once: true }
    );

    // Fallback in case no CSS transition exists
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 500);
  }, 4000);
}

// Form Listener Initialization
document.addEventListener('DOMContentLoaded', () => {
  const giftForm = document.getElementById('giftForm');

  if (giftForm) {
    giftForm.addEventListener('submit', handleGiftTokens);
  }
});


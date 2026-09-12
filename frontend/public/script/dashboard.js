// System Configurations Initialization
const API_BASE = 'http://localhost:3000/api/user';
const authToken = localStorage.getItem('authToken');

// Execution Pipeline Entry Guard Check
(function verifyRouteProtection() {
  if (!authToken) {
    handleInvalidToken();
  }
})();
console.log(authToken)

document.addEventListener("DOMContentLoaded", () => {
  // Execute workspace configuration pulls
  initializeWorkspaceIdentity();
  fetchAccountBalance();
  initializeThemeEngine();

  // Attach Event Triggers
  const themeBtn = document.getElementById('themeBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const topUpBtn = document.getElementById('purchaseBtn');
  const purchaseBtn = document.getElementById('purchaseBtn');

  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (topUpBtn) topUpBtn.addEventListener('click', openTokenShop);
  if (purchaseBtn) purchaseBtn.addEventListener('click', openTokenShop);
});

// Presentation Name Delivery Module
function initializeWorkspaceIdentity() {
  const storedTag = localStorage.getItem('userTagname') || 'Agent';
  const cleanTag = storedTag.startsWith('@') ? storedTag : `@${storedTag}`;
  const displayEl = document.getElementById('userTagnameDisplay');
  if (displayEl) {
    displayEl.innerText = `Welcome Back, ${cleanTag}`;
  }
}

// Background Network Sync for Account Balances & Token Validation
async function fetchAccountBalance() {
  try {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Automatically handle expired or invalid JWT token (401 Unauthorized)
    if (res.status === 401) {
      console.warn("Session expired or token invalid. Redirecting to login...");
      handleInvalidToken();
      return;
    }

    const data = await res.json();

    if (res.ok && data && data.success && data.profile) {
      // Safely access tokens using optional chaining
      const tokenCount = data.profile.tokens !== undefined ? data.profile.tokens : 0;
      const balanceEl = document.getElementById('balanceText');
      if (balanceEl) {
        balanceEl.innerHTML = `${tokenCount} <span>Tokens</span>`;
      }
      
      // Refresh local tagname if updated on backend
      if (data.profile.tagname) {
        localStorage.setItem('userTagname', data.profile.tagname);
        initializeWorkspaceIdentity();
      }
    } else {
      console.warn("Profile retrieval failed status:", res.status, data);
      const balanceEl = document.getElementById('balanceText');
      if (balanceEl) {
        balanceEl.innerHTML = `Error <span>Tokens</span>`;
      }
    }
  } catch (err) {
    console.error("Connection dispatch pipeline failed:", err);
    const balanceEl = document.getElementById('balanceText');
    if (balanceEl) {
      balanceEl.innerHTML = `Offline <span>Tokens</span>`;
    }
  } finally {
    // Dismiss the screen loader once data processing finishes
    dismissScreenLoader();
  }
}

// Fluid Loader Dismissal Interface Animation
function dismissScreenLoader() {
  const loader = document.getElementById('dashboardLoader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.visibility = 'hidden';
    }, 400);
  }
}

/* Theme Processing Engine Rules */
function initializeThemeEngine() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButtonUI(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeButtonUI(newTheme);
}

function updateThemeButtonUI(theme) {
  const btn = document.getElementById('themeBtn');
  if (btn) {
    const isLight = theme === 'light';
    const iconSvg = isLight 
      ? `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3z"/></svg>`
      : `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>`;
    
    btn.innerHTML = `${iconSvg} ${isLight ? 'Dark Mode' : 'Light Mode'}`;
  }
}

function openTokenShop() {
  window.location.href = '/buyToken.html';
}

function handleInvalidToken() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userTagname');
  window.location.href = '/index.html';
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}
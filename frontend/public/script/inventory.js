// Session Token & Route Guard
const sessionToken = localStorage.getItem('authToken');

if (!sessionToken && window.location.pathname !== './index.html') {
  window.location.href = './index.html';
}

// API Endpoint Setup
const API_BASE = API.skin;

const grid = document.getElementById('inventory-grid');
const statusMsg = document.getElementById('status-msg');

// Display feedback banners
function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = isError ? 'status-error' : 'status-success';
  statusMsg.style.display = 'block';

  setTimeout(() => {
    statusMsg.style.display = 'none';
  }, 4000);
}

// Fetch user inventory from the server
async function fetchInventory() {
  try {
    const res = await fetch(`${API_BASE}/skins/inventory`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to load inventory.');
    }

    renderInventory(data.inventory);
  } catch (err) {
    grid.innerHTML = `<div class="state-container">${err.message}</div>`;
  }
}

// Equip a selected skin
async function equipSkin(skinId) {
  try {
    const res = await fetch(`${API_BASE}/skins/equip/${skinId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to equip skin.');
    }

    showStatus(data.message || 'Skin equipped successfully!');
    // Refresh inventory layout to show updated state
    fetchInventory();
  } catch (err) {
    showStatus(err.message, true);
  }
}

// Render cards dynamically into the grid
function renderInventory(skins) {
  if (!skins || skins.length === 0) {
    grid.innerHTML = `<div class="state-container">No skins found in your inventory.</div>`;
    return;
  }

  grid.innerHTML = skins.map(skin => `
    <div class="skin-card ${skin.is_equipped ? 'equipped' : ''}">
      ${skin.is_equipped ? '<span class="equipped-badge">Equipped</span>' : ''}
      <img 
        src="${skin.image_data || 'https://via.placeholder.com/150'}" 
        alt="${skin.name}" 
        class="skin-img"
      />
      <div class="skin-title">${skin.name}</div>
      <button 
        class="equip-btn" 
        data-id="${skin.id}" 
        ${skin.is_equipped ? 'disabled' : ''}
      >
        ${skin.is_equipped ? 'Active' : 'Equip Skin'}
      </button>
    </div>
  `).join('');

  // Attach click listeners to all equip buttons
  document.querySelectorAll('.equip-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      if (id) equipSkin(id);
    });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', fetchInventory);

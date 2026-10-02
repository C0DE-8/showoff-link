const sessionToken = localStorage.getItem('authToken');

if (!sessionToken) {
  window.location.href = '/index.html';
}

const API_BASE = 'http://localhost:3000/api/skin';

document.addEventListener('DOMContentLoaded', () => {
  loadShopAndImages();
});

async function loadShopAndImages() {
  const shopGrid = document.getElementById('shopGrid');

  try {
    // Fetch all platform skins with Base64 images and user's inventory concurrently
    const [skinsRes, inventoryRes] = await Promise.all([
      fetch(`${API_BASE}/skins/all-images`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      }),
      fetch(`${API_BASE}/skins/inventory`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
    ]);

    if (skinsRes.status === 401 || skinsRes.status === 403) {
      localStorage.removeItem('authToken');
      window.location.href = '/index.html';
      return;
    }

    const skinsData = await skinsRes.json();
    const inventoryData = await inventoryRes.json();

    if (!skinsData.success || !Array.isArray(skinsData.skins)) {
      showStatus('Failed to load skin catalog.', 'error');
      return;
    }

    // Build map of user's owned and equipped skin IDs
    const userInventory = inventoryData.inventory || [];
    const ownedSkinIds = new Set(userInventory.map(item => item.id));
    const equippedSkinId = userInventory.find(item => item.is_equipped)?.id;

    // Merge ownership state into platform skins array
    const catalog = skinsData.skins.map(skin => ({
      ...skin,
      is_owned: ownedSkinIds.has(skin.id),
      is_equipped: skin.id === equippedSkinId
    }));

    // Map out and render cards on the grid
    renderShopGrid(catalog);
  } catch (err) {
    console.error('Error fetching skins:', err);
    shopGrid.innerHTML = '<div class="empty-state">Unable to connect to skin catalog server.</div>';
  }
}

function renderShopGrid(skins) {
  const shopGrid = document.getElementById('shopGrid');
  shopGrid.innerHTML = '';

  if (skins.length === 0) {
    shopGrid.innerHTML = '<div class="empty-state">No platform skins currently available in store.</div>';
    return;
  }

  // MAP OVER ALL SKINS AND RENDER CARDS
  skins.map(skin => {
    const card = document.createElement('div');
    card.className = 'skin-card';

    let actionButtonHtml = '';

    if (skin.is_equipped) {
      actionButtonHtml = `<span class="badge-equipped">Equipped</span>`;
    } else if (skin.is_owned) {
      actionButtonHtml = `<span class="badge-owned">Owned</span>`;
    } else {
      actionButtonHtml = `
        <button class="btn-buy" data-skin-id="${escapeHtml(String(skin.id))}" data-token-cost="${Number(skin.token_cost)}">
          Buy
        </button>
      `;
    }

    // MAP Base64 image URL directly to the <img> tag
    const imageTag = skin.image_url 
      ? `<img src="${skin.image_url}" alt="${escapeHtml(skin.name)}" class="skin-img" />`
      : `<div class="skin-img-placeholder" style="color: #94a3b8; font-size: 0.85rem;">No Image Available</div>`;

    card.innerHTML = `
      <div class="skin-image-box">
        ${imageTag}
      </div>
      <div class="skin-info">
        <h3 class="skin-name">${escapeHtml(skin.name)}</h3>
        <div class="skin-bottom">
          <div class="skin-cost">
           <span>${(skin.token_cost)}</span>
            <span>token</span>
          </div>
          ${actionButtonHtml}
        </div>
      </div>
    `;

    const buyButton = card.querySelector('.btn-buy');
    if (buyButton) {
      buyButton.addEventListener('click', () => {
        buySkin(buyButton.dataset.skinId, Number(buyButton.dataset.tokenCost), buyButton);
      });
    }

    shopGrid.appendChild(card);
  });
}

async function buySkin(skinId, tokenCost, buttonElement) {
  try {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Buying...';

    const response = await fetch(`${API_BASE}/skins/buy/${skinId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showStatus(data.error || 'Purchase rejected.', 'error');
      buttonElement.disabled = false;
      buttonElement.textContent = 'Buy';
      return;
    }

    showStatus(data.message || 'Purchase successful!', 'success');
    
    // Refresh shop catalog and user ownership state
    await loadShopAndImages();
  } catch (err) {
    console.error('Purchase error:', err);
    showStatus('Failed to complete skin transaction.', 'error');
    buttonElement.disabled = false;
    buttonElement.textContent = 'Buy';
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;

  setTimeout(() => {
    statusDiv.className = 'status-message hidden';
  }, 4000);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, match => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return map[match];
  });
}

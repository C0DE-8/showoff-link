document.addEventListener('DOMContentLoaded', () => {
  console.log('[Room Hub] Initializing script...');

  // --- Auth Guard ---
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.warn('[Auth Check] No authToken found. Redirecting to login...');
    localStorage.removeItem('authToken');
    window.location.href = './index.html';
    return;
  }

  const API_BASE = 'http://localhost:3000/api/flow';

  // --- DOM Elements ---
  const toggleViewBtn = document.getElementById('toggleViewBtn');
  const createSection = document.getElementById('createSection');
  const invitesSection = document.getElementById('invitesSection');
  const createRoomForm = document.getElementById('createRoomForm');
  const modeZero = document.getElementById('modeZero');
  const modeStake = document.getElementById('modeStake');
  const totalRoundsSelect = document.getElementById('totalRounds');
  const feeDisplay = document.getElementById('feeDisplay');
  const invitesContainer = document.getElementById('invitesContainer');

  if (!createRoomForm) {
    console.error('[Error] Element <form id="createRoomForm"> was not found in the DOM!');
    return;
  }

  let activeView = 'create';

  // --- Navigation Toggle ---
  if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
      if (activeView === 'create') {
        activeView = 'invites';
        createSection?.classList.remove('active');
        invitesSection?.classList.add('active');
        toggleViewBtn.textContent = 'Create Room';
        fetchInvitations();
      } else {
        activeView = 'create';
        invitesSection?.classList.remove('active');
        createSection?.classList.add('active');
        toggleViewBtn.textContent = 'View Invitations';
      }
    });
  }

  // --- Dynamic Fee Calculation ---
  function updateFeeDisplay() {
    const selectedModeInput = document.querySelector('input[name="mode"]:checked');
    const selectedMode = selectedModeInput ? selectedModeInput.value : 'zero_stake';
    const rounds = totalRoundsSelect ? parseInt(totalRoundsSelect.value, 10) : 3;

    if (feeDisplay) {
      if (selectedMode === 'zero_stake') {
        feeDisplay.innerHTML = '<span>Required Entry Charge</span><span>2 Tokens</span>';
      } else {
        const stakeRequired = Math.ceil(rounds / 3);
        feeDisplay.innerHTML = `<span>Stake Required</span><span>${stakeRequired} Token${stakeRequired > 1 ? 's' : ''}</span>`;
      }
    }
  }

  if (modeZero && modeStake) {
    [modeZero, modeStake].forEach(modeOption => {
      modeOption.addEventListener('click', () => {
        modeZero.classList.remove('selected');
        modeStake.classList.remove('selected');
        modeOption.classList.add('selected');
        const radio = modeOption.querySelector('input');
        if (radio) radio.checked = true;
        updateFeeDisplay();
      });
    });
  }

  if (totalRoundsSelect) {
    totalRoundsSelect.addEventListener('change', updateFeeDisplay);
  }

// --- Direct POST to Create Room ---
createRoomForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('[Create Room] Submit triggered...');

  const selectedModeInput = document.querySelector('input[name="mode"]:checked');
  const mode = selectedModeInput ? selectedModeInput.value : 'zero_stake';

  const totalRounds = totalRoundsSelect
    ? parseInt(totalRoundsSelect.value, 10)
    : 3;

  const taggedFriendsInput = document.getElementById('taggedFriends');
  const taggedRaw = taggedFriendsInput ? taggedFriendsInput.value : '';

  const taggedFriends = taggedRaw
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);

  const payload = {
    mode,
    totalRounds,
    taggedFriends
  };

  console.log('[Create Room] Sending direct fetch to:', `${API_BASE}/rooms`);
  console.log('[Create Room] Payload:', payload);

  try {
    const response = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    // Read the response as text first.
    // This lets us handle JSON, plain text, HTML, etc.
    const rawResponse = await response.text();

    console.log('[Create Room] HTTP Status:', response.status);
    console.log('[Create Room] Raw Response:', rawResponse);

    let data = null;

    try {
      data = rawResponse ? JSON.parse(rawResponse) : null;
    } catch (parseError) {
      console.warn('[Create Room] Response was not valid JSON:', parseError);
    }

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('authToken');

      alert(
        `Session expired or unauthorized.\n\n` +
        `Server response: ${rawResponse || 'No response body'}`
      );

      window.location.href = './index.html';
      return;
    }

    // Handle ALL other HTTP errors
    if (!response.ok) {
      let errorMessage = '';

      if (data) {
        // Try the common error fields
        if (data.error) {
          errorMessage =
            typeof data.error === 'string'
              ? data.error
              : JSON.stringify(data.error, null, 2);
        } else if (data.message) {
          errorMessage =
            typeof data.message === 'string'
              ? data.message
              : JSON.stringify(data.message, null, 2);
        } else if (data.details) {
          errorMessage =
            typeof data.details === 'string'
              ? data.details
              : JSON.stringify(data.details, null, 2);
        } else {
          // Backend returned JSON but didn't use the usual fields
          errorMessage = JSON.stringify(data, null, 2);
        }
      } else {
        // Backend returned non-JSON
        errorMessage = rawResponse || 'No response body from server.';
      }

      console.error('[Create Room] Backend Error:', {
        status: response.status,
        statusText: response.statusText,
        response: data || rawResponse
      });

      alert(
        `Failed to create room.\n\n` +
        `HTTP ${response.status} ${response.statusText}\n\n` +
        `${errorMessage}`
      );

      return;
    }

    console.log('[Create Room] Response Received:', data);

    if (!data || !data.room || !data.room.id) {
      console.error('[Create Room] Invalid success response:', data);

      alert(
        `Room creation returned an unexpected response.\n\n` +
        `${data ? JSON.stringify(data, null, 2) : rawResponse}`
      );

      return;
    }

    // Room created successfully
    window.location.href = `./play.html?roomId=${data.room.id}`;

  } catch (err) {
    console.error('[Create Room Fetch Error]:', err);

    alert(
      `Could not connect to backend server.\n\n` +
      `Error: ${err.message}\n\n` +
      `API: ${API_BASE}/rooms`
    );
  }
});

  // --- Direct GET for Invitations ---
  async function fetchInvitations() {
    if (!invitesContainer) return;
    invitesContainer.innerHTML = '<div class="empty-state">Loading invitations...</div>';

    try {
      const response = await fetch(`${API_BASE}/invitations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('authToken');
        window.location.href = './index.html';
        return;
      }

      if (!response.ok) {
        invitesContainer.innerHTML = '<div class="empty-state">Error loading invitations.</div>';
        return;
      }

      const invites = await response.json();

      if (!Array.isArray(invites) || invites.length === 0) {
        invitesContainer.innerHTML = '<div class="empty-state">No pending invitations.</div>';
        return;
      }

      invitesContainer.innerHTML = invites.map(invite => `
        <div class="invite-card">
          <div>
            <strong style="color: var(--text);">${invite.host_name || 'Host'}</strong> invited you to a game!
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
              Mode: <span style="text-transform: capitalize;">${(invite.mode || '').replace('_', ' ')}</span> | 
              Rounds: ${invite.total_rounds} | 
              Stake: ${invite.total_staked_per_user} Tokens
            </div>
          </div>
          <div class="invite-actions">
            <button class="btn-accept" onclick="respondInvite('${invite.room_id}', 'accept')">Accept</button>
            <button class="btn-decline" onclick="respondInvite('${invite.room_id}', 'decline')">Decline</button>
          </div>
        </div>
      `).join('');

    } catch (err) {
      console.error('[Invitations Fetch Error]:', err);
      invitesContainer.innerHTML = '<div class="empty-state">Unable to load invitations.</div>';
    }
  }

  // --- Direct POST for Responding to Invites ---
  window.respondInvite = async (roomId, action) => {
    try {
      const response = await fetch(`${API_BASE}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('authToken');
        window.location.href = './index.html';
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to process request');
        return;
      }

      if (action === 'accept') {
        window.location.href = `./play.html?roomId=${roomId}`;
      } else {
        fetchInvitations();
      }

    } catch (err) {
      console.error('[Respond Invite Error]:', err);
      alert('Could not connect to server.');
    }
  };
});
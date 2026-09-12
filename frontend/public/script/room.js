document.addEventListener('DOMContentLoaded', () => {
  console.log('[Room Script] Initialized.');

  // Auth Guard
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.warn('[Auth Check] No authToken found. Redirecting...');
    window.location.href = '/';
    return;
  }

  const API_BASE = 'http://localhost:3000/api/flow';

  // Elements
  const toggleViewBtn = document.getElementById('toggleViewBtn');
  const createSection = document.getElementById('createSection');
  const invitesSection = document.getElementById('invitesSection');
  
  const createRoomForm = document.getElementById('createRoomForm');
  const submitBtn = document.getElementById('submitBtn');
  const modeZeroOption = document.getElementById('modeZero');
  const modeStakeOption = document.getElementById('modeStake');
  const roundsSelect = document.getElementById('totalRounds');
  const feeDisplay = document.getElementById('feeDisplay');
  const invitesContainer = document.getElementById('invitesContainer');

  let currentView = 'create';

  // Toggle View
  if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', () => {
      if (currentView === 'create') {
        currentView = 'invites';
        createSection.classList.remove('active');
        invitesSection.classList.add('active');
        toggleViewBtn.innerText = 'Create Room';
        fetchInvitations();
      } else {
        currentView = 'create';
        invitesSection.classList.remove('active');
        createSection.classList.add('active');
        toggleViewBtn.innerText = 'View Invitations';
      }
    });
  }

  // Radio Selectors
  if (modeZeroOption && modeStakeOption) {
    modeZeroOption.addEventListener('click', () => {
      modeZeroOption.classList.add('selected');
      modeStakeOption.classList.remove('selected');
      modeZeroOption.querySelector('input').checked = true;
      updateFeeCalculation();
    });

    modeStakeOption.addEventListener('click', () => {
      modeStakeOption.classList.add('selected');
      modeZeroOption.classList.remove('selected');
      modeStakeOption.querySelector('input').checked = true;
      updateFeeCalculation();
    });
  }

  if (roundsSelect) {
    roundsSelect.addEventListener('change', updateFeeCalculation);
  }

  function updateFeeCalculation() {
    const checkedRadio = document.querySelector('input[name="mode"]:checked');
    if (!checkedRadio || !roundsSelect || !feeDisplay) return;

    const selectedMode = checkedRadio.value;
    const rounds = parseInt(roundsSelect.value, 10);

    if (selectedMode === 'zero_stake') {
      feeDisplay.innerText = 'Required Charge: 2 Tokens (Flat Rate)';
    } else {
      const requiredStake = Math.ceil(rounds / 3);
      feeDisplay.innerText = `Required Charge: ${requiredStake} Token${requiredStake > 1 ? 's' : ''} (Stake Pool)`;
    }
  }

  // Form Submit Handler
  if (createRoomForm) {
    createRoomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('[Form Submission] Intercepted default submit.');

      try {
        const checkedRadio = document.querySelector('input[name="mode"]:checked');
        const roundsEl = document.getElementById('totalRounds');
        const taggedEl = document.getElementById('taggedFriends');

        if (!checkedRadio || !roundsEl || !taggedEl) {
          throw new Error('Form fields missing from DOM. Check HTML element IDs.');
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Creating Room...';
        }

        const mode = checkedRadio.value;
        const totalRounds = parseInt(roundsEl.value, 10);
        const taggedInput = taggedEl.value;
        
        const taggedFriends = taggedInput
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);

        const payload = { mode, totalRounds, taggedFriends };
        console.log('[Payload Prepared]:', payload);

        console.log(`[Sending Request] POST -> ${API_BASE}/rooms`);
        const res = await fetch(`${API_BASE}/rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('[Server Response]:', data);

        if (res.ok) {
          alert('Room created successfully!');
          createRoomForm.reset();
          updateFeeCalculation();
        } else {
          alert(`Error: ${data.error || 'Failed to create room.'}`);
        }

      } catch (err) {
        console.error('[Error Caught]:', err);
        alert(`Creation Failed: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Create Room';
        }
      }
    });
  }

  // Fetch Invitations
  async function fetchInvitations() {
    if (!invitesContainer) return;
    invitesContainer.innerHTML = '<div class="empty-state">Loading invitations...</div>';

    try {
      const res = await fetch(`${API_BASE}/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const invites = await res.json();

      if (!res.ok) {
        invitesContainer.innerHTML = `<div class="empty-state">${invites.error || 'Failed to load invites.'}</div>`;
        return;
      }

      if (invites.length === 0) {
        invitesContainer.innerHTML = '<div class="empty-state">No pending room invitations.</div>';
        return;
      }

      invitesContainer.innerHTML = '';
      invites.forEach(invite => {
        const card = document.createElement('div');
        card.className = 'invite-card';
        card.innerHTML = `
          <h3>Host: ${invite.host_name}</h3>
          <p><strong>Mode:</strong> ${invite.mode === 'stake_mode' ? 'Stake Mode' : 'Zero Stake'}</p>
          <p><strong>Rounds:</strong> ${invite.total_rounds}</p>
          <p><strong>Stake Required:</strong> ${invite.total_staked_per_user} Tokens</p>
          <div class="invite-actions">
            <button class="btn-accept" onclick="respondToInvite('${invite.room_id}', 'accept')">Accept</button>
            <button class="btn-decline" onclick="respondToInvite('${invite.room_id}', 'decline')">Decline</button>
          </div>
        `;
        invitesContainer.appendChild(card);
      });
    } catch (err) {
      invitesContainer.innerHTML = '<div class="empty-state">Error connecting to server.</div>';
    }
  }

  // Invitation Actions
  window.respondToInvite = async (roomId, action) => {
    try {
      const res = await fetch(`${API_BASE}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message);
        fetchInvitations();
      } else {
        alert(data.error || 'Action failed.');
      }
    } catch (err) {
      alert('Network error handling invitation.');
    }
  };
});

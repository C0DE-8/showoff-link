// Global Configuration Parameters
const API_BASE = API.user;
const token = localStorage.getItem('authToken');


// Routing Guard Check
if (!token) {
  window.location.href = './index.html';
}

// System Initializers
document.addEventListener("DOMContentLoaded", () => {
  fetchUserProfile();
  
  // Attach Form Form Interceptors
  document.getElementById('tagnameForm').addEventListener('submit', handleTagnameUpdate);
});

// Fetch Identity Record Data
async function fetchUserProfile() {
  try {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok) {
      document.getElementById('txtFullName').innerText = data.profile.full_name;
      document.getElementById('txtEmail').innerText = data.profile.email;
      document.getElementById('txtTagname').innerText = `@${data.profile.tagname}`;
      document.getElementById('txtTokens').innerText = `${data.profile.tokens} Units`;
      
      // Update fallback local storage context
      localStorage.setItem('userTagname', data.profile.tagname);
    } else {
      triggerToast(data.error || 'Failed to populate workspace profile.', 'error');
    }
  } catch (err) {
    triggerToast('Profile gateway link dropped.', 'error');
  }
}

// Update Tagname Controller Module
async function handleTagnameUpdate(e) {
  e.preventDefault();
  const inputField = document.getElementById('inpNewTagname');
  const newTag = inputField.value;
  
  toggleBtnLoading('btnTagname', true, 'Update Handle');

  try {
    const res = await fetch(`${API_BASE}/update-tagname`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ new_tagname: newTag })
    });
    const data = await res.json();

    if (res.ok) {
      triggerToast(data.message, 'success');
      document.getElementById('txtTagname').innerText = `@${data.tagname}`;
      localStorage.setItem('userTagname', data.tagname);
      inputField.value = '';
    } else {
      triggerToast(data.error || 'Validation failure updating handle.', 'error');
    }
  } catch (err) {
    triggerToast('Target system pipeline connection loss.', 'error');
  } finally {
    toggleBtnLoading('btnTagname', false, 'Update Handle');
  }
}


// UI Elements & Animation Utility Rules
function toggleBtnLoading(btnId, isLoading, defaultText) {
  const btn = document.getElementById(btnId);
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> <span>Verifying...</span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = defaultText;
  }
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

function logout() {
  localStorage.clear();
  window.location.href = './index.html';
}
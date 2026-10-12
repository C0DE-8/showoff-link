const ADMIN_API = API.admin;

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken');
  if (!token || localStorage.getItem('userRole') !== 'admin') {
    window.location.href = './authHub.html';
    return;
  }

  document.getElementById('refreshBtn').addEventListener('click', loadUsers);
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('adminNavLinks');
  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });
  navLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.admin-nav')) {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      navLinks.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
    }
  });
  document.getElementById('cancelPasswordReset').addEventListener('click', closePasswordModal);
  document.getElementById('passwordModal').addEventListener('click', (event) => {
    if (event.target.id === 'passwordModal') closePasswordModal();
  });
  document.getElementById('passwordForm').addEventListener('submit', submitPasswordReset);
  loadUsers();
});

let selectedPasswordUser = null;

async function loadUsers() {
  const status = document.getElementById('status');
  const body = document.getElementById('usersBody');
  body.setAttribute('aria-busy', 'true');
  status.textContent = 'Loading users…';
  body.innerHTML = Array.from({ length: 5 }, () => `
    <tr class="skeleton-row" aria-hidden="true">
      <td><span class="skeleton"></span></td><td><span class="skeleton"></span></td>
      <td><span class="skeleton short"></span></td><td><span class="skeleton short"></span></td>
      <td><span class="skeleton short"></span></td><td><span class="skeleton action"></span></td>
    </tr>`).join('');

  try {
    const response = await fetch(`${ADMIN_API}/users`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load users.');

    body.replaceChildren();
    for (const user of data.users) {
      const row = document.createElement('tr');
      const cells = [user.full_name, user.email, `@${user.tagname}`, user.role];
      for (const value of cells) {
        const cell = document.createElement('td');
        cell.textContent = value ?? '';
        row.appendChild(cell);
      }

      const verificationCell = document.createElement('td');
      verificationCell.textContent = user.is_verified ? 'Verified' : 'Unverified';
      if (user.is_verified) verificationCell.className = 'verified';
      row.appendChild(verificationCell);

      const actionCell = document.createElement('td');
      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'button reset';
      resetButton.textContent = 'Reset password';
      resetButton.addEventListener('click', () => resetUserPassword(user));
      actionCell.appendChild(resetButton);

      if (user.role !== 'admin') {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'button delete';
        deleteButton.textContent = 'Delete user';
        deleteButton.style.marginLeft = '8px';
        deleteButton.addEventListener('click', () => deleteUser(user));
        actionCell.appendChild(deleteButton);
      }

      row.appendChild(actionCell);
      body.appendChild(row);
    }

    status.textContent = data.users.length ? `${data.users.length} users` : 'No users found.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    body.setAttribute('aria-busy', 'false');
  }
}

async function deleteUser(user) {
  const confirmed = window.confirm(
    `Delete ${user.email} and their uploaded images, notes, voice notes, and skins? This cannot be undone.`
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`${ADMIN_API}/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'User deletion failed.');
    showToast(data.message || 'User deleted.', false);
    await loadUsers();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function resetUserPassword(user) {
  selectedPasswordUser = user;
  document.getElementById('passwordModalDescription').textContent = `Choose a new password for ${user.email}.`;
  document.getElementById('passwordForm').reset();
  document.getElementById('passwordModal').hidden = false;
  document.getElementById('newPassword').focus();
}

function closePasswordModal() {
  document.getElementById('passwordModal').hidden = true;
  selectedPasswordUser = null;
}

async function submitPasswordReset(event) {
  event.preventDefault();
  if (!selectedPasswordUser) return;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const submitButton = document.getElementById('savePasswordReset');
  if (newPassword.length < 8) return showToast('Password must be at least 8 characters.', true);
  if (newPassword !== confirmPassword) return showToast('Passwords do not match.', true);
  submitButton.disabled = true;
  submitButton.textContent = 'Updating…';

  try {
    const response = await fetch(`${ADMIN_API}/users/${encodeURIComponent(selectedPasswordUser.id)}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({ newPassword })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Password reset failed.');
    const email = selectedPasswordUser.email;
    closePasswordModal();
    showToast(`Password reset for ${email}. Share the new password securely.`, false);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Update password';
  }
}

function showToast(message, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 4500);
}

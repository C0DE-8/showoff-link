const ADMIN_API = API.admin;

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken');
  if (!token || localStorage.getItem('userRole') !== 'admin') {
    window.location.href = './authHub.html';
    return;
  }

  document.getElementById('refreshBtn').addEventListener('click', loadUsers);
  loadUsers();
});

async function loadUsers() {
  const status = document.getElementById('status');
  const body = document.getElementById('usersBody');
  status.textContent = 'Loading users…';

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
      row.appendChild(actionCell);
      body.appendChild(row);
    }

    status.textContent = data.users.length ? `${data.users.length} users` : 'No users found.';
  } catch (error) {
    status.textContent = error.message;
  }
}

async function resetUserPassword(user) {
  const newPassword = window.prompt(`Enter a new password for ${user.email} (at least 8 characters):`);
  if (newPassword === null) return;
  if (newPassword.length < 8) {
    showToast('Password must be at least 8 characters.', true);
    return;
  }
  if (!window.confirm(`Reset the password for ${user.email}?`)) return;

  try {
    const response = await fetch(`${ADMIN_API}/users/${encodeURIComponent(user.id)}/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({ newPassword })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Password reset failed.');
    showToast(`Password reset for ${user.email}. Share the new password securely.`, false);
  } catch (error) {
    showToast(error.message, true);
  }
}

function showToast(message, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.style.display = 'block';
  window.setTimeout(() => { toast.style.display = 'none'; }, 4500);
}

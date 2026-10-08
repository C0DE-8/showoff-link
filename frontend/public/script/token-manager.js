document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken');
  const userRole = localStorage.getItem('userRole');

  // Guard Check 1: Token Existence
  if (!token) {
    triggerToast('Access denied. Authentication token missing.', 'error');
    setTimeout(() => {
      window.location.href = './authHub.html';
    }, 1200);
    return;
  }

  // Guard Check 2: Role Authorization
  if (userRole !== 'admin') {
    console.log('ROLE CHECK FAILED:', userRole);
    triggerToast(`Access denied. Role received: ${userRole}`, 'error');
    setTimeout(() => {
      window.location.href = './dashboard.html';
    }, 1200);
    return;
  }

  console.log('ADMIN AUTH PASSED');

  // DOM Elements
  const pendingTableBody = document.getElementById('pendingTableBody');
  const statPendingCount = document.getElementById('statPendingCount');
  const statPendingAmount = document.getElementById('statPendingAmount');
  const refreshTableBtn = document.getElementById('refreshTableBtn');
  const bankConfigForm = document.getElementById('bankConfigForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const receiptModal = document.getElementById('receiptModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const receiptViewer = document.getElementById('receiptViewer');

  // Base API URL
  const BASE_URL = API.shop;

  // --- Initial Data Load ---
  fetchPendingPurchases();

  // Event Listeners
  if (refreshTableBtn) refreshTableBtn.addEventListener('click', fetchPendingPurchases);
  if (bankConfigForm) bankConfigForm.addEventListener('submit', handleUpdateBankSettings);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (closeModalBtn) closeModalBtn.addEventListener('click', () => receiptModal.style.display = 'none');

  // --- Functions ---

  // Toast Notification Trigger
  function triggerToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  // Fetch Pending Token Purchases
  async function fetchPendingPurchases() {
    try {
      pendingTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Fetching pending requests...</td></tr>';

      const response = await fetch(`${BASE_URL}/admin/pending-purchases`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Pending purchases returned a non-JSON response:', response.status, responseText.slice(0, 200));
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          window.location.href = './authHub.html';
          return;
        }
        triggerToast(`Could not load pending purchases (${response.status}).`, 'error');
        return;
      }

      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        window.location.href = './authHub.html';
        return;
      }

      if (result.success) {
        renderTableData(result.data);
      } else {
        triggerToast(result.error || 'Failed to fetch pending purchases.', 'error');
      }
    } catch (err) {
      console.error('Error fetching pending purchases:', err);
      triggerToast('Server connection failed.', 'error');
    }
  }

  // Render Rows in Table & Update Statistics
  function renderTableData(requests) {
    if (!requests || requests.length === 0) {
      pendingTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No pending purchase requests.</td></tr>';
      statPendingCount.innerText = '0';
      statPendingAmount.innerText = '₦0';
      return;
    }

    // Update Quick Analytics Stats
    const totalAmount = requests.reduce((acc, curr) => acc + (Number(curr.amount_ngn) || 0), 0);
    statPendingCount.innerText = requests.length.toString();
    statPendingAmount.innerText = `₦${totalAmount.toLocaleString()}`;

    pendingTableBody.innerHTML = '';

    requests.forEach(req => {
      const tr = document.createElement('tr');

      const dateStr = new Date(req.created_at).toLocaleString();

      tr.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${req.email}</strong></td>
        <td>${req.tokens_requested} Tokens</td>
        <td>₦${Number(req.amount_ngn).toLocaleString()}</td>
        <td>
          <button class="btn btn-outline btn-sm view-receipt-btn">View Receipt</button>
        </td>
        <td>
          <div class="action-group">
            <button class="btn btn-success btn-sm approve-btn">Approve</button>
            <button class="btn btn-danger btn-sm reject-btn">Reject</button>
          </div>
        </td>
      `;

      // Attach View Receipt listener
      tr.querySelector('.view-receipt-btn').addEventListener('click', () => {
        openReceiptModal(req.receipt_url);
      });

      // Attach Action listeners
      tr.querySelector('.approve-btn').addEventListener('click', () => {
        handleVerifyTopup(req.id, 'approve');
      });

      tr.querySelector('.reject-btn').addEventListener('click', () => {
        handleVerifyTopup(req.id, 'reject');
      });

      pendingTableBody.appendChild(tr);
    });
  }

  // Handle Approve / Reject Top-Up
  async function handleVerifyTopup(requestId, action) {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;

    try {
      const response = await fetch(`${BASE_URL}/verify-topup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId, action })
      });

      const responseText = await response.text();
      let result;

      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Verify topup returned a non-JSON response:', response.status, responseText.slice(0, 200));
        if (response.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          window.location.href = './authHub.html';
          return;
        }
        triggerToast(`Verification failed (${response.status}).`, 'error');
        return;
      }

      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        window.location.href = './authHub.html';
        return;
      }

      if (result.success) {
        triggerToast(result.message || `Request ${action}d successfully.`, 'success');
        fetchPendingPurchases(); // Refresh list
      } else {
        triggerToast(result.error || `Failed to ${action} request.`, 'error');
      }
    } catch (err) {
      console.error('Verify topup error:', err);
      triggerToast('An error occurred during status verification.', 'error');
    }
  }

  // Handle Updating Bank Account Settings
  async function handleUpdateBankSettings(e) {
    e.preventDefault();

    const bankName = document.getElementById('bankNameInput').value.trim();
    const accountNumber = document.getElementById('accountNumberInput').value.trim();
    const accountName = document.getElementById('accountNameInput').value.trim();

    try {
      const response = await fetch(`${BASE_URL}/admin/update-account`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bankName, accountNumber, accountName })
      });

      const result = await response.json();

      if (result.success) {
        triggerToast('Bank account details updated successfully.', 'success');
        bankConfigForm.reset();
      } else {
        triggerToast(result.error || 'Failed to update bank details.', 'error');
      }
    } catch (err) {
      console.error('Update bank settings error:', err);
      triggerToast('Failed to update payment settings.', 'error');
    }
  }

  // Display Receipt Media (Base64 URL or standard link)
  function openReceiptModal(receiptUrl) {
    receiptViewer.innerHTML = '';

    if (!receiptUrl) {
      receiptViewer.innerHTML = '<p class="text-center">No receipt file uploaded.</p>';
    } else if (receiptUrl.startsWith('data:application/pdf')) {
      receiptViewer.innerHTML = `<iframe src="${receiptUrl}" frameborder="0"></iframe>`;
    } else {
      receiptViewer.innerHTML = `<img src="${receiptUrl}" alt="Transfer Receipt" />`;
    }

    receiptModal.style.display = 'flex';
  }

  // Logout Handler
  function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    triggerToast('Logged out successfully.', 'success');
    setTimeout(() => {
      window.location.href = './authHub.html';
    }, 1000);
  }
});

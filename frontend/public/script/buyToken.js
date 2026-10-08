document.addEventListener('DOMContentLoaded', () => {
  // Retain token from localStorage
  const authToken = localStorage.getItem('authToken');

  // Execution Pipeline Entry Guard Check
  if (!authToken) {
    if (typeof handleInvalidToken === 'function') {
      handleInvalidToken();
    } else {
      window.location.href = './authHub.html';
    }
    return;
  }

  // Global variable to store selected package details
  let selectedPackage = {
    tokens: 0,
    amount: 0
  };

  // Inject Modal Structure into DOM
  const modalHTML = `
    <div id="paymentModal" class="modal-overlay" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Complete Payment</h3>
          <button id="closeModalBtn" class="close-btn">&times;</button>
        </div>

        <div id="modalStep1" class="modal-body">
          <p class="modal-instruction">Transfer exact amount to the account below, then upload your receipt.</p>
          
          <!-- Bank Details Box -->
          <div class="bank-info-box">
            <div class="info-row">
              <span class="info-label">Bank Name</span>
              <strong id="bankName" class="info-val">Loading...</strong>
            </div>
            <div class="info-row">
              <span class="info-label">Account Number</span>
              <div class="copy-wrapper">
                <strong id="accountNumber" class="info-val">Loading...</strong>
                <button id="copyAccBtn" class="copy-btn">Copy</button>
              </div>
            </div>
            <div class="info-row">
              <span class="info-label">Account Name</span>
              <strong id="accountName" class="info-val">Loading...</strong>
            </div>
            <div class="info-row highlight-row">
              <span class="info-label">Amount to Pay</span>
              <strong id="paymentAmount" class="info-val amount-val">₦0</strong>
            </div>
          </div>

          <!-- Receipt Upload Form -->
          <form id="receiptForm" class="upload-form">
            <label for="receiptInput" class="file-label">
              <span>📎 Select Payment Receipt (JPG, PNG, PDF)</span>
              <input type="file" id="receiptInput" accept="image/png, image/jpeg, application/pdf" required />
            </label>
            <div id="fileNameDisplay" class="file-name"></div>

            <button type="submit" id="submitReceiptBtn" class="submit-btn" disabled>
              Submit Transfer Receipt
            </button>
          </form>
        </div>

        <!-- Success Message Step -->
        <div id="modalStep2" class="modal-body" style="display: none;">
          <div class="success-state">
            <div class="success-icon">✓</div>
            <h4>Receipt Submitted!</h4>
            <p>Your transfer receipt is under verification. Tokens will be credited to your balance once verified.</p>
            <button id="finishBtn" class="submit-btn">Back to Shop</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // DOM Elements
  const modal = document.getElementById('paymentModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const receiptInput = document.getElementById('receiptInput');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const submitReceiptBtn = document.getElementById('submitReceiptBtn');
  const receiptForm = document.getElementById('receiptForm');
  const copyAccBtn = document.getElementById('copyAccBtn');
  const modalStep1 = document.getElementById('modalStep1');
  const modalStep2 = document.getElementById('modalStep2');
  const finishBtn = document.getElementById('finishBtn');

  // Helper Function: Convert File to Base64 String
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Fetch Bank Account Details on Load
  async function fetchBankDetails() {
    try {
      const response = await fetch(`${API.shop}/payment-details`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();

      if (result.success) {
        document.getElementById('bankName').innerText = result.data.bank_name;
        document.getElementById('accountNumber').innerText = result.data.account_number;
        document.getElementById('accountName').innerText = result.data.account_name;
      } else {
        alert(result.error || 'Failed to load bank payment details.');
      }
    } catch (err) {
      console.error('Error loading bank details:', err);
    }
  }

  fetchBankDetails();

  // Attach Event Listeners to Buy Buttons
  document.querySelectorAll('.buy-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const tokens = e.target.getAttribute('data-tokens');
      const amount = e.target.getAttribute('data-amount');

      selectedPackage = {
        tokens: parseInt(tokens, 10),
        amount: parseInt(amount, 10)
      };

      document.getElementById('paymentAmount').innerText = `₦${selectedPackage.amount.toLocaleString()}`;
      
      // Reset steps and form
      modalStep1.style.display = 'block';
      modalStep2.style.display = 'none';
      receiptForm.reset();
      fileNameDisplay.innerText = '';
      submitReceiptBtn.disabled = true;

      modal.style.display = 'flex';
    });
  });

  // Close Modal Handlers
  closeModalBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  finishBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Enable/Disable Submit based on file selection
  receiptInput.addEventListener('change', () => {
    if (receiptInput.files && receiptInput.files[0]) {
      fileNameDisplay.innerText = `Selected: ${receiptInput.files[0].name}`;
      submitReceiptBtn.disabled = false;
    } else {
      fileNameDisplay.innerText = '';
      submitReceiptBtn.disabled = true;
    }
  });

  // Copy Account Number
  copyAccBtn.addEventListener('click', () => {
    const accNum = document.getElementById('accountNumber').innerText;
    navigator.clipboard.writeText(accNum).then(() => {
      copyAccBtn.innerText = 'Copied!';
      setTimeout(() => {
        copyAccBtn.innerText = 'Copy';
      }, 2000);
    });
  });

  // Submit Receipt Form with Direct Frontend Base64 Conversion
  receiptForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = receiptInput.files[0];
    if (!file) return;

    submitReceiptBtn.disabled = true;
    submitReceiptBtn.innerText = 'Converting & Submitting...';

    try {
      // 1. Convert receipt file directly to Base64 in the browser
      const base64Receipt = await convertFileToBase64(file);

      // 2. Send payload directly to the /submit-request backend route
      const requestPayload = {
        tokensRequested: selectedPackage.tokens,
        amountNgn: selectedPackage.amount,
        receiptUrl: base64Receipt
      };

      const submitRes = await fetch(`${API.shop}/submit-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      const submitData = await submitRes.json();

      if (submitData.success) {
        modalStep1.style.display = 'none';
        modalStep2.style.display = 'block';
      } else {
        alert(submitData.error || 'Submission failed.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('An error occurred while processing the receipt file.');
    } finally {
      submitReceiptBtn.innerText = 'Submit Transfer Receipt';
      submitReceiptBtn.disabled = false;
    }
  });
});

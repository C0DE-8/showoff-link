const sessionToken = localStorage.getItem('authToken');
const userRole = localStorage.getItem('userRole');

// Ensure user is admin on page load
if (!sessionToken || userRole !== 'admin') {
  alert('Access denied. Admin credentials required.');
  window.location.href = './index.html';
}

const API_BASE = 'http://localhost:3000/api/admin';

document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('uploadSkinForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleSkinUpload);
  }
});

async function handleSkinUpload(event) {
  event.preventDefault();

  const form = event.target; // Reference to uploadSkinForm

  // Ensure user is admin on submit
  if (localStorage.getItem('userRole') !== 'admin') {
    alert('Access denied. Management credentials required.');
    return;
  }

  const nameInput = document.getElementById('skinName');
  const costInput = document.getElementById('tokenCost');
  const fileInput = document.getElementById('skinGraphic');
  const submitBtn = document.getElementById('submitSkinBtn');
  const statusDiv = document.getElementById('uploadStatus');

  const file = fileInput.files[0];
  if (!file) {
    alert('Please select an image file to upload.');
    return;
  }

  // Construct FormData payload
  const formData = new FormData();
  formData.append('name', nameInput.value.trim());
  formData.append('token_cost', costInput.value || 0);
  
  // MUST match backend parameter: upload.single('skinGraphic')
  formData.append('skinGraphic', file);

  try {
    if (submitBtn) submitBtn.disabled = true;
    if (statusDiv) statusDiv.textContent = 'Uploading skin graphic...';

    const response = await fetch(`${API_BASE}/admin/upload-skin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      if (statusDiv) statusDiv.textContent = `Error: ${data.error || 'Upload failed'}`;
      alert(data.error || 'Failed to upload skin.');
      return;
    }

    if (statusDiv) statusDiv.textContent = `Success! Skin ID: ${data.skinId}`;
    alert(data.message || 'Skin uploaded successfully!');
    form.reset(); // Uses event.target safely

  } catch (err) {
    console.error('Error uploading skin:', err);
    if (statusDiv) statusDiv.textContent = 'Network or server failure during upload.';
    alert('An unexpected error occurred during upload.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('uploadNoteForm');
  const noteContentInput = document.getElementById('noteContent');
  const textareaWrapper = document.getElementById('textareaWrapper');
  const recipientTagInput = document.getElementById('recipientTag');
  const allowedViewsInput = document.getElementById('allowedViews');
  const decrementBtn = document.getElementById('decrementViews');
  const incrementBtn = document.getElementById('incrementViews');
  const charCount = document.getElementById('charCount');
  const submitBtn = document.getElementById('submitBtn');
  const statusToast = document.getElementById('statusToast');

  // Modal Elements
  const successOverlay = document.getElementById('successOverlay');
  const shareUrlInput = document.getElementById('shareUrlInput');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const dismissModalBtn = document.getElementById('dismissModalBtn');

  // Hard Ceiling for Short Quotes
  const MAX_QUOTE_LENGTH = 280;

  // 1. Quote Length Tracking & Visual Warning Indicator
  noteContentInput.addEventListener('input', () => {
    const length = noteContentInput.value.length;
    charCount.textContent = `${length} / ${MAX_QUOTE_LENGTH}`;

    charCount.classList.remove('warning', 'exceeded');
    textareaWrapper.classList.remove('limit-exceeded');

    if (length >= MAX_QUOTE_LENGTH) {
      charCount.classList.add('exceeded');
      textareaWrapper.classList.add('limit-exceeded');
    } else if (length >= MAX_QUOTE_LENGTH - 30) {
      charCount.classList.add('warning');
    }
  });

  // 2. View Limit Controls (Min 1, Max 20)
  decrementBtn.addEventListener('click', () => {
    let val = parseInt(allowedViewsInput.value, 10) || 1;
    if (val > 1) allowedViewsInput.value = val - 1;
  });

  incrementBtn.addEventListener('click', () => {
    let val = parseInt(allowedViewsInput.value, 10) || 1;
    if (val < 20) allowedViewsInput.value = val + 1;
  });

  // 3. Security Sanitizers
  function sanitizeSecurityInput(str) {
    if (!str) return '';
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();
  }

  function cleanTagName(tag) {
    if (!tag) return '';
    return tag.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').trim();
  }

  // 4. Submission Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    // Token Retrieval from LocalStorage
    const token = localStorage.getItem('authToken');

    if (!token) {
      showError('Authentication token missing. Please log in to publish.');
       window.location.href = '/login.html';
      return;
    }

    const rawContent = noteContentInput.value;
    const rawTag = recipientTagInput.value;
    const allowedViews = parseInt(allowedViewsInput.value, 10) || 1;

    if (!rawContent.trim()) {
      showError('Quote payload cannot be empty.');
      return;
    }

    if (rawContent.length > MAX_QUOTE_LENGTH) {
      showError(`Keep it short! Quotes must be under ${MAX_QUOTE_LENGTH} characters.`);
      return;
    }

    const cleanContent = sanitizeSecurityInput(rawContent);
    const cleanTag = cleanTagName(rawTag);

    setSubmittingState(true);

    try {
      const response = await fetch(`${API.note}/upload-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Authorized Bearer Header Attach
        },
        body: JSON.stringify({
          note_content: cleanContent,
          allowed_views: allowedViews,
          recipient_tagname: cleanTag
        })
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        throw new Error('Access denied. Token invalid or expired.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish quote payload.');
      }

      // Show Success Modal
      shareUrlInput.value = data.shareableUrl;
      successOverlay.style.display = 'flex';

      // Reset Form State
      form.reset();
      allowedViewsInput.value = '1';
      charCount.textContent = `0 / ${MAX_QUOTE_LENGTH}`;

    } catch (err) {
      showError(err.message);
    } finally {
      setSubmittingState(false);
    }
  });

  // 5. Copy URL Action
  copyUrlBtn.addEventListener('click', () => {
    if (!shareUrlInput.value) return;

    navigator.clipboard.writeText(shareUrlInput.value)
      .then(() => {
        const originalText = copyUrlBtn.textContent;
        copyUrlBtn.textContent = 'Copied!';
        copyUrlBtn.style.background = '#10b981';

        setTimeout(() => {
          copyUrlBtn.textContent = originalText;
          copyUrlBtn.style.background = '#0284c7';
        }, 2000);
      })
      .catch(() => {
        showError('Unable to copy automatically. Please copy the link manually.');
      });
  });

  // 6. Dismiss Modal
  dismissModalBtn.addEventListener('click', () => {
    successOverlay.style.display = 'none';
  });

  // UI Helpers
  function showError(msg) {
    statusToast.textContent = `⚠️ ${msg}`;
    statusToast.classList.add('error');
  }

  function hideError() {
    statusToast.textContent = '';
    statusToast.classList.remove('error');
  }

  function setSubmittingState(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'Encrypting Quote...' : 'Encrypt & Publish Quote';
  }
});
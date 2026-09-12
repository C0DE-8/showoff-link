const API_BASE = 'http://localhost:3000/api/flow';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    if (!token) {
        triggerToast('Access denied. Authentication token missing.', 'error');
        setTimeout(() => {
            window.location.href = '/authHub.html';
        }, 1200);
        return;
    }

    if (userRole !== 'admin') {
        console.log('ROLE CHECK FAILED:', userRole);
        triggerToast(`Access denied. Role received: ${userRole}`, 'error');
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1200);
        return;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Initialize Default Rows
    addTurnRow();
    addPieceRow();

    // Event Listeners for Adding Rows
    document.getElementById('addTurnBtn').addEventListener('click', addTurnRow);
    document.getElementById('addPieceBtn').addEventListener('click', addPieceRow);

    // Form Submission Listeners
    document.getElementById('pairedForm').addEventListener('submit', handlePairedSubmit);
    document.getElementById('communityForm').addEventListener('submit', handleCommunitySubmit);
});

// Toast Utility
function triggerToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Logout Handler
function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    triggerToast('Logged out successfully', 'success');
    setTimeout(() => {
        window.location.href = '/authHub.html';
    }, 1000);
}

// Dynamic Row Generator: Paired Turns
function addTurnRow() {
    const container = document.getElementById('turnsContainer');
    const index = container.children.length + 1;

    const row = document.createElement('div');
    row.className = 'dynamic-item turn-row';
    row.innerHTML = `
        <span style="font-weight:600; min-width: 20px;">${index}.</span>
        <select class="select-role turn-role">
            <option value="A">Role A</option>
            <option value="B">Role B</option>
        </select>
        <input type="text" class="turn-phrase" placeholder="Prompt or phrase text for this turn..." required />
        <button type="button" class="btn-remove" onclick="removeRow(this, 'turnsContainer')">&times;</button>
    `;
    container.appendChild(row);
}

// Dynamic Row Generator: Community Pieces
function addPieceRow() {
    const container = document.getElementById('piecesContainer');
    const index = container.children.length;

    const row = document.createElement('div');
    row.className = 'dynamic-item piece-row';
    row.innerHTML = `
        <span style="font-weight:600; min-width: 25px;">#${index}</span>
        <input type="text" class="piece-phrase" placeholder="Prompt line for contributor..." required />
        <button type="button" class="btn-remove" onclick="removeRow(this, 'piecesContainer')">&times;</button>
    `;
    container.appendChild(row);
}

// Remove Row and Recalculate Index Numbers
function removeRow(btn, containerId) {
    const container = document.getElementById(containerId);
    if (container.children.length <= 1) {
        triggerToast('At least one entry is required.', 'error');
        return;
    }
    btn.parentElement.remove();

    // Re-index displayed sequence numbers
    Array.from(container.children).forEach((child, idx) => {
        const label = child.querySelector('span');
        label.textContent = containerId === 'turnsContainer' ? `${idx + 1}.` : `#${idx}`;
    });
}

// API Submit: Paired Session Template
async function handlePairedSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('pairedTitle').value;
    const roleAName = document.getElementById('roleAName').value;
    const roleBName = document.getElementById('roleBName').value;

    const turns = [];
    document.querySelectorAll('.turn-row').forEach((row, index) => {
        turns.push({
            turnOrder: index + 1,
            assignedRole: row.querySelector('.turn-role').value,
            phraseText: row.querySelector('.turn-phrase').value
        });
    });

    const payload = { title, roleAName, roleBName, turns };

    try {
        const response = await fetch(`${API_BASE}/admin/paired/templates`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create template');
        }

        triggerToast('Paired session template created successfully!', 'success');
        document.getElementById('pairedForm').reset();
        document.getElementById('turnsContainer').innerHTML = '';
        addTurnRow();
    } catch (err) {
        triggerToast(err.message, 'error');
    }
}

// API Submit: Community Canvas Story
async function handleCommunitySubmit(e) {
    e.preventDefault();

    const title = document.getElementById('storyTitle').value;
    const storySlug = document.getElementById('storySlug').value;
    const promptText = document.getElementById('promptText').value;

    const pieces = [];
    document.querySelectorAll('.piece-row').forEach((row, index) => {
        pieces.push({
            pieceIndex: index,
            promptPhrase: row.querySelector('.piece-phrase').value
        });
    });

    const payload = { storySlug, title, promptText, pieces };

    try {
        const response = await fetch(`${API_BASE}/admin/community/stories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create story');
        }

        triggerToast('Community Canvas Story created successfully!', 'success');
        document.getElementById('communityForm').reset();
        document.getElementById('piecesContainer').innerHTML = '';
        addPieceRow();
    } catch (err) {
        triggerToast(err.message, 'error');
    }
}

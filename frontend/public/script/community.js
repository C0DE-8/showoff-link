const API_BASE = 'http://localhost:3000/api/flow';
const token = localStorage.getItem('authToken');

if (!token && window.location.pathname !== '/index.html') {
    window.location.href = '/index.html';
}

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

let activePieceId = null;
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let timerInterval = null;

// DOM Elements
const reserveBtn = document.getElementById('reserve-btn');
const reserveSection = document.getElementById('reserve-section');
const studioSection = document.getElementById('studio-section');
const promptDisplay = document.getElementById('prompt-display');
const countdownDisplay = document.getElementById('countdown');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const audioPreview = document.getElementById('audio-preview');
const submitBtn = document.getElementById('submit-btn');
const wallContainer = document.getElementById('wall-container');

// Fetch Wall Feed
async function loadWall() {
    try {
        const res = await fetch(`${API_BASE}/community/wall`, { headers });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);

        if (data.length === 0) {
            wallContainer.innerHTML = '<p>No completed stories yet.</p>';
            return;
        }

        wallContainer.innerHTML = data.map(story => `
            <div class="feed-item">
                <h3>${story.title}</h3>
                <p>${story.prompt_text}</p>
                <div class="playlist">
                    ${story.playlist.map(p => `
                        <div class="playlist-track">
                            <strong>Piece #${p.pieceIndex + 1}:</strong> "${p.promptPhrase}"
                            <audio controls src="${p.audioUrl}"></audio>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    } catch (err) {
        wallContainer.innerHTML = `<p style="color:#ef4444">${err.message}</p>`;
    }
}

// Reserve Slot
reserveBtn.addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_BASE}/community/reserve`, { method: 'POST', headers });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        activePieceId = data.pieceId;
        promptDisplay.textContent = `"${data.promptPhrase}"`;
        
        reserveSection.classList.add('hidden');
        studioSection.classList.remove('hidden');

        startTimer(300); // 5 minutes
    } catch (err) {
        alert(err.message);
    }
});

function startTimer(seconds) {
    let remaining = seconds;
    updateTimerDisplay(remaining);

    timerInterval = setInterval(() => {
        remaining--;
        updateTimerDisplay(remaining);
        if (remaining <= 0) {
            clearInterval(timerInterval);
            alert('Reservation time expired!');
            resetStudio();
        }
    }, 1000);
}

function updateTimerDisplay(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    countdownDisplay.textContent = `${m}:${s}`;
}

// Recording Logic
recordBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioPreview.src = URL.createObjectURL(audioBlob);
            audioPreview.classList.remove('hidden');
            submitBtn.classList.remove('hidden');
        };

        mediaRecorder.start();

        // Safety hard-stop at 4 minutes
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopRecording();
            }
        }, 240000);

        recordBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
    } catch (err) {
        alert('Microphone access denied or unreadable.');
    }
});

stopBtn.addEventListener('click', stopRecording);

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        stopBtn.classList.add('hidden');
        recordBtn.classList.remove('hidden');
        recordBtn.textContent = 'Re-record';
    }
}

// Submit Recording
submitBtn.addEventListener('click', async () => {
    if (!audioBlob) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    // Simulated asset upload — swap this with your cloud storage or API endpoint
    const mockAudioAssetUrl = URL.createObjectURL(audioBlob);

    try {
        const res = await fetch(`${API_BASE}/community/submit`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                pieceId: activePieceId,
                audioAssetUrl: mockAudioAssetUrl
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert('Submitted successfully!');
        resetStudio();
        loadWall();
    } catch (err) {
        alert(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Track';
    }
});

function resetStudio() {
    clearInterval(timerInterval);
    studioSection.classList.add('hidden');
    reserveSection.classList.remove('hidden');
    audioPreview.classList.add('hidden');
    submitBtn.classList.add('hidden');
    recordBtn.classList.remove('hidden');
    recordBtn.textContent = 'Start Recording';
    stopBtn.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Track';
    activePieceId = null;
    audioBlob = null;
}

loadWall();

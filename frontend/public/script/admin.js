const API_BASE = API.admin;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    if (!token) {
        triggerToast('Access denied. Authentication token missing.', 'error');

        setTimeout(() => {
            window.location.href = './authHub.html';
        }, 1200);

        return;
    }

    if (userRole !== 'admin') {
        console.log('ROLE CHECK FAILED:', userRole);

        triggerToast(
            `Access denied. Role received: ${userRole}`,
            'error'
        );

        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1200);

        return;
    }

    console.log('ADMIN AUTH PASSED');

    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});


function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');

    triggerToast('Signed out successfully.', 'success');

    setTimeout(() => {
        window.location.href = '/authHub.html';
    }, 1000);
}


function triggerToast(message, type = 'error') {
    const container = document.getElementById('toastContainer');

    if (!container) return;

    const toast = document.createElement('div');

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');

        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 4000);
}
const API_BASE = 'http://localhost:3000/api/admin';

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

    fetchQuickAnalytics(token);

    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});


async function fetchQuickAnalytics(token) {
    try {
        const url = `${API_BASE}/admin/analytics`;

        console.log('Requesting:', url);
        console.log('Sending token:', !!token);

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Analytics status:', res.status);

        const data = await res.json();

        console.log('Analytics response:', data);

        if (res.status === 401 || res.status === 403) {
            triggerToast(
                data.error || 'Unauthorized. Your session may have expired.',
                'error'
            );

            localStorage.removeItem('authToken');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userRole');

            setTimeout(() => {
                window.location.href = '/authHub.html';
            }, 1500);

            return;
        }

        if (!res.ok) {
            triggerToast(
                data.error || 'Failed to load analytics.',
                'error'
            );

            return;
        }

        if (data.success) {
            document.getElementById('statUsers').innerText =
                data.ecosystem?.total_registered_users || '0';

            document.getElementById('statTokens').innerText =
                data.ecosystem?.total_circulating_tokens || '0';

            document.getElementById('statNotes').innerText =
                data.assets_active_inventory?.text_notes?.current_active_count || '0';

            document.getElementById('statStorage').innerText =
                `${data.assets_active_inventory?.image_storage?.allocated_disk_space_mb || '0.00'} MB`;
        } else {
            triggerToast(
                data.error || 'Failed to load telemetry stats.',
                'error'
            );
        }

    } catch (err) {
        console.error('Analytics request failed:', err);

        triggerToast(
            'Unable to connect to analytics service.',
            'error'
        );
    }
}


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
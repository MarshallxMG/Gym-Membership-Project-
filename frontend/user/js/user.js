// =====================================================
// USER PORTAL JAVASCRIPT
// =====================================================

const API_BASE = '/api';

// =====================================================
// AUTH & INITIALIZATION
// =====================================================

function getToken() {
    return localStorage.getItem('userToken');
}

function getUser() {
    const user = localStorage.getItem('userData');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    window.location.href = 'index.html';
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// =====================================================
// API HELPERS
// =====================================================

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        ...options
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        if (response.status === 401 || response.status === 403) {
            logout();
            return null;
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast('error', error.message);
        throw error;
    }
}

// =====================================================
// TOAST NOTIFICATIONS
// =====================================================

function showToast(type, message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'error' ? 'danger' : type} animate-slideIn`;
    toast.style.marginBottom = '0.5rem';
    toast.innerHTML = `${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ️'} ${message}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =====================================================
// DASHBOARD DATA
// =====================================================

async function loadDashboard() {
    const user = getUser();
    if (user) {
        document.getElementById('welcomeName').textContent = user.name.split(' ')[0];
        document.getElementById('headerUserName').textContent = user.name.split(' ')[0];
        document.getElementById('userAvatar').textContent = user.name[0].toUpperCase();
    }

    await Promise.all([
        loadProfile(),
        loadMembership(),
        loadNotifications()
    ]);
}

async function loadProfile() {
    try {
        const profile = await apiRequest('/user/profile');
        
        document.getElementById('profileName').textContent = profile.name;
        document.getElementById('profileEmail').textContent = profile.email;
        document.getElementById('profilePhone').textContent = profile.phone || 'Not set';
        document.getElementById('profileJoined').textContent = new Date(profile.created_at).toLocaleDateString();

        // Update form
        document.getElementById('editName').value = profile.name;
        document.getElementById('editPhone').value = profile.phone || '';
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

async function loadMembership() {
    try {
        const data = await apiRequest('/user/membership');
        
        const container = document.getElementById('membershipCard');
        
        if (!data.hasMembership) {
            container.innerHTML = `
                <div class="no-membership">
                    <div class="no-membership-icon">💳</div>
                    <h3>No Active Membership</h3>
                    <p>You don't have an active membership yet. Please contact the front desk to get started!</p>
                </div>
            `;
            
            document.getElementById('statPlan').textContent = '-';
            document.getElementById('statDays').textContent = '-';
            document.getElementById('statAmount').textContent = '-';
            document.getElementById('welcomeMessage').textContent = 'Get a membership to start your fitness journey!';
            return;
        }

        const m = data.membership;
        const isExpiring = m.isExpiring;
        const isExpired = m.isExpired;

        let statusClass = 'active';
        let statusText = 'Active';
        
        if (isExpired) {
            statusClass = 'expired';
            statusText = 'Expired';
        } else if (isExpiring) {
            statusClass = 'expiring';
            statusText = 'Expiring Soon';
        }

        // Calculate countdown
        const endDate = new Date(m.end_date);
        const now = new Date();
        const diff = endDate - now;
        
        let days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
        let hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
        let minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
        let seconds = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

        container.innerHTML = `
            <div class="membership-header">
                <div>
                    <div class="membership-plan">CURRENT PLAN</div>
                    <div class="membership-type">${m.plan_type} Membership</div>
                </div>
                <div class="membership-status ${statusClass}">${statusText}</div>
            </div>

            <div class="countdown-section">
                <div class="countdown-label">${isExpired ? 'Membership Expired' : 'Time Remaining'}</div>
                <div class="countdown-display">
                    <div class="countdown-item">
                        <div class="countdown-value" id="countDays">${days}</div>
                        <div class="countdown-unit">Days</div>
                    </div>
                    <div class="countdown-item">
                        <div class="countdown-value" id="countHours">${hours}</div>
                        <div class="countdown-unit">Hours</div>
                    </div>
                    <div class="countdown-item">
                        <div class="countdown-value" id="countMins">${minutes}</div>
                        <div class="countdown-unit">Mins</div>
                    </div>
                    <div class="countdown-item">
                        <div class="countdown-value" id="countSecs">${seconds}</div>
                        <div class="countdown-unit">Secs</div>
                    </div>
                </div>
            </div>

            <div class="membership-details">
                <div class="detail-item">
                    <div class="detail-label">Start Date</div>
                    <div class="detail-value">${formatDate(m.start_date)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">End Date</div>
                    <div class="detail-value">${formatDate(m.end_date)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Amount Paid</div>
                    <div class="detail-value">₹${m.amount.toLocaleString()}</div>
                </div>
            </div>
        `;

        // Update stats
        document.getElementById('statPlan').textContent = m.plan_type;
        document.getElementById('statDays').textContent = isExpired ? 'Expired' : `${m.daysRemaining} days`;
        document.getElementById('statAmount').textContent = `₹${m.amount.toLocaleString()}`;

        // Update welcome message
        if (isExpired) {
            document.getElementById('welcomeMessage').textContent = 'Your membership has expired. Please renew!';
        } else if (isExpiring) {
            document.getElementById('welcomeMessage').textContent = `Your membership expires in ${m.daysRemaining} days!`;
        } else {
            document.getElementById('welcomeMessage').textContent = 'Keep up the great work! 💪';
        }

        // Start countdown timer
        if (!isExpired) {
            startCountdown(endDate);
        }
    } catch (error) {
        console.error('Failed to load membership:', error);
    }
}

function startCountdown(endDate) {
    setInterval(() => {
        const now = new Date();
        const diff = endDate - now;

        if (diff <= 0) {
            location.reload();
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const daysEl = document.getElementById('countDays');
        const hoursEl = document.getElementById('countHours');
        const minsEl = document.getElementById('countMins');
        const secsEl = document.getElementById('countSecs');

        if (daysEl) daysEl.textContent = days;
        if (hoursEl) hoursEl.textContent = hours;
        if (minsEl) minsEl.textContent = minutes;
        if (secsEl) secsEl.textContent = seconds;
    }, 1000);
}

async function loadNotifications() {
    try {
        const data = await apiRequest('/user/notifications');
        
        const container = document.getElementById('notificationList');
        const badge = document.getElementById('notifBadge');
        const markAllBtn = document.getElementById('markAllReadBtn');

        // Update badge
        if (data.unreadCount > 0) {
            badge.textContent = data.unreadCount;
            badge.style.display = 'block';
            markAllBtn.style.display = 'block';
        } else {
            badge.style.display = 'none';
            markAllBtn.style.display = 'none';
        }

        // Update stats
        document.getElementById('statNotifs').textContent = `${data.unreadCount} unread`;

        if (data.notifications.length === 0) {
            container.innerHTML = `
                <div class="notification-empty">
                    <div class="notification-empty-icon">🔔</div>
                    <p>No notifications yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.notifications.map(n => `
            <div class="notification-item ${n.is_read ? '' : 'unread'} ${n.type === 'expired' ? 'expired' : ''}" 
                 onclick="markAsRead(${n.id}, this)">
                <div>${n.message}</div>
                <div class="notification-time">${formatDateTime(n.created_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

async function markAsRead(id, element) {
    try {
        await apiRequest(`/user/notifications/${id}/read`, { method: 'PUT' });
        element.classList.remove('unread');
        
        // Update badge count
        const badge = document.getElementById('notifBadge');
        const current = parseInt(badge.textContent) || 0;
        if (current > 0) {
            badge.textContent = current - 1;
            if (current - 1 <= 0) {
                badge.style.display = 'none';
                document.getElementById('markAllReadBtn').style.display = 'none';
            }
        }
        document.getElementById('statNotifs').textContent = `${Math.max(0, current - 1)} unread`;
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

async function markAllRead() {
    try {
        await apiRequest('/user/notifications/read-all', { method: 'PUT' });
        loadNotifications();
        showToast('success', 'All notifications marked as read');
    } catch (error) {
        console.error('Failed to mark all as read:', error);
    }
}

// =====================================================
// PANELS & MODALS
// =====================================================

function toggleNotifications() {
    document.getElementById('notificationPanel').classList.toggle('open');
    document.getElementById('panelOverlay').classList.toggle('open');
}

function closeNotifications() {
    document.getElementById('notificationPanel').classList.remove('open');
    document.getElementById('panelOverlay').classList.remove('open');
}

function toggleUserMenu() {
    document.getElementById('userMenuModal').classList.add('active');
}

function closeUserMenu() {
    document.getElementById('userMenuModal').classList.remove('active');
}

function openProfileModal() {
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
    document.getElementById('editCurrentPassword').value = '';
    document.getElementById('editNewPassword').value = '';
}

// =====================================================
// FORM HANDLERS
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Load dashboard
    loadDashboard();

    // Profile form handler
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            name: document.getElementById('editName').value,
            phone: document.getElementById('editPhone').value
        };

        const currentPassword = document.getElementById('editCurrentPassword').value;
        const newPassword = document.getElementById('editNewPassword').value;

        if (newPassword) {
            if (!currentPassword) {
                showToast('error', 'Current password required to change password');
                return;
            }
            data.currentPassword = currentPassword;
            data.newPassword = newPassword;
        }

        try {
            await apiRequest('/user/profile', { method: 'PUT', body: JSON.stringify(data) });
            showToast('success', 'Profile updated successfully');
            closeProfileModal();
            
            // Update local storage
            const userData = getUser();
            userData.name = data.name;
            localStorage.setItem('userData', JSON.stringify(userData));
            
            loadProfile();
            document.getElementById('welcomeName').textContent = data.name.split(' ')[0];
            document.getElementById('headerUserName').textContent = data.name.split(' ')[0];
        } catch (error) {
            console.error('Failed to update profile:', error);
        }
    });
});

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatDateTime(dateStr) {
    return new Date(dateStr).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

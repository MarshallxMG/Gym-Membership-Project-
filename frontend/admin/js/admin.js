// =====================================================
// ADMIN JAVASCRIPT
// =====================================================

const API_BASE = '/api';
let currentSection = 'dashboard';

// =====================================================
// AUTH & INITIALIZATION
// =====================================================

function getToken() {
    return localStorage.getItem('adminToken');
}

function getUser() {
    const user = localStorage.getItem('adminUser');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
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
    toast.innerHTML = `
        ${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ️'} ${message}
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =====================================================
// NAVIGATION
// =====================================================

function showSection(sectionName) {
    currentSection = sectionName;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionName);
    });

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.toggle('active', section.id === `${sectionName}Section`);
    });

    // Load section data
    switch (sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'members':
            loadMembers();
            break;
        case 'memberships':
            loadMemberships();
            break;
        case 'notifications':
            loadNotifications();
            break;
    }
}

// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {
    try {
        const stats = await apiRequest('/admin/dashboard');
        
        document.getElementById('statMembers').textContent = stats.totalMembers;
        document.getElementById('statActive').textContent = stats.activeMemberships;
        document.getElementById('statExpiring').textContent = stats.expiringMemberships;
        document.getElementById('statRevenue').textContent = `₹${stats.totalRevenue.toLocaleString()}`;

        // Load recent members
        const members = await apiRequest('/admin/members');
        renderRecentMembers(members.slice(0, 5));
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

function renderRecentMembers(members) {
    const container = document.getElementById('recentMembersTable');
    
    if (members.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>No members yet. Add your first member!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${members.map(member => `
                    <tr>
                        <td>${escapeHtml(member.name)}</td>
                        <td>${escapeHtml(member.email)}</td>
                        <td>${member.plan_type || 'No plan'}</td>
                        <td>${getMembershipBadge(member)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function refreshDashboard() {
    loadDashboard();
    showToast('success', 'Dashboard refreshed');
}

// =====================================================
// MEMBERS
// =====================================================

async function loadMembers() {
    try {
        const members = await apiRequest('/admin/members');
        renderMembers(members);
    } catch (error) {
        console.error('Failed to load members:', error);
    }
}

function renderMembers(members) {
    const container = document.getElementById('membersTable');
    
    if (members.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>No members yet. Click "Add Member" to get started!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Plan</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${members.map(member => `
                    <tr>
                        <td><strong>${escapeHtml(member.name)}</strong></td>
                        <td>${escapeHtml(member.email)}</td>
                        <td>${member.phone || '-'}</td>
                        <td>${member.plan_type || '-'}</td>
                        <td>${member.end_date || '-'}</td>
                        <td>${getMembershipBadge(member)}</td>
                        <td>
                            <div class="action-btns">
                                <button class="action-btn edit" onclick="editMember(${member.id})" title="Edit">✏️</button>
                                <button class="action-btn delete" onclick="deleteMember(${member.id}, '${escapeHtml(member.name)}')" title="Delete">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getMembershipBadge(member) {
    if (!member.end_date) {
        return '<span class="badge badge-info">No Plan</span>';
    }
    
    const endDate = new Date(member.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
        return '<span class="badge badge-danger">Expired</span>';
    } else if (daysRemaining <= 7) {
        return `<span class="badge badge-warning">${daysRemaining}d left</span>`;
    } else {
        return '<span class="badge badge-success">Active</span>';
    }
}

// Member Modal Functions
function openAddMemberModal() {
    document.getElementById('memberModalTitle').textContent = 'Add Member';
    document.getElementById('memberForm').reset();
    document.getElementById('memberId').value = '';
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('memberPassword').required = true;
    document.getElementById('memberModal').classList.add('active');
}

async function editMember(id) {
    try {
        const member = await apiRequest(`/admin/members/${id}`);
        
        document.getElementById('memberModalTitle').textContent = 'Edit Member';
        document.getElementById('memberId').value = member.id;
        document.getElementById('memberName').value = member.name;
        document.getElementById('memberEmail').value = member.email;
        document.getElementById('memberPhone').value = member.phone || '';
        document.getElementById('memberPassword').value = '';
        document.getElementById('memberPassword').required = false;
        document.getElementById('passwordGroup').querySelector('.form-label').textContent = 'New Password (leave blank to keep current)';
        document.getElementById('memberModal').classList.add('active');
    } catch (error) {
        console.error('Failed to load member:', error);
    }
}

function closeMemberModal() {
    document.getElementById('memberModal').classList.remove('active');
    document.getElementById('passwordGroup').querySelector('.form-label').textContent = 'Password';
}

async function deleteMember(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
        return;
    }

    try {
        await apiRequest(`/admin/members/${id}`, { method: 'DELETE' });
        showToast('success', 'Member deleted successfully');
        loadMembers();
        loadDashboard();
    } catch (error) {
        console.error('Failed to delete member:', error);
    }
}

// =====================================================
// MEMBERSHIPS
// =====================================================

async function loadMemberships() {
    try {
        const memberships = await apiRequest('/admin/memberships');
        renderMemberships(memberships);
    } catch (error) {
        console.error('Failed to load memberships:', error);
    }
}

function renderMemberships(memberships) {
    const container = document.getElementById('membershipsTable');
    
    if (memberships.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💳</div>
                <p>No memberships yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Member</th>
                    <th>Plan</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${memberships.map(m => {
                    const endDate = new Date(m.end_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                    
                    let statusBadge;
                    if (daysRemaining < 0) {
                        statusBadge = '<span class="badge badge-danger">Expired</span>';
                    } else if (daysRemaining <= 7) {
                        statusBadge = `<span class="badge badge-warning">${daysRemaining}d remaining</span>`;
                    } else {
                        statusBadge = '<span class="badge badge-success">Active</span>';
                    }

                    return `
                        <tr>
                            <td>
                                <strong>${escapeHtml(m.user_name)}</strong>
                                <div class="text-muted" style="font-size: 0.8rem;">${escapeHtml(m.user_email)}</div>
                            </td>
                            <td>${m.plan_type}</td>
                            <td>${m.start_date}</td>
                            <td>${m.end_date}</td>
                            <td>₹${m.amount.toLocaleString()}</td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function openAddMembershipModal() {
    try {
        // Load members for dropdown
        const members = await apiRequest('/admin/members');
        const select = document.getElementById('membershipUserId');
        
        // Get unique members (remove duplicates from JOIN)
        const uniqueMembers = [];
        const seen = new Set();
        members.forEach(m => {
            if (!seen.has(m.id)) {
                seen.add(m.id);
                uniqueMembers.push(m);
            }
        });

        select.innerHTML = '<option value="">Select a member...</option>' +
            uniqueMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('');

        // Set default dates
        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 1);

        document.getElementById('membershipStartDate').value = formatDate(today);
        document.getElementById('membershipEndDate').value = formatDate(endDate);
        document.getElementById('membershipAmount').value = '1500';
        document.getElementById('membershipPlanType').value = 'Monthly';
        
        document.getElementById('membershipModal').classList.add('active');
    } catch (error) {
        console.error('Failed to open membership modal:', error);
    }
}

function closeMembershipModal() {
    document.getElementById('membershipModal').classList.remove('active');
}

// =====================================================
// NOTIFICATIONS
// =====================================================

async function loadNotifications() {
    try {
        const notifications = await apiRequest('/admin/notifications');
        renderNotifications(notifications);
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

function renderNotifications(notifications) {
    const container = document.getElementById('notificationsTable');
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔔</div>
                <p>No notifications sent yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Member</th>
                    <th>Message</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${notifications.map(n => `
                    <tr>
                        <td>${new Date(n.created_at).toLocaleDateString()}</td>
                        <td>
                            <strong>${escapeHtml(n.user_name)}</strong>
                            <div class="text-muted" style="font-size: 0.8rem;">${escapeHtml(n.user_email)}</div>
                        </td>
                        <td>${escapeHtml(n.message)}</td>
                        <td>
                            ${n.is_read 
                                ? '<span class="badge badge-success">Read</span>' 
                                : '<span class="badge badge-warning">Unread</span>'
                            }
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function triggerNotificationCheck() {
    try {
        const result = await apiRequest('/admin/notifications/check', { method: 'POST' });
        showToast('success', result.message);
        loadNotifications();
        loadDashboard();
    } catch (error) {
        console.error('Failed to trigger notification check:', error);
    }
}

// =====================================================
// FORM HANDLERS
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;

    // Set user info
    const user = getUser();
    if (user) {
        document.getElementById('userName').textContent = user.username || 'Admin';
        document.getElementById('userAvatar').textContent = (user.username || 'A')[0].toUpperCase();
    }

    // Navigation click handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            showSection(item.dataset.section);
        });
    });

    // Member form handler
    document.getElementById('memberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('memberId').value;
        const data = {
            name: document.getElementById('memberName').value,
            email: document.getElementById('memberEmail').value,
            phone: document.getElementById('memberPhone').value,
            password: document.getElementById('memberPassword').value
        };

        // Remove empty password for edit
        if (!data.password) delete data.password;

        try {
            if (id) {
                await apiRequest(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) });
                showToast('success', 'Member updated successfully');
            } else {
                await apiRequest('/admin/members', { method: 'POST', body: JSON.stringify(data) });
                showToast('success', 'Member added successfully');
            }
            closeMemberModal();
            loadMembers();
            loadDashboard();
        } catch (error) {
            console.error('Failed to save member:', error);
        }
    });

    // Membership form handler
    document.getElementById('membershipForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            user_id: parseInt(document.getElementById('membershipUserId').value),
            plan_type: document.getElementById('membershipPlanType').value,
            start_date: document.getElementById('membershipStartDate').value,
            end_date: document.getElementById('membershipEndDate').value,
            amount: parseFloat(document.getElementById('membershipAmount').value)
        };

        try {
            await apiRequest('/admin/memberships', { method: 'POST', body: JSON.stringify(data) });
            showToast('success', 'Membership created successfully');
            closeMembershipModal();
            loadMemberships();
            loadDashboard();
        } catch (error) {
            console.error('Failed to create membership:', error);
        }
    });

    // Plan type change handler - auto-update amount and end date
    document.getElementById('membershipPlanType').addEventListener('change', (e) => {
        const startDate = new Date(document.getElementById('membershipStartDate').value);
        const endDate = new Date(startDate);
        let amount;

        switch (e.target.value) {
            case 'Monthly':
                endDate.setMonth(endDate.getMonth() + 1);
                amount = 1500;
                break;
            case 'Quarterly':
                endDate.setMonth(endDate.getMonth() + 3);
                amount = 4000;
                break;
            case 'Half-Yearly':
                endDate.setMonth(endDate.getMonth() + 6);
                amount = 7000;
                break;
            case 'Yearly':
                endDate.setFullYear(endDate.getFullYear() + 1);
                amount = 12000;
                break;
        }

        document.getElementById('membershipEndDate').value = formatDate(endDate);
        document.getElementById('membershipAmount').value = amount;
    });

    // Load initial dashboard
    loadDashboard();
});

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

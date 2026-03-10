let allUsers = [];

function getStatusBadge(status) {
    const map = { active: 'us-badge-active', blocked: 'us-badge-blocked', pending: 'us-badge-pending', inactive: 'us-badge-inactive' };
    return `<span class="us-badge ${map[status] || 'us-badge-inactive'}">${status}</span>`;
}

function getRoleBadge(role) {
    const map = { student: 'us-badge-student', official: 'us-badge-official', admin: 'us-badge-admin', club: 'us-badge-club' };
    return `<span class="us-badge ${map[role] || 'us-badge-student'}">${role}</span>`;
}

function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">
            <div class="us-empty">
                <div class="us-empty-icon"><i class="fa-solid fa-users"></i></div>
                <strong>No users found</strong>
                <span>Try adjusting the filters above.</span>
            </div></td></tr>`;
        return;
    }
    tbody.innerHTML = users.map((user, idx) => `
        <tr style="animation-delay:${idx * 0.03}s;">
            <td>
                <div style="display:flex;align-items:center;gap:0.75rem;">
                    <div class="us-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div>
                        <div style="font-weight:600;color:hsl(221,39%,11%);font-size:0.875rem;">${user.username}</div>
                        <div style="font-size:0.75rem;color:hsl(220,14%,50%);">${user.email}</div>
                    </div>
                </div>
            </td>
            <td>${getRoleBadge(user.role)}</td>
            <td>${getStatusBadge(user.status)}</td>
            <td style="font-size:0.8125rem;color:hsl(220,14%,50%);">${user.joinDate}</td>
            <td>
                <button class="us-toggle ${user.status === 'active' ? 'active' : ''}"
                    data-user-id="${user.id}" onclick="toggleUser(${user.id})"
                    title="Toggle Status"></button>
            </td>
            <td>
                <button onclick="viewUserDetails(${user.id})" class="us-view-btn">
                    <i class="fas fa-eye" style="font-size:0.7rem;"></i> View
                </button>
            </td>
        </tr>
    `).join('');
}

window.toggleUser = async function (userId) {
    const toggle = document.querySelector(`[data-user-id="${userId}"]`);
    toggle.disabled = true; toggle.style.opacity = '0.5';
    const result = await API.toggleUser(userId);
    if (result && result.success) {
        const user = allUsers.find(u => u.id === userId);
        if (user) { user.status = user.status === 'active' ? 'blocked' : 'active'; filterAndRenderUsers(); }
    }
    if (toggle) { toggle.disabled = false; toggle.style.opacity = '1'; }
};

function filterAndRenderUsers() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const role = document.getElementById('role-filter').value;
    const branch = document.getElementById('branch-filter').value;
    const status = document.getElementById('status-filter').value;

    let filtered = [...allUsers];
    if (search) filtered = filtered.filter(u => u.username.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
    if (role) filtered = filtered.filter(u => u.role === role);
    if (branch) filtered = filtered.filter(u => u.major === branch);
    if (status) filtered = filtered.filter(u => u.status === status);
    filtered.sort((a, b) => a.username.localeCompare(b.username));
    renderUsers(filtered);
}

async function initUsers() {
    allUsers = await API.getUsers();
    allUsers.sort((a, b) => a.username.localeCompare(b.username));

    const branches = [...new Set(allUsers.map(u => u.major).filter(Boolean))].sort();
    const branchSelect = document.getElementById('branch-filter');
    branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b; opt.textContent = b;
        branchSelect.appendChild(opt);
    });

    document.getElementById('users-loading').style.display = 'none';
    document.getElementById('users-table').style.display = 'table';
    filterAndRenderUsers();

    document.getElementById('search-input').addEventListener('input', filterAndRenderUsers);
    document.getElementById('role-filter').addEventListener('change', filterAndRenderUsers);
    document.getElementById('branch-filter').addEventListener('change', filterAndRenderUsers);
    document.getElementById('status-filter').addEventListener('change', filterAndRenderUsers);
}
document.addEventListener('DOMContentLoaded', initUsers);

// ─── USER DETAILS MODAL ──────────────────────────────────────────
window.viewUserDetails = async function (userId) {
    const modal = document.getElementById('user-details-modal');
    const loading = document.getElementById('modal-loading');
    const content = document.getElementById('modal-data');
    modal.style.display = 'flex';
    loading.style.display = 'block';
    content.style.display = 'none';
    try {
        const response = await fetch(`/admin/api/users/${userId}/details`);
        const data = await response.json();
        if (response.ok) {
            document.getElementById('modal-avatar').src = data.profile_picture;
            document.getElementById('modal-name').textContent = data.full_name;
            document.getElementById('modal-email').textContent = data.email;

            const roleBadge = document.getElementById('modal-role');
            const roleMap = { admin: 'us-badge-admin', official: 'us-badge-official', student: 'us-badge-student', club: 'us-badge-club' };
            roleBadge.textContent = data.role;
            roleBadge.className = 'us-badge ' + (roleMap[data.role] || 'us-badge-student');

            document.getElementById('modal-status').textContent = data.status;
            document.getElementById('modal-status').style.color = data.status === 'active' ? 'hsl(142,60%,30%)' : 'hsl(0,65%,45%)';
            document.getElementById('modal-joined').textContent = data.joined_date;
            document.getElementById('modal-university').textContent = data.university || 'N/A';
            document.getElementById('modal-major').textContent = data.major || 'N/A';
            document.getElementById('modal-batch').textContent = data.batch || 'N/A';
            document.getElementById('modal-id').textContent = `#${data.id}`;
            document.getElementById('modal-posts-count').textContent = data.stats.posts;
            document.getElementById('modal-connections-count').textContent = data.stats.connections;

            loading.style.display = 'none';
            content.style.display = 'block';
        } else { showToast('Error', 'Failed to load user details', 'error'); closeUserModal(); }
    } catch (error) { console.error('Error:', error); showToast('Error', 'Error loading user details', 'error'); closeUserModal(); }
};

window.closeUserModal = function () { document.getElementById('user-details-modal').style.display = 'none'; };

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('user-details-modal').addEventListener('click', function (e) {
        if (e.target === this) closeUserModal();
    });
});
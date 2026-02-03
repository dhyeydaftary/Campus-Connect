let allUsers = [];
// Get status badge class
function getStatusBadge(status) {
    const classes = {
        active: 'badge-success',
        blocked: 'badge-danger',
        inactive: 'badge-secondary'
    };
    return classes[status] || 'badge-secondary';
}
// Render users table
function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="flex items-center gap-4">
                    <div class="admin-avatar" style="width: 40px; height: 40px; font-size: 0.875rem;">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">${user.username}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${user.email}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge badge-info">${user.role}</span>
            </td>
            <td>
                <span class="badge ${getStatusBadge(user.status)}">${user.status}</span>
            </td>
            <td style="color: var(--text-secondary);">${user.joinDate}</td>
            <td>
                <div class="toggle-switch ${user.status === 'active' ? 'active' : ''}" 
                    data-user-id="${user.id}"
                    onclick="toggleUser(${user.id})">
                </div>
            </td>
        </tr>
    `).join('');
}
// Toggle user status
window.toggleUser = async function(userId) {
    const toggle = document.querySelector(`[data-user-id="${userId}"]`);
    toggle.style.opacity = '0.5';
    toggle.style.pointerEvents = 'none';
    const result = await API.toggleUser(userId);

    if (result.success) {
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            user.status = user.status === 'active' ? 'blocked' : 'active';
            filterAndRenderUsers();
        }
    }
    toggle.style.opacity = '1';
    toggle.style.pointerEvents = 'auto';
}
// Filter users
function filterAndRenderUsers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const roleFilter = document.getElementById('role-filter').value;
    let filtered = allUsers;
    if (searchTerm) {
        filtered = filtered.filter(user =>
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );
    }
    if (roleFilter) {
        filtered = filtered.filter(user => user.role === roleFilter);
    }
    renderUsers(filtered);
}
// Initialize page
async function initUsers() {
    allUsers = await API.getUsers();

    document.getElementById('users-loading').style.display = 'none';
    document.getElementById('users-table').style.display = 'table';

    renderUsers(allUsers);
    // Add event listeners for filters
    document.getElementById('search-input').addEventListener('input', filterAndRenderUsers);
    document.getElementById('role-filter').addEventListener('change', filterAndRenderUsers);
}
document.addEventListener('DOMContentLoaded', initUsers);
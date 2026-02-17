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
            <td class="px-4 py-3 text-left">
                <div class="flex items-center justify-start gap-4">
                    <div class="admin-avatar" style="width: 40px; height: 40px; font-size: 0.875rem;">
                        ${user.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="text-left">
                        <div style="font-weight: 600; color: var(--text-primary);">${user.username}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${user.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-left">
                <span class="badge badge-info">${user.role}</span>
            </td>
            <td class="px-4 py-3 text-left">
                <span class="badge ${getStatusBadge(user.status)}">${user.status}</span>
            </td>
            <td class="px-4 py-3 text-left" style="color: var(--text-secondary);">${user.joinDate}</td>
            <td class="px-4 py-3 text-left">
                <div class="flex items-left justify-start">
                    <div class="toggle-switch ${user.status === 'active' ? 'active' : ''}" 
                        data-user-id="${user.id}"
                        onclick="toggleUser(${user.id})"
                        title="Toggle Status">
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-left">
                <div class="flex items-left justify-start">
                    <button onclick="viewUserDetails(${user.id})" class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
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
    const branchFilter = document.getElementById('branch-filter').value;
    let filtered = [...allUsers];
    if (searchTerm) {
        filtered = filtered.filter(user =>
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );
    }
    if (roleFilter) {
        filtered = filtered.filter(user => user.role === roleFilter);
    }
    if (branchFilter) {
        filtered = filtered.filter(user => user.branch === branchFilter);
    }

    // Default sort: Name (A-Z)
    filtered.sort((a, b) => a.username.localeCompare(b.username));

    renderUsers(filtered);
}
// Initialize page
async function initUsers() {
    allUsers = await API.getUsers();

    // Initial sort
    allUsers.sort((a, b) => a.username.localeCompare(b.username));

    // Populate branch filter dynamically based on available users
    const branches = [...new Set(allUsers.map(u => u.branch).filter(b => b))].sort();
    const branchSelect = document.getElementById('branch-filter');
    branches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchSelect.appendChild(option);
    });

    document.getElementById('users-loading').style.display = 'none';
    document.getElementById('users-table').style.display = 'table';

    renderUsers(allUsers);
    // Add event listeners for filters
    document.getElementById('search-input').addEventListener('input', filterAndRenderUsers);
    document.getElementById('role-filter').addEventListener('change', filterAndRenderUsers);
    document.getElementById('branch-filter').addEventListener('change', filterAndRenderUsers);
}
document.addEventListener('DOMContentLoaded', initUsers);

// View User Details Modal Logic
window.viewUserDetails = async function(userId) {
    const modal = document.getElementById('user-details-modal');
    const loading = document.getElementById('modal-loading');
    const content = document.getElementById('modal-data');
    
    // Show modal
    modal.style.display = 'flex';
    loading.style.display = 'flex';
    content.classList.add('hidden');
    
    try {
        const response = await fetch(`/admin/api/users/${userId}/details`);
        const data = await response.json();
        
        if (response.ok) {
            // Populate data
            document.getElementById('modal-avatar').src = data.profile_picture;
            document.getElementById('modal-name').textContent = data.full_name;
            document.getElementById('modal-email').textContent = data.email;
            
            const roleBadge = document.getElementById('modal-role');
            roleBadge.textContent = data.role;
            roleBadge.className = `mt-2 px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                data.role === 'admin' ? 'bg-red-100 text-red-700' : 
                data.role === 'official' ? 'bg-blue-100 text-blue-700' : 
                'bg-green-100 text-green-700'
            }`;
            
            document.getElementById('modal-status').textContent = data.status;
            document.getElementById('modal-status').className = `font-medium capitalize ${data.status === 'active' ? 'text-green-600' : 'text-red-600'}`;
            
            document.getElementById('modal-joined').textContent = data.joined_date;
            document.getElementById('modal-university').textContent = data.university || 'N/A';
            document.getElementById('modal-major').textContent = data.major || 'N/A';
            document.getElementById('modal-batch').textContent = data.batch || 'N/A';
            document.getElementById('modal-id').textContent = `#${data.id}`;
            
            document.getElementById('modal-posts-count').textContent = data.stats.posts;
            document.getElementById('modal-connections-count').textContent = data.stats.connections;
            
            // Show content
            loading.style.display = 'none';
            content.classList.remove('hidden');
        } else {
            alert('Failed to load user details');
            closeUserModal();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error loading user details');
        closeUserModal();
    }
}

window.closeUserModal = function() {
    document.getElementById('user-details-modal').style.display = 'none';
}

// Close on outside click
document.getElementById('user-details-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeUserModal();
    }
});
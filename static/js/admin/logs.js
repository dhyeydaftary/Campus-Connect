let allLogs = [];

// Get action badge class
function getActionBadge(action) {
    const a = action.toLowerCase();

    if (a.includes('create')) return 'badge-success';
    if (a.includes('toggle')) return 'badge-warning';
    if (a.includes('delete') || a.includes('remove')) return 'badge-danger';

    return 'badge-secondary';
}

// Render logs table
function renderLogs(logs) {
    const tbody = document.getElementById('logs-tbody');
    tbody.innerHTML = logs.map(log => `
        <tr>
            <td style="white-space: nowrap; color: var(--text-secondary);">
                ${log.timestamp}
            </td>
            <td>
                <span class="badge ${getActionBadge(log.action)}">${log.action}</span>
            </td>
            <td style="font-weight: 500;">${log.target}</td>
            <td style="color: var(--text-secondary);">${log.admin}</td>
            <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-secondary);">
                ${log.ip}
            </td>
        </tr>
    `).join('');
}

// Filter logs
function filterAndRenderLogs() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const actionFilter = document.getElementById('action-filter').value;
    let filtered = allLogs;
    if (searchTerm) {
        filtered = filtered.filter(log =>
            log.action.toLowerCase().includes(searchTerm) ||
            log.target.toLowerCase().includes(searchTerm) ||
            log.admin.toLowerCase().includes(searchTerm)
        );
    }
    if (actionFilter) {
        filtered = filtered.filter(log => log.action.includes(actionFilter));
    }
    renderLogs(filtered);
}

// Download logs
window.downloadLogs = function() {
    window.location.href = '/admin/api/logs/download';
}

// Initialize page
async function initLogs() {
    allLogs = await API.getLogs();
    document.getElementById('logs-loading').style.display = 'none';
    document.getElementById('logs-table').style.display = 'table';
    renderLogs(allLogs);
    // Add event listeners for filters
    document.getElementById('search-input').addEventListener('input', filterAndRenderLogs);
    document.getElementById('action-filter').addEventListener('change', filterAndRenderLogs);
}
document.addEventListener('DOMContentLoaded', initLogs);
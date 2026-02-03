// Get status colors
function getStatusColor(status) {
    if (status === 'online') return 'online';
    if (status === 'warning') return 'warning';
    return 'offline';
}
// Load and render system status
async function loadSystemStatus() {
    const status = await API.getSystemStatus();
    // Update last updated time
    document.getElementById('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    // Render overview cards
    const overviewHtml = Object.entries(status).map(([key, info]) => `
        <div class="kpi-card">
            <div class="flex items-center justify-between mb-4">
                <div class="status-dot ${getStatusColor(info.status)}"></div>
                <span class="badge badge-${info.status === 'online' ? 'success' : info.status === 'warning' ? 'warning' : 'danger'}">
                ${info.status.toUpperCase()}
                </span>
            </div>
            <div class="kpi-label" style="margin-bottom: 0.25rem;">${info.name}</div>
            <div style="font-size: 0.875rem; color: var(--text-secondary);">
                Uptime: ${info.uptime}
            </div>
        </div>
    `).join('');
    document.getElementById('system-overview').innerHTML = overviewHtml;
    // Render service status list
    const serviceHtml = Object.entries(status).map(([key, info]) => {
        let metric = '';
        if (info.responseTime) metric = `Response: ${info.responseTime}`;
        else if (info.connections) metric = `Connections: ${info.connections}`;
        else if (info.hitRate) metric = `Hit Rate: ${info.hitRate}`;
        else if (info.usage) metric = `Usage: ${info.usage}`;
        else if (info.queue) metric = `Queue: ${info.queue} pending`;
        else if (info.indexing) metric = `Status: ${info.indexing}`;
        return `
            <div class="status-indicator">
                <div class="status-dot ${getStatusColor(info.status)}"></div>
                <div class="status-info">
                    <div class="status-name">${info.name}</div>
                    <div class="status-detail">${metric}</div>
                </div>
                <span class="badge badge-${info.status === 'online' ? 'success' : info.status === 'warning' ? 'warning' : 'danger'}">
                    ${info.uptime}
                </span>
            </div>
        `;
    }).join('');
    document.getElementById('service-status').innerHTML = serviceHtml;
}
// Refresh status
window.refreshStatus = async function() {
    document.getElementById('system-overview').innerHTML = `
        <div class="loading-spinner" style="grid-column: 1 / -1;">
            <div class="spinner"></div>
        </div>
    `;
    await loadSystemStatus();
}
// Initialize
document.addEventListener('DOMContentLoaded', loadSystemStatus);
// Auto-refresh every 30 seconds
setInterval(loadSystemStatus, 30000);
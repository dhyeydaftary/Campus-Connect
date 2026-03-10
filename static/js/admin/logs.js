let allLogs = [];

function getActionBadge(action) {
    const a = action.toLowerCase();
    if (a.includes('create')) return 'lg-badge lg-badge-create';
    if (a.includes('toggle')) return 'lg-badge lg-badge-toggle';
    if (a.includes('delete') || a.includes('remove')) return 'lg-badge lg-badge-delete';
    return 'lg-badge lg-badge-other';
}

function renderLogs(logs) {
    const tbody = document.getElementById('logs-tbody');

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">
            <div class="lg-empty">
                <div class="lg-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
                <strong>No logs found</strong>
                <span>Try adjusting your search or filter.</span>
            </div></td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map((log, idx) => `
        <tr style="animation-delay:${idx * 0.025}s;">
            <td style="font-size:0.8125rem;color:hsl(220,14%,50%);white-space:nowrap;">${log.timestamp}</td>
            <td><span class="${getActionBadge(log.action)}">${log.action}</span></td>
            <td style="font-weight:600;color:hsl(221,39%,11%);">${log.target}</td>
            <td style="font-size:0.875rem;color:hsl(220,14%,46%);">${log.admin}</td>
            <td style="font-family:'Courier New',monospace;font-size:0.8125rem;color:hsl(220,14%,50%);">${log.ip}</td>
        </tr>
    `).join('');
}

function filterAndRenderLogs() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const action = document.getElementById('action-filter').value;
    let filtered = allLogs;
    if (search) filtered = filtered.filter(l =>
        l.action.toLowerCase().includes(search) ||
        l.target.toLowerCase().includes(search) ||
        l.admin.toLowerCase().includes(search)
    );
    if (action) filtered = filtered.filter(l => l.action.includes(action));
    renderLogs(filtered);
}

window.downloadLogs = function () { window.location.href = '/admin/api/logs/download'; };

async function initLogs() {
    allLogs = await API.getLogs();
    document.getElementById('logs-loading').style.display = 'none';
    document.getElementById('logs-table').style.display = 'table';
    renderLogs(allLogs);
    document.getElementById('search-input').addEventListener('input', filterAndRenderLogs);
    document.getElementById('action-filter').addEventListener('change', filterAndRenderLogs);
}
document.addEventListener('DOMContentLoaded', initLogs);
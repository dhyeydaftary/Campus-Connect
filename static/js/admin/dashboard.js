// Chart instances
let userGrowthChart, roleDistributionChart, contentActivityChart;
// Initialize dashboard
async function initDashboard() {
    const data = await API.getDashboardOverview();

    // Update KPIs
    document.getElementById('total-users').textContent = data.totalUsers.toLocaleString();
    document.getElementById('official-users').textContent = data.officialUsers.toLocaleString();
    document.getElementById('blocked-users').textContent = data.blockedUsers.toLocaleString();
    document.getElementById('total-posts').textContent = data.totalPosts.toLocaleString();
    document.getElementById('active-events').textContent = data.activeEvents.toLocaleString();
    // User Growth Chart
    const userGrowthCtx = document.getElementById('userGrowthChart').getContext('2d');
    userGrowthChart = new Chart(userGrowthCtx, {
        type: 'line',
        data: {
            labels: data.userGrowth.map(d => d.month),
            datasets: [{
                label: 'Users',
                data: data.userGrowth.map(d => d.users),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
    
    // Role Distribution Chart
    const roleDistCtx = document.getElementById('roleDistributionChart').getContext('2d');
    const roles = data.roleDistribution;

    roleDistributionChart = new Chart(roleDistCtx, {
        type: 'doughnut',
        data: {
            labels: ['Students', 'Officials', 'Admins', 'Clubs'],
            datasets: [{
                data: [
                    roles.student || 0,
                    roles.official || 0,
                    roles.admin || 0,
                    roles.club || 0
                ],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { usePointStyle: true, padding: 20 }
                }
            },
            cutout: '65%'
        }
    });

    // Content Activity Chart
    const contentCtx = document
        .getElementById('contentActivityChart')
        .getContext('2d');

    const labels = data.userGrowth.map(d => d.month);

    // backend sends [total] → normalize to number
    const totalPosts = Array.isArray(data.contentActivity.posts)
        ? data.contentActivity.posts[0]
        : data.contentActivity.posts;

    const totalEvents = Array.isArray(data.contentActivity.events)
        ? data.contentActivity.events[0]
        : data.contentActivity.events;

    contentActivityChart = new Chart(contentCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Posts',
                    data: labels.map(() => totalPosts),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                },
                {
                    label: 'Events',
                    data: labels.map(() => totalEvents),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // Top Accounts
    const topAccountsHtml = data.topAccounts.map(account => `
        <div class="account-item">
            <div class="account-avatar">${account.name.charAt(0)}</div>
            <div class="account-info">
                <div class="account-name">${account.name}</div>
                <div class="account-type">${account.type}</div>
            </div>
            <div class="account-followers">${account.followers.toLocaleString()} followers</div>
        </div>
    `).join('');
    document.getElementById('top-accounts').innerHTML = topAccountsHtml;
    // System Health
    const healthHtml = Object.entries(data.systemHealth).map(([key, info]) => `
        <div class="status-indicator">
            <div class="status-dot ${info.status}"></div>
            <div class="status-info">
                <div class="status-name">${key.toUpperCase()}</div>
                <div class="status-detail">${info.latency ? `Latency: ${info.latency}ms` : info.usage ? `Usage: ${info.usage}%` : `Hit Rate: ${info.hitRate}%`}</div>
            </div>
            <span class="badge badge-${info.status === 'online' ? 'success' : 'warning'}">${info.status}</span>
        </div>
    `).join('');
    document.getElementById('system-health').innerHTML = healthHtml;
}
// Initialize on load
document.addEventListener('DOMContentLoaded', initDashboard);
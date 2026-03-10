document.addEventListener('DOMContentLoaded', function () {

    var tabTickets = document.getElementById('tab-tickets');
    var tabReports = document.getElementById('tab-reports');
    var viewTickets = document.getElementById('view-tickets');
    var viewReports = document.getElementById('view-reports');
    var ticketsTableBody = document.getElementById('tickets-table-body');
    var reportsTableBody = document.getElementById('reports-table-body');
    var statusFilter = document.getElementById('status-filter');
    var currentView = 'tickets';

    // ─── BADGE HELPERS ───────────────────────────────────────────
    function getStatusBadge(status) {
        var map = {
            'open': 'badge-open', 'new': 'badge-open',
            'in_progress': 'badge-in_progress', 'investigating': 'badge-in_progress',
            'resolved': 'badge-resolved', 'closed': 'badge-closed', 'duplicate': 'badge-closed'
        };
        var cls = map[status] || 'badge-open';
        var text = status.replace(/_/g, ' ').toUpperCase();
        return '<span class="badge ' + cls + '"><span class="badge-dot"></span>' + text + '</span>';
    }

    function getPriorityBadge(priority) {
        if (!priority) return '<span style="color:hsl(220,14%,65%);">—</span>';
        var styles = {
            'low': 'color:hsl(220,14%,46%);font-weight:600;',
            'normal': 'color:hsl(221,68%,40%);font-weight:600;',
            'high': 'color:hsl(25,95%,45%);font-weight:700;',
            'critical': 'color:hsl(0,72%,48%);font-weight:700;'
        };
        var style = styles[priority] || styles['normal'];
        var icon = (priority === 'high' || priority === 'critical')
            ? '<i class="fa-solid fa-triangle-exclamation" style="margin-right:3px;font-size:0.65rem;"></i>' : '';
        return '<span style="font-size:0.75rem;' + style + '">' + icon + priority.toUpperCase() + '</span>';
    }

    // ─── SKELETON ────────────────────────────────────────────────
    function buildSkeletonRows(cols, rows) {
        var widths = [60, 120, 160, 95, 85, 110, 80];
        var html = '';
        for (var r = 0; r < rows; r++) {
            html += '<tr class="sk-row">';
            for (var c = 0; c < cols; c++) {
                var w = widths[c] || 90;
                html += '<td><div class="sk-block" style="width:' + (w + (r * 15 % 30)) + 'px;"></div></td>';
            }
            html += '</tr>';
        }
        return html;
    }

    // ─── STATS ───────────────────────────────────────────────────
    function updateStats(data) {
        var open = 0, progress = 0, resolved = 0;
        if (data && data.length) {
            data.forEach(function (t) {
                if (t.status === 'open' || t.status === 'new') open++;
                else if (t.status === 'in_progress' || t.status === 'investigating') progress++;
                else if (t.status === 'resolved') resolved++;
            });
        }
        animateCounter('stat-open', open);
        animateCounter('stat-progress', progress);
        animateCounter('stat-resolved', resolved);
        animateCounter('stat-total', data ? data.length : 0);
    }

    function animateCounter(id, target) {
        var el = document.getElementById(id);
        if (!el) return;
        var start = performance.now(), duration = 600;
        var from = parseInt(el.textContent) || 0;
        if (isNaN(from)) from = 0;
        function tick(now) {
            var p = Math.min((now - start) / duration, 1);
            var e = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(from + (target - from) * e);
            if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ─── LOAD TICKETS ────────────────────────────────────────────
    function loadTickets() {
        var filter = statusFilter.value;
        var mappedFilter = filter === 'new' ? 'open' : filter;
        ticketsTableBody.innerHTML = buildSkeletonRows(6, 3);

        fetch('/admin/api/tickets?status=' + mappedFilter)
            .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
            .then(function (data) {
                ticketsTableBody.innerHTML = '';
                if (!data || data.length === 0) {
                    ticketsTableBody.innerHTML =
                        '<tr><td colspan="6"><div class="tk-empty">' +
                        '<div class="tk-empty-icon"><i class="fa-solid fa-ticket"></i></div>' +
                        '<p>No tickets found</p><p>There are no support tickets matching this filter.</p>' +
                        '</div></td></tr>';
                    updateStats([]); return;
                }
                updateStats(data);
                data.forEach(function (ticket, idx) {
                    var tr = document.createElement('tr');
                    tr.style.animationDelay = (idx * 0.04) + 's';
                    var options = ['open', 'in_progress', 'resolved', 'closed'].map(function (opt) {
                        return '<option value="' + opt + '"' + (ticket.status === opt ? ' selected' : '') + '>' + opt.replace('_', ' ').toUpperCase() + '</option>';
                    }).join('');
                    tr.innerHTML =
                        '<td><span class="tk-id">TKT-' + ticket.id + '</span></td>' +
                        '<td><p class="tk-name">' + ticket.name + '</p><p class="tk-email">' + ticket.email + '</p></td>' +
                        '<td><span class="tk-subject" title="' + ticket.subject + '">' + ticket.subject + '</span></td>' +
                        '<td><p class="tk-category">' + (ticket.category || '—') + '</p>' +
                        '<p style="margin-top:0.25rem;">' + getPriorityBadge(ticket.priority) + '</p></td>' +
                        '<td style="font-size:0.8125rem;color:hsl(220,14%,46%);">' + ticket.created_at + '</td>' +
                        '<td><div style="display:flex;align-items:center;gap:0.5rem;">' +
                        getStatusBadge(ticket.status) +
                        '<select class="status-select" data-id="' + ticket.id + '" data-original="' + ticket.status + '">' + options + '</select>' +
                        '</div></td>';
                    ticketsTableBody.appendChild(tr);
                });
                attachStatusListeners();
            })
            .catch(function (err) {
                console.error('loadTickets error:', err);
                ticketsTableBody.innerHTML =
                    '<tr><td colspan="6"><div class="tk-empty">' +
                    '<div class="tk-empty-icon" style="background:hsl(0,90%,95%);color:hsl(0,65%,48%);"><i class="fa-solid fa-circle-exclamation"></i></div>' +
                    '<p style="color:hsl(0,65%,45%);">Error loading tickets</p><p>Please try refreshing the page.</p>' +
                    '</div></td></tr>';
                updateStats([]);
            });
    }

    // ─── LOAD REPORTS ────────────────────────────────────────────
    function loadReports() {
        var filter = statusFilter.value;
        var mappedFilter = filter === 'open' ? 'new' : filter;
        reportsTableBody.innerHTML = buildSkeletonRows(7, 3);

        fetch('/admin/api/reports?status=' + mappedFilter)
            .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
            .then(function (data) {
                reportsTableBody.innerHTML = '';
                if (!data || data.length === 0) {
                    reportsTableBody.innerHTML =
                        '<tr><td colspan="7"><div class="tk-empty">' +
                        '<div class="tk-empty-icon"><i class="fa-solid fa-flag"></i></div>' +
                        '<p>No reports found</p><p>There are no issue reports matching this filter.</p>' +
                        '</div></td></tr>';
                    return;
                }
                var typeColors = { 'bug': 'hsl(25,95%,45%)', 'security': 'hsl(270,60%,50%)', 'abuse': 'hsl(0,65%,48%)', 'other': 'hsl(220,14%,46%)' };
                data.forEach(function (r, idx) {
                    var tr = document.createElement('tr');
                    tr.style.animationDelay = (idx * 0.04) + 's';
                    var typeColor = typeColors[r.type] || typeColors['other'];
                    tr.innerHTML =
                        '<td><span class="tk-id">RPT-' + r.id + '</span></td>' +
                        '<td style="font-size:0.875rem;">' + r.email + '</td>' +
                        '<td style="font-weight:700;text-transform:capitalize;color:' + typeColor + ';font-size:0.875rem;">' + r.type + '</td>' +
                        '<td><span class="tk-subject" title="' + r.title + '">' + r.title + '</span></td>' +
                        '<td>' + getPriorityBadge(r.severity) + '</td>' +
                        '<td style="font-size:0.8125rem;color:hsl(220,14%,46%);">' + r.created_at + '</td>' +
                        '<td>' + getStatusBadge(r.status) + '</td>';
                    reportsTableBody.appendChild(tr);
                });
            })
            .catch(function (err) {
                console.error('loadReports error:', err);
                reportsTableBody.innerHTML =
                    '<tr><td colspan="7"><div class="tk-empty">' +
                    '<div class="tk-empty-icon" style="background:hsl(0,90%,95%);color:hsl(0,65%,48%);"><i class="fa-solid fa-circle-exclamation"></i></div>' +
                    '<p style="color:hsl(0,65%,45%);">Error loading reports</p><p>Please try refreshing the page.</p>' +
                    '</div></td></tr>';
            });
    }

    // ─── STATUS LISTENERS ────────────────────────────────────────
    function attachStatusListeners() {
        document.querySelectorAll('.status-select').forEach(function (select) {
            select.addEventListener('change', function (e) {
                var id = e.target.getAttribute('data-id');
                var newStatus = e.target.value;
                var original = e.target.getAttribute('data-original') || e.target.value;
                e.target.disabled = true;
                fetch('/admin/api/tickets/' + id + '/status', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                })
                    .then(function (res) { if (!res.ok) throw new Error(); return res.json(); })
                    .then(function (res) {
                        if (res && res.success) {
                            showToast('Updated', 'Ticket #' + id + ' → ' + newStatus.replace('_', ' '), 'success');
                            loadTickets();
                        } else { e.target.value = original; e.target.disabled = false; showToast('Error', 'Failed to update ticket status', 'error'); }
                    })
                    .catch(function () { e.target.value = original; e.target.disabled = false; showToast('Error', 'Network error. Please try again.', 'error'); });
            });
        });
    }

    // ─── TAB SWITCHING ───────────────────────────────────────────
    tabTickets.addEventListener('click', function () {
        if (currentView === 'tickets') return;
        currentView = 'tickets';
        tabTickets.classList.add('active'); tabReports.classList.remove('active');
        viewTickets.style.display = ''; viewReports.style.display = 'none';
        loadTickets();
    });
    tabReports.addEventListener('click', function () {
        if (currentView === 'reports') return;
        currentView = 'reports';
        tabReports.classList.add('active'); tabTickets.classList.remove('active');
        viewReports.style.display = ''; viewTickets.style.display = 'none';
        loadReports();
    });

    statusFilter.addEventListener('change', function () {
        if (currentView === 'tickets') loadTickets(); else loadReports();
    });

    loadTickets();
});
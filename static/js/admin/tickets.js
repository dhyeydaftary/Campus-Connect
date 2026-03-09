document.addEventListener('DOMContentLoaded', function () {

    // ─── UI ELEMENTS ───
    var tabTickets = document.getElementById('tab-tickets');
    var tabReports = document.getElementById('tab-reports');
    var viewTickets = document.getElementById('view-tickets');
    var viewReports = document.getElementById('view-reports');
    var ticketsTableBody = document.getElementById('tickets-table-body');
    var reportsTableBody = document.getElementById('reports-table-body');
    var statusFilter = document.getElementById('status-filter');
    var toastContainer = document.getElementById('toast-container');

    var currentView = 'tickets';


    // ─── BADGE HELPERS ───
    function getStatusBadge(status) {
        var styleMap = {
            'open': 'badge-open',
            'new': 'badge-open',
            'in_progress': 'badge-in_progress',
            'investigating': 'badge-in_progress',
            'resolved': 'badge-resolved',
            'closed': 'badge-closed',
            'duplicate': 'badge-closed'
        };
        var cls = styleMap[status] || 'badge-open';
        var display = status.replace('_', ' ').toUpperCase();
        return '<span class="badge ' + cls + '">' +
            '<span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;"></span>' +
            display + '</span>';
    }

    function getPriorityBadge(priority) {
        if (!priority) return '<span style="color:hsl(220,14%,70%);">—</span>';
        var styles = {
            'low': 'color:hsl(220,14%,46%);',
            'normal': 'color:hsl(221,68%,40%);',
            'high': 'color:hsl(25,95%,50%);font-weight:700;',
            'critical': 'color:hsl(0,72%,51%);font-weight:700;'
        };
        var style = styles[priority] || styles['normal'];
        var icon = (priority === 'high' || priority === 'critical')
            ? '<i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i>'
            : '';
        return '<span style="' + style + '">' + icon + priority.toUpperCase() + '</span>';
    }

    // ─── DATA LOADERS ───
    function loadTickets() {
        var filter = statusFilter.value;
        var mappedFilter = filter === 'new' ? 'open' : filter;

        ticketsTableBody.innerHTML = buildSkeletonRows(6, 3);

        AdminAPI.get('/tickets?status=' + mappedFilter)
            .then(function (data) {
                ticketsTableBody.innerHTML = '';

                if (!data || data.length === 0) {
                    ticketsTableBody.innerHTML =
                        '<tr><td colspan="6">' +
                        '<div class="empty-state">' +
                        '<div class="empty-state-icon"><i class="fa-solid fa-ticket"></i></div>' +
                        '<p style="font-weight:600;color:hsl(221,39%,11%);margin-bottom:0.25rem;">No tickets found</p>' +
                        '<p style="color:hsl(220,14%,46%);font-size:0.875rem;">There are no support tickets matching this filter.</p>' +
                        '</div></td></tr>';
                    updateStats([]);
                    return;
                }

                updateStats(data);

                data.forEach(function (ticket, idx) {
                    var tr = document.createElement('tr');
                    tr.style.animationDelay = (idx * 0.04) + 's';

                    var options = ['open', 'in_progress', 'resolved', 'closed'].map(function (opt) {
                        var sel = ticket.status === opt ? ' selected' : '';
                        return '<option value="' + opt + '"' + sel + '>' + opt.replace('_', ' ').toUpperCase() + '</option>';
                    }).join('');

                    tr.innerHTML =
                        '<td class="font-mono text-xs" style="color:hsl(220,14%,46%);">TKT-' + ticket.id + '</td>' +
                        '<td><p style="font-weight:600;color:hsl(221,39%,11%);">' + ticket.name + '</p>' +
                        '<p style="font-size:0.75rem;color:hsl(220,14%,46%);">' + ticket.email + '</p></td>' +
                        '<td style="max-width:200px;" class="truncate" title="' + ticket.subject + '">' + ticket.subject + '</td>' +
                        '<td><p style="font-size:0.875rem;color:hsl(221,39%,30%);text-transform:capitalize;">' + ticket.category + '</p>' +
                        '<p style="margin-top:0.25rem;">' + getPriorityBadge(ticket.priority) + '</p></td>' +
                        '<td style="font-size:0.875rem;color:hsl(220,14%,46%);">' + ticket.created_at + '</td>' +
                        '<td><div style="display:flex;align-items:center;gap:0.5rem;">' +
                        getStatusBadge(ticket.status) +
                        '<select class="status-select" data-id="' + ticket.id + '" data-original="' + ticket.status + '">' + options + '</select>' +
                        '</div></td>';

                    ticketsTableBody.appendChild(tr);
                });

                attachStatusListeners();
            })
            .catch(function () {
                ticketsTableBody.innerHTML =
                    '<tr><td colspan="6">' +
                    '<div class="empty-state">' +
                    '<div class="empty-state-icon" style="background:hsl(0,90%,95%);color:hsl(0,72%,51%);"><i class="fa-solid fa-circle-xmark"></i></div>' +
                    '<p style="font-weight:600;color:hsl(0,72%,51%);">Error loading tickets</p>' +
                    '<p style="color:hsl(220,14%,46%);font-size:0.875rem;">Please try refreshing the page.</p>' +
                    '</div></td></tr>';
            });
    }

    function loadReports() {
        var filter = statusFilter.value;
        var mappedFilter = filter === 'open' ? 'new' : filter;

        reportsTableBody.innerHTML = buildSkeletonRows(7, 3);

        AdminAPI.get('/reports?status=' + mappedFilter)
            .then(function (data) {
                reportsTableBody.innerHTML = '';

                if (!data || data.length === 0) {
                    reportsTableBody.innerHTML =
                        '<tr><td colspan="7">' +
                        '<div class="empty-state">' +
                        '<div class="empty-state-icon"><i class="fa-solid fa-flag"></i></div>' +
                        '<p style="font-weight:600;color:hsl(221,39%,11%);margin-bottom:0.25rem;">No reports found</p>' +
                        '<p style="color:hsl(220,14%,46%);font-size:0.875rem;">There are no issue reports matching this filter.</p>' +
                        '</div></td></tr>';
                    return;
                }

                var typeColors = {
                    'bug': 'hsl(25,95%,50%)',
                    'security': 'hsl(270,60%,50%)',
                    'abuse': 'hsl(0,72%,51%)',
                    'other': 'hsl(220,14%,46%)'
                };

                data.forEach(function (r, idx) {
                    var tr = document.createElement('tr');
                    tr.style.animationDelay = (idx * 0.04) + 's';
                    tr.style.cursor = 'pointer';

                    var typeColor = typeColors[r.type] || typeColors['other'];

                    tr.innerHTML =
                        '<td class="font-mono text-xs" style="color:hsl(220,14%,46%);">RPT-' + r.id + '</td>' +
                        '<td style="font-size:0.875rem;">' + r.email + '</td>' +
                        '<td style="font-weight:600;text-transform:capitalize;color:' + typeColor + ';">' + r.type + '</td>' +
                        '<td style="max-width:200px;" class="truncate" title="' + r.title + '">' + r.title + '</td>' +
                        '<td>' + getPriorityBadge(r.severity) + '</td>' +
                        '<td style="font-size:0.875rem;color:hsl(220,14%,46%);">' + r.created_at + '</td>' +
                        '<td>' + getStatusBadge(r.status) + '</td>';

                    reportsTableBody.appendChild(tr);
                });
            })
            .catch(function () {
                reportsTableBody.innerHTML =
                    '<tr><td colspan="7">' +
                    '<div class="empty-state">' +
                    '<div class="empty-state-icon" style="background:hsl(0,90%,95%);color:hsl(0,72%,51%);"><i class="fa-solid fa-circle-xmark"></i></div>' +
                    '<p style="font-weight:600;color:hsl(0,72%,51%);">Error loading reports</p>' +
                    '<p style="color:hsl(220,14%,46%);font-size:0.875rem;">Please try refreshing the page.</p>' +
                    '</div></td></tr>';
            });
    }

    // ─── STATUS UPDATE LISTENERS ───
    function attachStatusListeners() {
        document.querySelectorAll('.status-select').forEach(function (select) {
            select.addEventListener('change', function (e) {
                var id = e.target.getAttribute('data-id');
                var newStatus = e.target.value;
                var originalValue = e.target.getAttribute('data-original') || e.target.value;

                e.target.disabled = true;

                AdminAPI.post('/tickets/' + id + '/status', { status: newStatus })
                    .then(function (res) {
                        if (res && res.success) {
                            showToast('Success', 'Ticket #' + id + ' updated to ' + newStatus.replace('_', ' '), 'success');
                            loadTickets();
                        } else {
                            e.target.value = originalValue;
                            showToast('Error', 'Failed to update ticket status', 'error');
                        }
                    })
                    .catch(function () {
                        e.target.value = originalValue;
                        showToast('Error', 'Network error. Please try again.', 'error');
                    })
                    .finally(function () {
                        e.target.disabled = false;
                    });
            });
        });
    }

    // ─── STATS UPDATE ───
    function updateStats(data) {
        var open = 0, progress = 0, resolved = 0;
        if (data && data.length) {
            data.forEach(function (t) {
                if (t.status === 'open' || t.status === 'new') open++;
                else if (t.status === 'in_progress') progress++;
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
        var duration = 600;
        var start = performance.now();
        var current = parseInt(el.textContent) || 0;

        function tick(now) {
            var elapsed = now - start;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(current + (target - current) * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ─── SKELETON HELPER ───
    function buildSkeletonRows(cols, rows) {
        var html = '';
        for (var r = 0; r < rows; r++) {
            html += '<tr class="skeleton-row">';
            for (var c = 0; c < cols; c++) {
                var w = 60 + Math.floor(Math.random() * 100);
                html += '<td><div class="skeleton-block" style="width:' + w + 'px;"></div></td>';
            }
            html += '</tr>';
        }
        return html;
    }

    // ─── TAB SWITCHING ───
    tabTickets.addEventListener('click', function () {
        currentView = 'tickets';
        tabTickets.classList.add('active');
        tabReports.classList.remove('active');
        viewTickets.classList.remove('hidden');
        viewReports.classList.add('hidden');
        viewTickets.style.animation = 'none';
        viewTickets.offsetHeight;
        viewTickets.style.animation = 'fadeIn 0.3s ease-out both';
        loadTickets();
    });

    tabReports.addEventListener('click', function () {
        currentView = 'reports';
        tabReports.classList.add('active');
        tabTickets.classList.remove('active');
        viewReports.classList.remove('hidden');
        viewTickets.classList.add('hidden');
        viewReports.style.animation = 'none';
        viewReports.offsetHeight;
        viewReports.style.animation = 'fadeIn 0.3s ease-out both';
        loadReports();
    });

    // ─── FILTER ───
    statusFilter.addEventListener('change', function () {
        if (currentView === 'tickets') loadTickets();
        else loadReports();
    });

    // ─── INITIAL LOAD ───
    loadTickets();

});

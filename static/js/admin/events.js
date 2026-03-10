let currentStatus = 'upcoming';
let currentEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    setupFormHandlers();
    setDateTimeInputMin();
});

function setDateTimeInputMin() {
    const now = new Date();
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    const minDateTime = localNow.toISOString().slice(0, 16);
    const createInput = document.getElementById('event-date');
    if (createInput) createInput.min = minDateTime;
    const editInput = document.getElementById('edit-date');
    if (editInput) editInput.min = minDateTime;
}

function parseAsUTC(dateStr) {
    if (!dateStr) return new Date();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
        return new Date(Date.UTC(
            parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
            parseInt(match[4]), parseInt(match[5]), parseInt(match[6] || 0)
        ));
    }
    if (dateStr.indexOf('Z') !== -1 || /[+-]\d{2}:?\d{2}$/.test(dateStr)) return new Date(dateStr);
    return new Date(dateStr.replace(' ', 'T') + 'Z');
}

// ── Tab switching ──────────────────────────────────────────────
function switchTab(status) {
    if (currentStatus === status) return;
    currentStatus = status;

    const upcomingTab = document.getElementById('tab-upcoming');
    const pastTab = document.getElementById('tab-past');

    if (status === 'upcoming') {
        upcomingTab.classList.add('active');
        pastTab.classList.remove('active');
    } else {
        pastTab.classList.add('active');
        upcomingTab.classList.remove('active');
    }

    loadEvents();
}

// ── Load events from API ───────────────────────────────────────
async function loadEvents() {
    const container = document.getElementById('events-list');
    if (!container) return;

    // Show skeleton
    container.innerHTML = `
        <div class="ev-skeleton-item">
            <div class="sk-box sk-date"></div>
            <div class="sk-body">
                <div class="sk-box" style="height:0.875rem;width:50%;"></div>
                <div class="sk-box" style="height:0.725rem;width:35%;"></div>
                <div class="sk-box" style="height:0.725rem;width:25%;"></div>
            </div>
            <div style="display:flex;gap:0.4rem;">
                <div class="sk-box" style="height:2rem;width:5rem;border-radius:0.5rem;"></div>
                <div class="sk-box" style="height:2rem;width:4rem;border-radius:0.5rem;"></div>
            </div>
        </div>
        <div class="ev-skeleton-item">
            <div class="sk-box sk-date"></div>
            <div class="sk-body">
                <div class="sk-box" style="height:0.875rem;width:42%;"></div>
                <div class="sk-box" style="height:0.725rem;width:28%;"></div>
                <div class="sk-box" style="height:0.725rem;width:20%;"></div>
            </div>
            <div style="display:flex;gap:0.4rem;">
                <div class="sk-box" style="height:2rem;width:5rem;border-radius:0.5rem;"></div>
                <div class="sk-box" style="height:2rem;width:4rem;border-radius:0.5rem;"></div>
                <div class="sk-box" style="height:2rem;width:3.5rem;border-radius:0.5rem;"></div>
            </div>
        </div>
        <div class="ev-skeleton-item" style="border-bottom:none;">
            <div class="sk-box sk-date"></div>
            <div class="sk-body">
                <div class="sk-box" style="height:0.875rem;width:58%;"></div>
                <div class="sk-box" style="height:0.725rem;width:40%;"></div>
                <div class="sk-box" style="height:0.725rem;width:30%;"></div>
            </div>
            <div style="display:flex;gap:0.4rem;">
                <div class="sk-box" style="height:2rem;width:5rem;border-radius:0.5rem;"></div>
                <div class="sk-box" style="height:2rem;width:4rem;border-radius:0.5rem;"></div>
            </div>
        </div>`;

    try {
        const res = await fetch(`/admin/api/events/list?status=${currentStatus}`);
        if (!res.ok) throw new Error('Failed to load events');
        const events = await res.json();
        renderEvents(events);
    } catch (error) {
        console.error('Failed to load events:', error);
        container.innerHTML = `
            <div class="ev-empty">
                <div class="ev-empty-icon" style="background:hsl(0,90%,95%);color:hsl(0,65%,50%);">
                    <i class="fa-solid fa-circle-exclamation"></i>
                </div>
                <strong>Failed to load events</strong>
                <span>Please try refreshing the page.</span>
            </div>`;
    }
}

// ── Render event list ──────────────────────────────────────────
function renderEvents(events) {
    currentEvents = events;
    const container = document.getElementById('events-list');
    const isUpcoming = currentStatus === 'upcoming';
    container.innerHTML = '';

    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="ev-empty">
                <div class="ev-empty-icon">
                    <i class="fa-solid fa-calendar-${isUpcoming ? 'plus' : 'xmark'}"></i>
                </div>
                <strong>No ${isUpcoming ? 'upcoming' : 'past'} events</strong>
                <span>${isUpcoming ? 'Create a new event using the form above.' : 'No past events to display.'}</span>
            </div>`;
        return;
    }

    events.forEach((event, idx) => {
        const dateObj = parseAsUTC(event.date);
        const month = dateObj.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
        const day = dateObj.toLocaleString('en-US', { day: 'numeric', timeZone: 'UTC' });
        const time = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

        const seatsAvail = event.available_seats ?? (event.total_seats - (event.going_count || 0));
        const seatsPill = seatsAvail > 0
            ? `<span class="ev-pill ev-pill-green"><i class="fa-solid fa-chair"></i> ${seatsAvail} seats left</span>`
            : `<span class="ev-pill ev-pill-red"><i class="fa-solid fa-ban"></i> Full</span>`;

        const typePill = event.event_type
            ? `<span class="ev-pill ${event.event_type === 'official' ? 'ev-pill-indigo' : 'ev-pill-purple'}">
                ${event.event_type === 'official' ? '<i class="fa-solid fa-building"></i>' : '<i class="fa-solid fa-users"></i>'}
                ${event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
               </span>`
            : '';

        const updateBtn = isUpcoming
            ? `<button class="ev-action-btn" onclick="openEditModal(${event.id})">
                   <i class="fa-solid fa-pen-to-square"></i> Update
               </button>`
            : '';

        const item = document.createElement('div');
        item.className = 'ev-item';
        item.style.animationDelay = (idx * 0.05) + 's';
        item.innerHTML = `
            <div class="ev-date-badge">
                <span class="ev-month">${month}</span>
                <span class="ev-day">${day}</span>
            </div>
            <div class="ev-item-body">
                <div class="ev-item-title">${event.title}</div>
                <div class="ev-item-meta">
                    <span><i class="fa-regular fa-clock"></i>${time}</span>
                    <span><i class="fa-solid fa-location-dot"></i>${event.location}</span>
                    <span><i class="fa-solid fa-users"></i>${event.going_count || 0} going</span>
                    <span><i class="fa-regular fa-star"></i>${event.interested_count || 0} interested</span>
                </div>
                <div class="ev-pills">
                    ${seatsPill}
                    ${typePill}
                </div>
            </div>
            <div class="ev-item-actions">
                ${updateBtn}
                <button class="ev-action-btn" onclick="openViewModal(${event.id})">
                    <i class="fa-solid fa-eye"></i> Details
                </button>
                <button class="ev-action-btn red" onclick="downloadPdf(${event.id})">
                    <i class="fa-solid fa-file-pdf"></i> PDF
                </button>
            </div>`;
        container.appendChild(item);
    });
}

// ── Create event ───────────────────────────────────────────────
function resetForm() {
    document.getElementById('event-form').reset();
}

function setupFormHandlers() {
    // Create
    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating…';

        const dateVal = document.getElementById('event-date').value;
        const data = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            location: document.getElementById('event-location').value,
            total_seats: document.getElementById('total-seats').value,
            event_type: document.getElementById('event-type').value,
            event_date: dateVal ? new Date(dateVal).toISOString() : null,
            targetEntity: null
        };

        try {
            const res = await fetch('/admin/api/events/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                const banner = document.getElementById('success-message');
                banner.style.display = 'flex';
                document.getElementById('event-form').reset();
                loadEvents();
                setTimeout(() => { banner.style.display = 'none'; }, 4000);
            } else {
                const err = await res.json();
                showToast('Error', err.error || 'Failed to create event', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'Network error. Please try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Create Event';
        }
    });

    // Update
    document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-event-id').value;
        const dateVal = document.getElementById('edit-date').value;

        const data = {
            title: document.getElementById('edit-title').value,
            description: document.getElementById('edit-description').value,
            location: document.getElementById('edit-location').value,
            total_seats: document.getElementById('edit-seats').value,
            event_date: dateVal ? new Date(dateVal).toISOString() : null
        };

        try {
            const res = await fetch(`/admin/api/events/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                closeModal('edit-modal');
                loadEvents();
                showToast('Success', 'Event updated successfully.', 'success');
            } else {
                const err = await res.json();
                showToast('Error', err.error || 'Update failed', 'error');
            }
        } catch (err) {
            showToast('Error', 'Network error. Please try again.', 'error');
        }
    });
}

// ── Modal helpers ──────────────────────────────────────────────
function openEditModal(id) {
    const event = currentEvents.find(e => e.id === id);
    if (!event) return;

    document.getElementById('edit-event-id').value = event.id;
    document.getElementById('edit-title').value = event.title;
    document.getElementById('edit-description').value = event.description;
    document.getElementById('edit-location').value = event.location;
    document.getElementById('edit-seats').value = event.total_seats;

    const d = parseAsUTC(event.date);
    const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    document.getElementById('edit-date').value = localDate.toISOString().slice(0, 16);

    document.getElementById('edit-modal').style.display = 'flex';
}

async function openViewModal(id) {
    const event = currentEvents.find(e => e.id === id);
    if (!event) return;

    document.getElementById('view-modal-title').textContent = event.title;
    document.getElementById('view-description').textContent = event.description || '—';

    const dateObj = parseAsUTC(event.date);
    document.getElementById('view-date').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    document.getElementById('view-time').textContent = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
    document.getElementById('view-location').textContent = event.location;
    document.getElementById('view-seats-ratio').textContent = `${event.going_count || 0} / ${event.total_seats}`;

    // Reset tbody while loading
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:hsl(220,14%,55%);font-size:0.8125rem;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:0.4rem;"></i>Loading…</td></tr>`;

    document.getElementById('view-modal').style.display = 'flex';

    try {
        const resPart = await fetch(`/admin/api/events/${id}/participants`);
        const participants = await resPart.json();
        tbody.innerHTML = '';

        if (!participants || participants.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:hsl(220,14%,55%);font-size:0.8125rem;">No participants yet.</td></tr>`;
            return;
        }

        participants.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${p.name}</td>
                <td style="color:hsl(220,14%,46%);">${p.email}</td>
                <td>${p.college || '—'}</td>
                <td>${p.department || '—'}</td>`;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:hsl(0,65%,50%);font-size:0.8125rem;">Failed to load participants.</td></tr>`;
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function downloadPdf(id) {
    window.location.href = `/admin/api/events/${id}/download`;
}
let currentStatus = 'upcoming';
let currentEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    setupFormHandlers();
    setDateTimeInputMin();
});

/**
 * Sets the 'min' attribute for date-time input fields to the current time,
 * preventing users from selecting past dates and times.
 */
function setDateTimeInputMin() {
    const now = new Date();
    // Adjust for timezone to get local time in a format that the 'datetime-local' input accepts.
    // `toISOString()` returns UTC, so we subtract the timezone offset to get local time.
    const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    const minDateTime = localNow.toISOString().slice(0, 16);

    const createDateInput = document.getElementById('event-date');
    if (createDateInput) createDateInput.min = minDateTime;

    const editDateInput = document.getElementById('edit-date');
    if (editDateInput) editDateInput.min = minDateTime;
}

// Helper to ensure date is treated as UTC
function parseAsUTC(dateStr) {
    if (!dateStr) return new Date();

    // Robust parsing: Extract components and force UTC construction
    // This handles "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
    // and ignores any attached timezone offsets that might be incorrect/naive
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
        return new Date(Date.UTC(
            parseInt(match[1]),
            parseInt(match[2]) - 1,
            parseInt(match[3]),
            parseInt(match[4]),
            parseInt(match[5]),
            parseInt(match[6] || 0)
        ));
    }

    // If string has 'Z' or offset (+00:00), parse normally
    if (dateStr.indexOf('Z') !== -1 || /[+-]\d{2}:?\d{2}$/.test(dateStr) || dateStr.indexOf('GMT') !== -1 || dateStr.indexOf('UTC') !== -1) {
        return new Date(dateStr);
    }
    // Otherwise, treat as UTC by appending Z (and replacing space with T if needed)
    return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function switchTab(status) {
    if (currentStatus === status) return;
    currentStatus = status;

    // Update Tab UI
    const upcomingTab = document.getElementById('tab-upcoming');
    const pastTab = document.getElementById('tab-past');
    const activeClass = "px-4 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 focus:outline-none transition-colors duration-200";
    const inactiveClass = "px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200";

    if (status === 'upcoming') {
        upcomingTab.className = activeClass;
        pastTab.className = inactiveClass;
    } else {
        upcomingTab.className = inactiveClass;
        pastTab.className = activeClass;
    }

    loadEvents();
}

async function loadEvents() {
    const container = document.getElementById('events-container');
    const loading = document.getElementById('events-loading');
    const empty = document.getElementById('events-empty');

    if (!container) return;
    if (loading) loading.classList.remove('hidden');

    try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Failed to load events');

        const events = await res.json();
        if (loading) loading.classList.add('hidden');

        if (events.length === 0) {
            if (empty) empty.classList.remove('hidden');
            return;
        }

        container.innerHTML = events.map((event, index) => `
            <div class="event-card" style="padding-bottom:0.75rem;${index < events.length - 1 ? 'border-bottom:1px solid var(--border-soft);' : ''}">
                <div style="display:flex;gap:0.75rem;">
                    <div class="event-date-box">
                        <div class="month">${event.month}</div>
                        <div class="day">${event.day}</div>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <h4 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:0.8125rem;font-weight:700;color:var(--ink);margin-bottom:0.25rem;letter-spacing:-0.02em;">${event.title}</h4>
                        <div style="display:flex;align-items:center;font-size:0.6875rem;color:var(--muted);margin-bottom:0.125rem;gap:0.25rem;">
                            <i class="far fa-clock" style="font-size:0.625rem;"></i>
                            <span>${event.time}</span>
                        </div>
                        <div style="display:flex;align-items:center;font-size:0.6875rem;color:var(--muted);margin-bottom:0.375rem;gap:0.25rem;">
                            <i class="fas fa-map-marker-alt" style="font-size:0.625rem;"></i>
                            <span>${event.location}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:0.625rem;font-size:0.6875rem;margin-bottom:0.25rem;">
                            <span style="color:var(--muted);"><i class="fas fa-users" style="margin-right:0.25rem;font-size:0.625rem;"></i>${event.goingCount} going</span>
                            <span style="color:var(--muted);"><i class="fas fa-star" style="margin-right:0.25rem;font-size:0.625rem;"></i>${event.interestedCount} interested</span>
                        </div>
                        <div style="font-size:0.6875rem;color:${event.availableSeats > 0 ? 'var(--green)' : 'hsl(0,84%,55%)'};margin-bottom:0.5rem;font-weight:500;">
                            <i class="fas fa-chair" style="margin-right:0.25rem;font-size:0.625rem;"></i>
                            ${event.availableSeats} of ${event.totalSeats} seats available
                        </div>
                        <div style="display:flex;gap:0.375rem;">
                            <button onclick="toggleEventStatus(${event.id}, 'interested')"
                                class="event-btn event-btn-interested ${event.userStatus === 'interested' ? 'active' : ''}">
                                <i class="fas fa-heart" style="font-size:0.6875rem;"></i>
                                <span>Interested</span>
                            </button>
                            <button onclick="toggleEventStatus(${event.id}, 'going')"
                                ${event.availableSeats <= 0 && event.userStatus !== 'going' ? 'disabled' : ''}
                                class="event-btn event-btn-going ${event.userStatus === 'going' ? 'active' : ''}">
                                <i class="fas ${event.userStatus === 'going' ? 'fa-check' : event.availableSeats <= 0 ? 'fa-times' : 'fa-plus'}" style="font-size:0.6875rem;"></i>
                                <span>${event.userStatus === 'going' ? 'Going' : event.availableSeats <= 0 ? 'Full' : 'Join'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Failed to load events:', error);
        if (loading) loading.classList.add('hidden');
        if (container) {
            container.innerHTML = `<p style="color:hsl(0,84%,55%);font-size:0.8125rem;text-align:center;padding:1rem 0;">Failed to load events</p>`;
        }
    }
}

function renderEvents(events) {
    currentEvents = events;
    const container = document.getElementById('events-list');
    const isUpcoming = currentStatus === 'upcoming';
    container.innerHTML = '';

    if (events.length === 0) {
        container.innerHTML = `<div class="text-gray-500 italic">No ${isUpcoming ? 'upcoming' : 'past'} events found.</div>`;
        return;
    }

    events.forEach(event => {
        const date = parseAsUTC(event.date).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
        });

        const strip = document.createElement('div');
        strip.className = 'flex items-center justify-between bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow';

        strip.innerHTML = `
            <div class="flex-1">
                <h4 class="font-bold text-lg text-gray-800">${event.title}</h4>
                <div class="text-sm text-gray-600 flex gap-4 mt-1">
                    <span>📅 ${date}</span>
                    <span>📍 ${event.location}</span>
                </div>
                <div class="text-xs text-gray-500 mt-2 flex gap-3">
                    <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Participated: ${event.going_count}</span>
                    <span class="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Interested: ${event.interested_count}</span>
                </div>
            </div>
            <div class="flex gap-2">
                ${isUpcoming ? `
                <button onclick="openEditModal(${event.id})" class="btn btn-secondary text-sm px-3 py-1">
                    <i class="fa-solid   fa-pen-to-square"></i>
                    Update
                </button>` : ''}
                <button onclick="openViewModal(${event.id})" class="btn btn-secondary text-sm px-3 py-1">
                    <i class="fa-solid fa-eye"></i>
                    View Details
                </button>
                <button onclick="downloadPdf(${event.id})" class="btn btn-secondary text-sm px-3 py-1 text-red-600 border-red-200 hover:bg-red-50">
                    <i class="fa-solid fa-file-pdf"></i>
                    PDF
                </button>
            </div>
        `;
        container.appendChild(strip);
    });
}

function resetForm() {
    document.getElementById('event-form').reset();
}

// --- CREATE EVENT ---
function setupFormHandlers() {
    // Create Event
    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.innerHTML = 'Creating...';

        const dateVal = document.getElementById('event-date').value;
        const dateIso = dateVal ? new Date(dateVal).toISOString() : null;

        const data = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            location: document.getElementById('event-location').value,
            total_seats: document.getElementById('total-seats').value,
            event_date: dateIso, // Send UTC ISO string
            targetEntity: null // Default to admin
        };

        try {
            const res = await fetch('/admin/api/events/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                document.getElementById('success-message').style.display = 'flex';
                document.getElementById('event-form').reset();
                loadEvents(); // Refresh lists
                setTimeout(() => {
                    document.getElementById('success-message').style.display = 'none';
                }, 3000);
            } else {
                alert('Failed to create event');
            }
        } catch (err) {
            console.error(err);
            alert('Error creating event');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Create Event';
        }
    });

    // Update Event
    document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-event-id').value;
        const dateVal = document.getElementById('edit-date').value;
        const dateIso = dateVal ? new Date(dateVal).toISOString() : null;

        const data = {
            title: document.getElementById('edit-title').value,
            description: document.getElementById('edit-description').value,
            location: document.getElementById('edit-location').value,
            total_seats: document.getElementById('edit-seats').value,
            event_date: dateIso // Send UTC ISO string
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
            } else {
                const err = await res.json();
                alert(err.error || 'Update failed');
            }
        } catch (err) {
            alert('Error updating event');
        }
    });
}

// --- MODAL ACTIONS ---

// Helper to find event data locally (since we fetched them for the list)
// In a real app, we might fetch single event details, but we have most data already.
// For simplicity, we'll re-fetch or pass data. Let's fetch single event details implicitly via the list data.
// Actually, let's just fetch the specific event details or use what we have.
// Since the list API returns most info, we can use that, but for editing we need raw date.
// Let's fetch the specific event from the DOM or cache.
// Better approach: The list API returns formatted date.
// I'll just use the data from the list render scope if I cache it, or fetch fresh.
// Let's fetch fresh list and cache it.

async function openEditModal(id) {
    // Use locally cached events
    const event = currentEvents.find(e => e.id === id);

    if (!event) return;

    document.getElementById('edit-event-id').value = event.id;
    document.getElementById('edit-title').value = event.title;
    document.getElementById('edit-description').value = event.description;
    document.getElementById('edit-location').value = event.location;
    document.getElementById('edit-seats').value = event.total_seats;

    // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
    // event.date is UTC ISO (e.g., "2023-10-27T14:00:00Z")
    // We need to display it in local time for the input
    const d = parseAsUTC(event.date);
    const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    document.getElementById('edit-date').value = localDate.toISOString().slice(0, 16);

    document.getElementById('edit-modal').classList.remove('hidden');
}

async function openViewModal(id) {
    // Fetch details + participants
    // We can use the list data for basic details
    const event = currentEvents.find(e => e.id === id);

    if (!event) return;

    document.getElementById('view-modal-title').textContent = event.title;
    document.getElementById('view-description').textContent = event.description;

    const dateObj = parseAsUTC(event.date);
    document.getElementById('view-date').textContent = dateObj.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    document.getElementById('view-time').textContent = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    document.getElementById('view-location').textContent = event.location;
    document.getElementById('view-seats-ratio').textContent = `${event.going_count} / ${event.total_seats}`;

    // Fetch participants
    const resPart = await fetch(`/admin/api/events/${id}/participants`);
    const participants = await resPart.json();

    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';

    participants.forEach(p => {
        tbody.innerHTML += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-2">${p.name}</td>
                <td class="p-2 text-sm text-gray-600">${p.email}</td>
                <td class="p-2 text-sm">${p.college}</td>
                <td class="p-2 text-sm">${p.department}</td>
            </tr>`;
    });

    document.getElementById('view-modal').classList.remove('hidden');
}

function downloadPdf(id) {
    window.location.href = `/admin/api/events/${id}/download`;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}
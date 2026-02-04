document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    setupFormHandlers();
});

function loadEvents() {
    fetch('/admin/api/events/upcoming')
        .then(res => res.json())
        .then(data => renderEvents(data, 'upcoming-events-list', true));

    fetch('/admin/api/events/past')
        .then(res => res.json())
        .then(data => renderEvents(data, 'past-events-list', false));
}

function renderEvents(events, containerId, isUpcoming) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (events.length === 0) {
        container.innerHTML = `<div class="text-gray-500 italic">No ${isUpcoming ? 'upcoming' : 'past'} events found.</div>`;
        return;
    }

    events.forEach(event => {
        const date = new Date(event.date).toLocaleString('en-US', { 
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
                    Update
                </button>` : ''}
                <button onclick="openViewModal(${event.id})" class="btn btn-secondary text-sm px-3 py-1">
                    View Details
                </button>
                <button onclick="downloadPdf(${event.id})" class="btn btn-secondary text-sm px-3 py-1 text-red-600 border-red-200 hover:bg-red-50">
                    PDF
                </button>
            </div>
        `;
        container.appendChild(strip);
    });
}

// --- CREATE EVENT ---
function setupFormHandlers() {
    // Create Event
    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        btn.disabled = true;
        btn.innerHTML = 'Creating...';

        const startVal = document.getElementById('start-time').value;
        const startIso = startVal ? new Date(startVal).toISOString() : null;

        const data = {
            title: document.getElementById('event-title').value,
            description: document.getElementById('event-description').value,
            location: document.getElementById('event-location').value,
            total_seats: document.getElementById('total-seats').value,
            start_datetime: startIso, // Send UTC ISO string
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
    // Find event in DOM or fetch. Since we don't have a "get single event" API in the prompt requirements,
    // we will rely on the data we have or add a get route.
    // However, the prompt asked for "Update upcoming event" API.
    // I'll iterate through the list data which I should store.
    
    // Re-fetch list to get data (or store it globally)
    const res = await fetch('/admin/api/events/upcoming');
    const events = await res.json();
    const event = events.find(e => e.id === id);

    if (!event) return;

    document.getElementById('edit-event-id').value = event.id;
    document.getElementById('edit-title').value = event.title;
    document.getElementById('edit-description').value = event.description;
    document.getElementById('edit-location').value = event.location;
    document.getElementById('edit-seats').value = event.total_seats;
    
    // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
    // event.date is UTC ISO (e.g., "2023-10-27T14:00:00Z")
    // We need to display it in local time for the input
    const d = new Date(event.date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // Adjust for local input
    document.getElementById('edit-date').value = d.toISOString().slice(0, 16);

    document.getElementById('edit-modal').classList.remove('hidden');
}

async function openViewModal(id) {
    // Fetch details + participants
    // We can use the list data for basic details
    const resList = await fetch('/admin/api/events/upcoming'); // Check upcoming
    let events = await resList.json();
    let event = events.find(e => e.id === id);
    
    if (!event) {
        const resPast = await fetch('/admin/api/events/past'); // Check past
        events = await resPast.json();
        event = events.find(e => e.id === id);
    }

    if (!event) return;

    document.getElementById('view-modal-title').textContent = event.title;
    document.getElementById('view-date').textContent = new Date(event.date).toLocaleString();
    document.getElementById('view-location').textContent = event.location;
    document.getElementById('view-participated').textContent = event.going_count;
    document.getElementById('view-interested').textContent = event.interested_count;

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
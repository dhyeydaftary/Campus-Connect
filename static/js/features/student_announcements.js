/**
 * Student Announcements Logic
 * Handles fetching and displaying mini announcements on the student dashboard.
 */

let studentAnnouncements = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchStudentAnnouncements();
});

async function fetchStudentAnnouncements() {
    const container = document.getElementById('mini-announcements-list');
    if (!container) return;

    try {
        // Fetch only the latest 5 announcements
        const response = await fetch('/api/announcements?limit=5');
        if (!response.ok) throw new Error('Failed to fetch');
        
        studentAnnouncements = await response.json();
        renderStudentAnnouncements(studentAnnouncements);
    } catch (error) {
        console.error('Error loading announcements:', error);
        container.innerHTML = `
            <div class="text-center py-4">
                <p class="text-sm text-gray-500">Unable to load announcements.</p>
            </div>
        `;
    }
}

function renderStudentAnnouncements(announcements) {
    const container = document.getElementById('mini-announcements-list');
    
    if (!announcements || announcements.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <p class="text-sm text-gray-500">No announcements yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = announcements.map(ann => `
        <div onclick="openAnnouncementModal(${ann.id})" 
            class="group cursor-pointer p-3 rounded-lg hover:bg-indigo-50 transition-all duration-200 border-l-2 border-transparent hover:border-indigo-500">
            <h4 class="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 truncate mb-1">
                ${escapeHtml(ann.title)}
            </h4>
            <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500">${ann.date}</span>
                <span class="text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Read more
                </span>
            </div>
        </div>
    `).join('');
}

function displayAnnouncement(ann) {
    document.getElementById('modal-ann-title').textContent = ann.title;
    document.getElementById('modal-ann-content').textContent = ann.content;
    document.getElementById('modal-ann-date').textContent = ann.date;
    document.getElementById('modal-ann-author').textContent = ann.author;
    
    const updatedEl = document.getElementById('modal-ann-updated');
    if (ann.updated_at && ann.updated_at !== ann.date) {
        updatedEl.textContent = `Last updated: ${ann.updated_at}`;
        updatedEl.classList.remove('hidden');
    } else {
        updatedEl.classList.add('hidden');
    }

    const modal = document.getElementById('student-announcement-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function openAnnouncementModal(id) {
    const ann = studentAnnouncements.find(a => a.id === id);
    if (ann) displayAnnouncement(ann);
}

function closeAnnouncementModal() {
    const modal = document.getElementById('student-announcement-modal');
    modal.classList.add('hidden');
    
    // Only restore scrolling if the "All Announcements" modal is NOT open
    const allModal = document.getElementById('all-announcements-modal');
    if (!allModal || allModal.classList.contains('hidden')) {
        document.body.style.overflow = ''; 
    }
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function openAllAnnouncements() {
    const modal = document.getElementById('all-announcements-modal');
    const listContainer = document.getElementById('all-announcements-list');
    
    if (!modal || !listContainer) return;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Show loading state
    listContainer.innerHTML = '<div class="flex justify-center py-8"><div class="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>';

    try {
        // Fetch all announcements (no limit)
        const response = await fetch('/api/announcements');
        if (!response.ok) throw new Error('Failed to fetch');
        
        const allData = await response.json();
        
        // Update global array so the detail modal works for these items too
        studentAnnouncements = allData;
        
        if (allData.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-gray-500 py-4">No announcements found.</p>';
            return;
        }

        listContainer.innerHTML = allData.map(ann => `
            <div onclick="openAnnouncementModal(${ann.id})" 
                class="group cursor-pointer p-4 rounded-lg border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all duration-200">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
                        ${escapeHtml(ann.title)}
                    </h4>
                    <span class="text-xs text-gray-500 whitespace-nowrap ml-2">${ann.date}</span>
                </div>
                <p class="text-xs text-gray-600 line-clamp-2">${escapeHtml(ann.content)}</p>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading all announcements:', error);
        listContainer.innerHTML = '<p class="text-center text-red-500 py-4">Unable to load announcements.</p>';
    }
}

function closeAllAnnouncements() {
    const modal = document.getElementById('all-announcements-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

window.openAnnouncementModal = openAnnouncementModal;
window.closeAnnouncementModal = closeAnnouncementModal;
window.openAllAnnouncements = openAllAnnouncements;
window.closeAllAnnouncements = closeAllAnnouncements;
window.displayAnnouncement = displayAnnouncement;
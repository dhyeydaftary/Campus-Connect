// Load announcements
async function loadAnnouncements() {
    const announcements = await API.getAnnouncements();
    renderAnnouncements(announcements);
}
// Render announcements list
function renderAnnouncements(announcements) {
    const container = document.getElementById('announcements-list');

    if (announcements.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                No announcements yet. Create your first one above!
            </div>
        `;
        return;
    }
    container.innerHTML = announcements.map(ann => `
        <div class="announcement-item">
            <div class="announcement-date">
                <strong>${ann.author}</strong> • ${ann.date}
            </div>
            <div class="announcement-text">${ann.text}</div>
        </div>
    `).join('');
}
// Character counter
function updateCharCount() {
    const text = document.getElementById('announcement-text').value;
    document.getElementById('char-count').textContent = text.length;
}
// Handle form submit
async function handleSubmit(e) {
    e.preventDefault();
    const text = document.getElementById('announcement-text').value.trim();
    if (!text) return;
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<div class="spinner" style="width: 18px; height: 18px; border-width: 2px;"></div> Publishing...';
    const result = await API.createAnnouncement(text);
    publishBtn.disabled = false;
    publishBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 11 18-5v12L3 14v-3z"/>
        </svg>
        Publish Announcement
    `;
    if (result.success) {
        document.getElementById('announcement-text').value = '';
        updateCharCount();
        loadAnnouncements();
    }
}
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAnnouncements();

    document.getElementById('announcement-text').addEventListener('input', updateCharCount);
    document.getElementById('announcement-form').addEventListener('submit', handleSubmit);
});
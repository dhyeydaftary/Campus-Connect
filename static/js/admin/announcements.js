let currentAnnouncements = [];
let currentStatus = 'active';

// ─── TAB SWITCHING ───────────────────────────────────────────────
window.switchTab = function (status) {
    if (currentStatus === status) return;
    currentStatus = status;

    const activeTab = document.getElementById('tab-active');
    const deletedTab = document.getElementById('tab-deleted');

    if (status === 'active') {
        activeTab.className = 'an-tab active';
        deletedTab.className = 'an-tab';
    } else {
        activeTab.className = 'an-tab';
        deletedTab.className = 'an-tab active-past';
    }
    loadAnnouncements();
};

// ─── LOAD ─────────────────────────────────────────────────────────
async function loadAnnouncements() {
    const container = document.getElementById('announcements-list');
    if (container) {
        container.style.opacity = '0.5';
        container.style.transition = 'opacity 0.15s ease-in-out';
    }
    try {
        const response = await fetch(`/admin/api/announcements?status=${currentStatus}&_=${Date.now()}`);
        const announcements = await response.json();
        setTimeout(() => {
            renderAnnouncements(announcements);
            if (container) container.style.opacity = '1';
        }, 150);
    } catch (error) {
        console.error('Error loading announcements:', error);
        if (container) { container.style.opacity = '1'; container.innerHTML = '<div class="an-empty"><div class="an-empty-icon" style="background:hsl(0,90%,95%);color:hsl(0,65%,48%);"><i class="fa-solid fa-circle-exclamation"></i></div><strong>Failed to load</strong><span>Please try refreshing the page.</span></div>'; }
    }
}

// ─── RENDER ───────────────────────────────────────────────────────
function renderAnnouncements(announcements) {
    currentAnnouncements = announcements;
    const container = document.getElementById('announcements-list');

    if (announcements.length === 0) {
        container.innerHTML = `
            <div class="an-empty">
                <div class="an-empty-icon">
                    <i class="fa-solid fa-bullhorn"></i>
                </div>
                <strong>${currentStatus === 'active' ? 'No active announcements' : 'No past announcements'}</strong>
                <span>${currentStatus === 'active' ? 'Create one using the form above.' : 'Archived announcements will appear here.'}</span>
            </div>`;
        return;
    }

    const getActions = (ann) => {
        if (currentStatus === 'active') {
            return `
                <button onclick="editAnnouncement(${ann.id})" class="an-btn-icon an-btn-edit" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteAnnouncement(${ann.id})" class="an-btn-icon an-btn-archive" title="Archive">
                    <i class="fas fa-archive"></i>
                </button>`;
        } else {
            return `
                <button onclick="restoreAnnouncement(${ann.id})" class="an-btn-icon an-btn-restore" title="Restore">
                    <i class="fas fa-trash-restore"></i>
                </button>`;
        }
    };

    container.innerHTML = announcements.map((ann, idx) => `
        <div class="an-item ${currentStatus === 'deleted' ? 'past' : ''}" style="animation-delay:${idx * 0.05}s;">
            <div class="an-item-accent ${currentStatus === 'deleted' ? 'past' : 'active'}"></div>
            <div class="an-item-body">
                <p class="an-item-title">${ann.title || 'No Title'}</p>
                <p class="an-item-meta"><strong>${ann.author}</strong> &bull; ${ann.date}</p>
                <p class="an-item-content">${ann.content}</p>
            </div>
            <div class="an-item-actions">${getActions(ann)}</div>
        </div>
    `).join('');
}

// ─── CHAR COUNT ───────────────────────────────────────────────────
function updateCharCount() {
    const text = document.getElementById('announcement-text').value;
    document.getElementById('char-count').textContent = text.length;
}

// ─── CREATE ───────────────────────────────────────────────────────
async function handleSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('announcement-title').value.trim();
    const content = document.getElementById('announcement-text').value.trim();
    if (!title || !content) return;

    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing…';

    try {
        const response = await fetch('/admin/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        const result = await response.json();
        if (response.ok) {
            document.getElementById('announcement-title').value = '';
            document.getElementById('announcement-text').value = '';
            updateCharCount();
            showToast('Published', 'Announcement posted successfully.', 'success');
            loadAnnouncements();
        } else {
            showToast('Error', result.error || 'Failed to create announcement', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error', 'An error occurred. Please try again.', 'error');
    }

    publishBtn.disabled = false;
    publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Announcement';
}

// ─── EDIT MODAL ───────────────────────────────────────────────────
window.editAnnouncement = function (id) {
    const ann = currentAnnouncements.find(a => a.id === id);
    if (!ann) return;
    document.getElementById('edit-id').value = ann.id;
    document.getElementById('edit-title').value = ann.title;
    document.getElementById('edit-content').value = ann.content;
    document.getElementById('edit-modal').style.display = 'flex';
};

window.closeEditModal = function () {
    document.getElementById('edit-modal').style.display = 'none';
};

document.getElementById('edit-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value;
    const content = document.getElementById('edit-content').value;
    try {
        const response = await fetch(`/admin/api/announcements/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (response.ok) {
            closeEditModal();
            showToast('Updated', 'Announcement updated successfully.', 'success');
            loadAnnouncements();
        } else {
            showToast('Error', 'Failed to update announcement', 'error');
        }
    } catch (error) { showToast('Error', 'Error updating announcement', 'error'); }
});

// ─── ARCHIVE (delete) ─────────────────────────────────────────────
let announcementToDeleteId = null;

function injectDeleteModal() {
    if (document.getElementById('delete-modal')) return;
    const html = `
    <div id="delete-modal" class="an-modal-backdrop" style="display:none;">
        <div class="an-confirm-modal">
            <div style="padding:2rem;text-align:center;">
                <div class="an-confirm-icon-wrap" style="background:hsl(45,93%,90%);color:hsl(32,80%,35%);">
                    <i class="fas fa-archive"></i>
                </div>
                <h3 style="font-size:1rem;font-weight:700;color:hsl(221,39%,11%);margin-bottom:0.5rem;">Archive Announcement</h3>
                <p style="font-size:0.875rem;color:hsl(220,14%,50%);">This will move the announcement to Past Announcements. It can be restored later.</p>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.625rem;padding:1rem 1.5rem;border-top:1px solid hsl(220,18%,92%);background:hsl(220,20%,98%);">
                <button onclick="closeDeleteModal()" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;font-size:0.875rem;font-weight:600;border-radius:0.5rem;border:1.5px solid hsl(220,18%,86%);background:white;color:hsl(220,14%,35%);cursor:pointer;">Cancel</button>
                <button id="confirm-delete-btn" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;font-size:0.875rem;font-weight:600;border-radius:0.5rem;border:none;background:hsl(38,80%,45%);color:white;cursor:pointer;"><i class="fas fa-archive"></i> Archive</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        if (announcementToDeleteId) await performDelete(announcementToDeleteId);
    });
}

window.deleteAnnouncement = function (id) {
    announcementToDeleteId = id;
    document.getElementById('delete-modal').style.display = 'flex';
};

window.closeDeleteModal = function () {
    document.getElementById('delete-modal').style.display = 'none';
    announcementToDeleteId = null;
};

async function performDelete(id) {
    const btn = document.getElementById('confirm-delete-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Archiving…';
    try {
        const response = await fetch(`/admin/api/announcements/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('Archived', 'Announcement moved to Past.', 'success');
            loadAnnouncements(); closeDeleteModal();
        } else { showToast('Error', 'Failed to archive announcement', 'error'); }
    } catch (error) { showToast('Error', 'Error archiving announcement', 'error'); }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-archive"></i> Archive';
}

// ─── RESTORE ─────────────────────────────────────────────────────
let announcementToRestoreId = null;

function injectRestoreModal() {
    if (document.getElementById('restore-modal')) return;
    const html = `
    <div id="restore-modal" class="an-modal-backdrop" style="display:none;">
        <div class="an-confirm-modal">
            <div style="padding:2rem;text-align:center;">
                <div class="an-confirm-icon-wrap" style="background:hsl(142,60%,91%);color:hsl(142,60%,28%);">
                    <i class="fas fa-trash-restore"></i>
                </div>
                <h3 style="font-size:1rem;font-weight:700;color:hsl(221,39%,11%);margin-bottom:0.5rem;">Restore Announcement</h3>
                <p style="font-size:0.875rem;color:hsl(220,14%,50%);">This will make the announcement visible to students again.</p>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:0.625rem;padding:1rem 1.5rem;border-top:1px solid hsl(220,18%,92%);background:hsl(220,20%,98%);">
                <button onclick="closeRestoreModal()" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;font-size:0.875rem;font-weight:600;border-radius:0.5rem;border:1.5px solid hsl(220,18%,86%);background:white;color:hsl(220,14%,35%);cursor:pointer;">Cancel</button>
                <button id="confirm-restore-btn" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;font-size:0.875rem;font-weight:600;border-radius:0.5rem;border:none;background:hsl(142,60%,40%);color:white;cursor:pointer;"><i class="fas fa-trash-restore"></i> Restore</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('confirm-restore-btn').addEventListener('click', async () => {
        if (announcementToRestoreId) await performRestore(announcementToRestoreId);
    });
}

window.restoreAnnouncement = function (id) {
    announcementToRestoreId = id;
    document.getElementById('restore-modal').style.display = 'flex';
};

window.closeRestoreModal = function () {
    document.getElementById('restore-modal').style.display = 'none';
    announcementToRestoreId = null;
};

async function performRestore(id) {
    const btn = document.getElementById('confirm-restore-btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restoring…';
    try {
        const response = await fetch(`/admin/api/announcements/${id}/restore`, { method: 'POST' });
        if (response.ok) {
            showToast('Restored', 'Announcement is now active again.', 'success');
            loadAnnouncements(); closeRestoreModal();
        } else { showToast('Error', 'Failed to restore announcement', 'error'); }
    } catch (error) { showToast('Error', 'Error restoring announcement', 'error'); }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash-restore"></i> Restore';
}

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadAnnouncements();
    injectDeleteModal();
    injectRestoreModal();
    document.getElementById('announcement-text').addEventListener('input', updateCharCount);
    document.getElementById('announcement-form').addEventListener('submit', handleSubmit);
});
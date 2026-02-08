// Load announcements
let currentAnnouncements = [];
let currentStatus = 'active'; // 'active' or 'deleted'

// Inject Tabs for Recycle Bin
function injectTabs() {
    const listContainer = document.getElementById('announcements-list');
    if (!listContainer || document.getElementById('announcement-tabs')) return;

    const tabsHtml = `
        <div id="announcement-tabs" class="flex border-b border-gray-200 mb-4 transition-all duration-300">
            <button id="tab-active" class="px-4 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 focus:outline-none transition-colors duration-200">
                Active Announcements
            </button>
            <button id="tab-deleted" class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200">
                Recycle Bin <i class="fas fa-trash-alt ml-1"></i>
            </button>
        </div>
    `;
    listContainer.insertAdjacentHTML('beforebegin', tabsHtml);

    // Add event listeners
    document.getElementById('tab-active').addEventListener('click', () => switchTab('active'));
    document.getElementById('tab-deleted').addEventListener('click', () => switchTab('deleted'));
}

window.switchTab = function(status) {
    if (currentStatus === status) return; // Prevent reload if same tab
    currentStatus = status;
    
    // Update Tab UI
    const activeTab = document.getElementById('tab-active');
    const deletedTab = document.getElementById('tab-deleted');
    
    if (status === 'active') {
        activeTab.className = "px-4 py-2 text-sm font-medium text-indigo-600 border-b-2 border-indigo-600 focus:outline-none transition-colors duration-200";
        deletedTab.className = "px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200";
    } else {
        activeTab.className = "px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200";
        deletedTab.className = "px-4 py-2 text-sm font-medium text-red-600 border-b-2 border-red-600 focus:outline-none transition-colors duration-200";
    }
    
    loadAnnouncements();
}

async function loadAnnouncements() {
    const container = document.getElementById('announcements-list');
    
    // Smooth transition: Fade out
    if (container) {
        container.style.transition = 'opacity 0.15s ease-in-out';
        container.style.opacity = '0.5';
    }

    try {
        // Add timestamp to prevent caching
        const response = await fetch(`/admin/api/announcements?status=${currentStatus}&_=${Date.now()}`);
        const announcements = await response.json();
        
        // Small delay to allow fade-out effect to be visible
        setTimeout(() => {
        renderAnnouncements(announcements);
            if (container) {
                container.style.opacity = '1';
            }
        }, 150);

    } catch (error) {
        console.error('Error loading announcements:', error);
        if (container) container.style.opacity = '1';
    }
}
// Render announcements list
function renderAnnouncements(announcements) {
    currentAnnouncements = announcements;
    const container = document.getElementById('announcements-list');

    if (announcements.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                ${currentStatus === 'active' ? 'No active announcements.' : 'Recycle bin is empty.'}
            </div>
        `;
        return;
    }

    // Different actions based on status
    const getActions = (ann) => {
        if (currentStatus === 'active') {
            return `
                <button onclick="editAnnouncement(${ann.id})" class="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteAnnouncement(${ann.id})" class="text-red-600 hover:text-red-800 p-1" title="Move to Recycle Bin">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else {
            return `
                <button onclick="restoreAnnouncement(${ann.id})" class="text-green-600 hover:text-green-800 p-1 flex items-center gap-1" title="Restore">
                    <i class="fas fa-trash-restore"></i> Restore
                </button>
            `;
        }
    };

    // Styling: Blue line for active, Red line for deleted
    const activeClass = "bg-white border-l-4 border-indigo-500 shadow-sm rounded-r-md p-4 mb-3";
    const deletedClass = "bg-red-50 border-l-4 border-red-500 shadow-sm rounded-r-md p-4 mb-3";

    container.innerHTML = announcements.map(ann => `
        <div class="announcement-item ${currentStatus === 'deleted' ? deletedClass : activeClass}">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${ann.title || 'No Title'}</h3>
                    <div class="announcement-date text-sm text-gray-500">
                        <strong>${ann.author}</strong> • ${ann.date}
                    </div>
                </div>
                <div class="flex gap-2">
                    ${getActions(ann)}
                </div>
            </div>
            <div class="announcement-text text-gray-700 whitespace-pre-wrap">${ann.content}</div>
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
    const title = document.getElementById('announcement-title').value.trim();
    const content = document.getElementById('announcement-text').value.trim();
    
    if (!title || !content) return;
    
    const publishBtn = document.getElementById('publish-btn');
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<div class="spinner" style="width: 18px; height: 18px; border-width: 2px;"></div> Publishing...';
    
    // API call now sends title and content
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
            loadAnnouncements();
        } else {
            alert(result.error || 'Failed to create announcement');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred');
    }
    
    publishBtn.disabled = false;
    publishBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 11 18-5v12L3 14v-3z"/>
        </svg>
        Publish Announcement
    `;
}

// Edit/Delete Logic
window.editAnnouncement = function(id) {
    const ann = currentAnnouncements.find(a => a.id === id);
    if (!ann) return;
    
    document.getElementById('edit-id').value = ann.id;
    document.getElementById('edit-title').value = ann.title;
    document.getElementById('edit-content').value = ann.content; // Use content, not text alias
    
    document.getElementById('edit-modal').style.display = 'flex';
}

window.closeEditModal = function() {
    document.getElementById('edit-modal').style.display = 'none';
}

document.getElementById('edit-form').addEventListener('submit', async function(e) {
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
            loadAnnouncements();
        } else {
            alert('Failed to update announcement');
        }
    } catch (error) {
        console.error(error);
        alert('Error updating announcement');
    }
});

// Delete Modal Logic
let announcementToDeleteId = null;

function injectDeleteModal() {
    if (document.getElementById('delete-modal')) return;
    
    const modalHtml = `
    <div id="delete-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50" style="display: none;">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden transform transition-all">
            <div class="p-6">
                <div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                    <i class="fas fa-triangle-exclamation text-red-600 text-2xl"></i>
                </div>
                <h3 class="text-lg font-medium text-center text-gray-900 mb-2">Move to Recycle Bin</h3>
                <p class="text-sm text-center text-gray-500">Are you sure you want to remove this announcement? You can restore it later from the Recycle Bin.</p>
            </div>
            <div class="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-2">
                <button onclick="closeDeleteModal()" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Cancel
                </button>
                <button id="confirm-delete-btn" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                    Move to Bin
                </button>
                
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
        if (announcementToDeleteId) {
            await performDelete(announcementToDeleteId);
        }
    });
}

window.deleteAnnouncement = function(id) {
    announcementToDeleteId = id;
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

window.closeDeleteModal = function() {
    const modal = document.getElementById('delete-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    announcementToDeleteId = null;
}

async function performDelete(id) {
    const btn = document.getElementById('confirm-delete-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Deleting...';
    
    try {
        const response = await fetch(`/admin/api/announcements/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadAnnouncements();
            closeDeleteModal();
        } else {
            alert('Failed to delete announcement');
        }
    } catch (error) {
        console.error(error);
        alert('Error deleting announcement');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Restore Modal Logic
let announcementToRestoreId = null;

function injectRestoreModal() {
    if (document.getElementById('restore-modal')) return;
    
    const modalHtml = `
    <div id="restore-modal" class="fixed inset-0 bg-gray-900 bg-opacity-50 hidden items-center justify-center z-50" style="display: none;">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden transform transition-all">
            <div class="p-6">
                <div class="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
                    <i class="fas fa-trash-restore text-green-600 text-2xl"></i>
                </div>
                <h3 class="text-lg font-medium text-center text-gray-900 mb-2">Restore Announcement</h3>
                <p class="text-sm text-center text-gray-500">Are you sure you want to restore this announcement? It will become visible to students again.</p>
            </div>
            <div class="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-2">
                <button onclick="closeRestoreModal()" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Cancel
                </button>
                <button id="confirm-restore-btn" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                    Restore
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('confirm-restore-btn').addEventListener('click', async () => {
        if (announcementToRestoreId) {
            await performRestore(announcementToRestoreId);
        }
    });
}

window.restoreAnnouncement = function(id) {
    announcementToRestoreId = id;
    const modal = document.getElementById('restore-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

window.closeRestoreModal = function() {
    const modal = document.getElementById('restore-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    announcementToRestoreId = null;
}

async function performRestore(id) {
    const btn = document.getElementById('confirm-restore-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Restoring...';
    
    try {
        const response = await fetch(`/admin/api/announcements/${id}/restore`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadAnnouncements();
            closeRestoreModal();
        } else {
            alert('Failed to restore announcement');
        }
    } catch (error) {
        console.error(error);
        alert('Error restoring announcement');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    injectTabs();
    loadAnnouncements();
    injectDeleteModal();
    injectRestoreModal();

    document.getElementById('announcement-text').addEventListener('input', updateCharCount);
    document.getElementById('announcement-form').addEventListener('submit', handleSubmit);
});
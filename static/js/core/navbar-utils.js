/**
 * ═══════════════════════════════════════════════════════════════
 * NAVBAR UTILS - Shared Navbar Functionality
 * Campus Connect - Reusable Component
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// PROFILE DROPDOWN
// ═══════════════════════════════════════════════════════════════

function toggleProfileDropdown() {
    const menu = document.getElementById('dropdown-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function toggleMobileSearch() {
    const searchBar = document.getElementById('mobile-search-bar');
    if (searchBar) {
        searchBar.classList.toggle('hidden');
        if (!searchBar.classList.contains('hidden')) {
            const input = document.getElementById('mobile-search-input');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('profile-dropdown');
    const menu = document.getElementById('dropdown-menu');

    if (dropdown && menu && !dropdown.contains(event.target)) {
        menu.classList.add('hidden');
    }
});

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

function toggleNotifications() {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');

    // Always load notifications when opening to ensure freshness
    if (isHidden) {
        loadNotifications();
    }
}

async function loadNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    try {
        const res = await fetch('/api/notifications');
        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();

        if (data.notifications && data.notifications.length > 0) {
            renderNotifications(data.notifications);
            renderNotificationBadge(data.unread_count || 0);
        } else {
            list.innerHTML = `
                <div class="p-4 text-center text-gray-500 text-sm">
                    <i class="fas fa-bell-slash text-3xl mb-2"></i>
                    <p>No notifications</p>
                </div>
            `;
        }
    } catch (err) {
        console.error('Failed to load notifications:', err);
        list.innerHTML = `
            <div class="p-4 text-center text-gray-500 text-sm">
                Failed to load notifications
            </div>
        `;
    }
}

function renderNotifications(notifications) {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    list.innerHTML = notifications.map(notif => `
        <div class="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${notif.is_read ? '' : 'bg-indigo-50'}" 
            onclick="markNotificationRead(${notif.id})">
            <div class="flex items-start gap-3">
                <img src="${notif.actor?.profile_picture || 'https://ui-avatars.com/api/?name=User'}" 
                    class="w-10 h-10 rounded-full flex-shrink-0">
                <div class="flex-1">
                    <p class="text-sm text-gray-900">${notif.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${timeAgoShort(notif.created_at)}</p>
                </div>
                ${notif.is_read ? '' : '<span class="w-2 h-2 bg-indigo-600 rounded-full"></span>'}
            </div>
        </div>
    `).join('');
}

function renderNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
    }
}

async function updateNotificationBadge() {
    try {
        const response = await fetch('/api/notifications/unread-count');
        if (response.ok) {
            const data = await response.json();
            renderNotificationBadge(data.count);
        }
    } catch (error) {
        console.error('Error updating badge:', error);
    }
}

async function updateMessageBadge() {
    try {
        const response = await fetch('/api/chats/unread-count');
        if (response.ok) {
            const data = await response.json();
            const badge = document.getElementById('message-badge');
            if (badge) {
                const count = data.total_unread;
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.classList.remove('hidden');
                    badge.classList.add('flex');
                } else {
                    badge.classList.add('hidden');
                    badge.classList.remove('flex');
                }
            }
        }
    } catch (error) {
        console.error('Error updating message badge:', error);
    }
}

async function markNotificationRead(id) {
    try {
        await fetch(`/api/notifications/mark-read/${id}`, { method: 'POST' });
        loadNotifications(); // Reload to update UI
    } catch (err) {
        console.error('Failed to mark as read:', err);
    }
}

async function markAllAsRead() {
    try {
        await fetch('/api/notifications/mark-all-read', { method: 'POST' });
        loadNotifications(); // Reload to update UI
    } catch (err) {
        console.error('Failed to mark all as read:', err);
    }
}

async function clearAllNotifications() {
    try {
        const res = await fetch('/api/notifications/clear', { method: 'POST' });
        if (res.ok) {
            // Update UI immediately without refresh
            const list = document.getElementById('notifications-list');
            if (list) {
                list.innerHTML = `
                    <div class="p-4 text-center text-gray-500 text-sm">
                        <i class="fas fa-bell-slash text-3xl mb-2"></i>
                        <p>No notifications</p>
                    </div>
                `;
            }
            renderNotificationBadge(0);
        }
    } catch (err) {
        console.error('Failed to clear notifications:', err);
    }
}

function timeAgoShort(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
}

// Close notifications when clicking outside
document.addEventListener('click', function (event) {
    const bell = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');

    if (bell && dropdown && !bell.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

// ═══════════════════════════════════════════════════════════════
// SEARCH FUNCTIONALITY
// ═══════════════════════════════════════════════════════════════

let lastSearchResults = { users: [], announcements: [] };

function initSearch() {
    // Find all search inputs (desktop and mobile)
    const searchInputs = document.querySelectorAll('.global-search-input');

    if (searchInputs.length === 0) return;

    let debounceTimer;

    searchInputs.forEach(searchInput => {
        // Prevent duplicate initialization
        if (searchInput.dataset.searchInitialized) return;
        searchInput.dataset.searchInitialized = 'true';

        // Create results container for this specific input
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'absolute top-full left-0 w-full bg-white rounded-xl shadow-xl border border-gray-100 mt-2 hidden z-[100] overflow-hidden';

        // Append to parent
        if (searchInput.parentElement) {
            searchInput.parentElement.style.position = 'relative';
            searchInput.parentElement.appendChild(resultsContainer);
        }

        // Prevent form submission on Enter
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    performSearch(query, resultsContainer);
                }
            }
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            clearTimeout(debounceTimer);

            if (query.length < 2) {
                resultsContainer.classList.add('hidden');
                resultsContainer.innerHTML = '';
                return;
            }

            debounceTimer = setTimeout(() => performSearch(query, resultsContainer), 300);
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.classList.add('hidden');
            }
        });

        // Re-open if input has value and is focused
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2 && resultsContainer.children.length > 0) {
                resultsContainer.classList.remove('hidden');
            }
        });
    });
}

async function performSearch(query, container) {
    try {
        // Show loading state
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="p-4 text-center text-gray-500 text-sm">
                <i class="fas fa-spinner fa-spin mr-2"></i> Searching...
            </div>
        `;

        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        lastSearchResults = data; // Store results for click handlers
        renderSearchResults(data, container);

    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `
            <div class="p-4 text-center text-red-500 text-sm">
                Error performing search
            </div>
        `;
    }
}

function renderSearchResults(data, container) {
    const hasUsers = data.users && data.users.length > 0;
    const hasAnnouncements = data.announcements && data.announcements.length > 0;

    if (!hasUsers && !hasAnnouncements) {
        container.innerHTML = `
            <div class="p-4 text-center text-gray-500 text-sm">
                No results found
            </div>
        `;
        return;
    }

    let html = '';

    if (hasUsers) {
        html += `<div class="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">People</div>`;
        html += data.users.map(user => `
            <a href="/profile/${user.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <img src="${user.profile_picture}" class="w-8 h-8 rounded-full object-cover" alt="${user.name}">
                <div>
                    <div class="text-sm font-medium text-gray-900">${escapeHtml(user.name)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(user.major)}</div>
                </div>
            </a>
        `).join('');
    }

    if (hasAnnouncements) {
        html += `<div class="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-gray-100">Announcements</div>`;
        html += data.announcements.map(ann => `
            <div onclick="openSearchAnnouncement(${ann.id})" class="cursor-pointer px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <div class="text-sm font-medium text-gray-900 truncate">${escapeHtml(ann.title)}</div>
                <div class="text-xs text-gray-500">${ann.date}</div>
            </div>
        `).join('');
    }

    container.innerHTML = html;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Global handler for search result clicks
window.openSearchAnnouncement = function (id) {
    const ann = lastSearchResults.announcements.find(a => a.id === id);
    if (ann && window.displayAnnouncement) {
        window.displayAnnouncement(ann);
    } else {
        console.warn('Announcement modal logic not available or announcement not found');
    }
};

// Load notification badge on page load (all pages)
document.addEventListener('DOMContentLoaded', async function () {
    const nonPollingPages = ['/login', '/set-password', '/reset-password'];
    const shouldPoll = !nonPollingPages.some(page => window.location.pathname.startsWith(page));

    // Initial load
    if (shouldPoll) {
        updateNotificationBadge();
        updateMessageBadge();

        // Poll every 30 seconds only on active pages
        setInterval(() => {
            updateNotificationBadge();
            updateMessageBadge();
        }, 30000);
    }

    // Initialize Search on all pages
    initSearch();
});

// ═══════════════════════════════════════════════════════════════
// EXPORT FOR USE IN OTHER MODULES
// ═══════════════════════════════════════════════════════════════

window.NavbarUtils = {
    toggleProfileDropdown,
    toggleMobileSearch,
    toggleNotifications,
    loadNotifications,
    markNotificationRead,
    markAllAsRead,
    clearAllNotifications,
    updateMessageBadge
};
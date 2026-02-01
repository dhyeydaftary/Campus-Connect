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

let notificationsLoaded = false;

function toggleNotifications() {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');

    // Load notifications on first open
    if (isHidden && !notificationsLoaded) {
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
        notificationsLoaded = true;

        if (data.notifications && data.notifications.length > 0) {
            renderNotifications(data.notifications);
            updateNotificationBadge(data.unread_count || 0);
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
                <img src="${notif.actor_image || 'https://ui-avatars.com/api/?name=User'}" 
                    class="w-10 h-10 rounded-full">
                <div class="flex-1">
                    <p class="text-sm text-gray-900">${notif.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${timeAgoShort(notif.created_at)}</p>
                </div>
                ${notif.is_read ? '' : '<span class="w-2 h-2 bg-indigo-600 rounded-full"></span>'}
            </div>
        </div>
    `).join('');
}

function updateNotificationBadge(count) {
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

async function markNotificationRead(id) {
    try {
        await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
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

// Load notification badge on page load (all pages)
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
            const data = await res.json();
            updateNotificationBadge(data.unread_count || 0);
        }
    } catch (err) {
        console.error('Badge count load failed:', err);
    }
});

// ═══════════════════════════════════════════════════════════════
// EXPORT FOR USE IN OTHER MODULES
// ═══════════════════════════════════════════════════════════════

window.NavbarUtils = {
    toggleProfileDropdown,
    toggleNotifications,
    loadNotifications,
    markNotificationRead,
    markAllAsRead
};
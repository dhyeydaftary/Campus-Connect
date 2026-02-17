/**
 * Campus Connect - Admin Panel Interactions
 * Handles Sidebar Toggle, Mobile Responsiveness, and UI Utilities
 */

document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
    initTableActions();
});

// ═══════════════════════════════════════════════════════════════
// SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════════

function initSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    
    // Create overlay if it doesn't exist
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'hidden';
        document.body.appendChild(overlay);
    }

    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('sidebar-open');
        // If using Tailwind classes for transform
        sidebar.classList.remove('-translate-x-full'); 
        
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Lock scroll
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('sidebar-open');
        // If using Tailwind classes for transform
        sidebar.classList.add('-translate-x-full');
        
        overlay.classList.add('hidden');
        document.body.style.overflow = ''; // Unlock scroll
    }

    function toggleSidebar() {
        if (!sidebar) return;
        const isOpen = sidebar.classList.contains('sidebar-open') || !sidebar.classList.contains('-translate-x-full');
        if (isOpen) closeSidebar();
        else openSidebar();
    }

    // Event Listeners
    if (toggleBtn) toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
    });
    
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            // Reset state for desktop
            if (overlay) overlay.classList.add('hidden');
            document.body.style.overflow = '';
            // Ensure sidebar is visible on desktop
            if (sidebar) sidebar.classList.remove('-translate-x-full');
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// TABLE RESPONSIVENESS UTILS
// ═══════════════════════════════════════════════════════════════

function initTableActions() {
    // Ensure all tables in admin panel have responsive wrappers
    const tables = document.querySelectorAll('.admin-content table');
    
    tables.forEach(table => {
        if (!table.parentElement.classList.contains('table-responsive') && 
            !table.parentElement.classList.contains('overflow-x-auto')) {
            
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive overflow-x-auto';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}
/**
 * Campus Connect - Search Functionality
 * Handles global search across users and announcements
 */

let lastSearchResults = { users: [], announcements: [] };

document.addEventListener('DOMContentLoaded', () => {
    // Robust selector strategy to find the search input
    const searchInput = 
        document.getElementById('search-input') || 
        document.querySelector('input[type="search"]') || 
        document.querySelector('input[name="q"]') ||
        document.querySelector('input[placeholder*="Search"]');
    
    if (!searchInput) {
        console.warn('Campus Connect Search: Input element not found. Ensure input has id="search-input" or type="search".');
        return;
    }

    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'search-results-dropdown';
    resultsContainer.className = 'absolute top-full left-0 w-full bg-white rounded-lg shadow-xl border border-gray-200 mt-2 hidden z-[100] overflow-hidden';
    
    // Append to parent (assuming parent is relative)
    if (searchInput.parentElement) {
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(resultsContainer);
    }

    let debounceTimer;

    // Prevent form submission on Enter
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            if (query.length >= 2) {
                performSearch(query);
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

        debounceTimer = setTimeout(() => performSearch(query), 300);
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

    async function performSearch(query) {
        try {
            // Show loading state
            resultsContainer.classList.remove('hidden');
            resultsContainer.innerHTML = `
                <div class="p-4 text-center text-gray-500 text-sm">
                    <i class="fas fa-spinner fa-spin mr-2"></i> Searching...
                </div>
            `;

            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            lastSearchResults = data; // Store results for click handlers
            renderResults(data);
            
        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = `
                <div class="p-4 text-center text-red-500 text-sm">
                    Error performing search
                </div>
            `;
        }
    }

    function renderResults(data) {
        const hasUsers = data.users && data.users.length > 0;
        const hasAnnouncements = data.announcements && data.announcements.length > 0;

        if (!hasUsers && !hasAnnouncements) {
            resultsContainer.innerHTML = `
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

        resultsContainer.innerHTML = html;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Global handler for search result clicks
    window.openSearchAnnouncement = function(id) {
        const ann = lastSearchResults.announcements.find(a => a.id === id);
        if (ann && window.displayAnnouncement) {
            window.displayAnnouncement(ann);
        } else {
            console.warn('Announcement modal logic not available or announcement not found');
        }
    };
});
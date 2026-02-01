/**
 * ═══════════════════════════════════════════════════════════════
 * POST UTILS - Shared Post Rendering & Utilities
 * Campus Connect - Reusable Component
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Format timestamp to "X time ago"
 */
function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);

    const intervals = [
        { label: "year", seconds: 31536000 },
        { label: "month", seconds: 2592000 },
        { label: "week", seconds: 604800 },
        { label: "day", seconds: 86400 },
        { label: "hour", seconds: 3600 },
        { label: "minute", seconds: 60 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
        }
    }
    return "Just now";
}

/**
 * Get badge HTML for account type
 */
function getBadge(type) {
    const styles = {
        club: 'bg-purple-100 text-purple-600',
        student: 'bg-blue-100 text-blue-600',
        official: 'bg-amber-100 text-amber-600'
    };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${styles[type] || 'bg-slate-100'}">${type}</span>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════
// POST CONTENT RENDERING
// ═══════════════════════════════════════════════════════════════

/**
 * Render post content based on type (image, document, or text)
 * This is the SINGLE SOURCE OF TRUTH for post content rendering
 */
function renderPostContent(post) {
    // DOCUMENT POST
    if (post.file_type === 'document') {
        const fileName = post.image_url ? post.image_url.split('/').pop() : 'document';
        const fileExt = fileName.split('.').pop().toUpperCase();
        
        // Choose icon and color based on file type
        let iconClass = 'fas fa-file-pdf';
        let iconColor = 'text-red-600';
        let bgColor = 'bg-red-100';
        
        if (fileExt === 'DOC' || fileExt === 'DOCX') {
            iconClass = 'fas fa-file-word';
            iconColor = 'text-blue-600';
            bgColor = 'bg-blue-100';
        }
        
        return `
            <div class="p-6 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl mx-4 my-4 hover:border-indigo-400 transition-all duration-300 shadow-md hover:shadow-xl">
                <div class="flex items-center gap-5">
                    <!-- File Icon -->
                    <div class="w-16 h-16 ${bgColor} rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
                        <i class="${iconClass} ${iconColor} text-3xl"></i>
                    </div>
                    
                    <!-- File Info -->
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-lg text-gray-900 mb-1.5 truncate" title="${fileName}">${fileName}</p>
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold">
                                ${fileExt}
                            </span>
                            <span class="text-xs text-gray-500">Document</span>
                        </div>
                    </div>
                    
                    <!-- Download Button -->
                    <a href="${post.image_url}" 
                        download 
                        class="group flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-base rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex-shrink-0">
                        <i class="fas fa-download text-lg"></i>
                        <span>Download</span>
                    </a>
                </div>
            </div>
        `;
    }

    // IMAGE POST
    if (post.file_type === 'image') {
        return `
            <div class="relative group">
                <img src="${post.image_url}" 
                    class="w-full object-cover" 
                    style="max-height: 600px;"
                    alt="Post image">
            </div>
        `;
    }

    // Handle old posts with postImages array (backward compatibility)
    if (post.postImages && post.postImages.length > 0 && !post.file_type) {
        return `
            <div class="relative group">
                <img src="${post.postImages[post.currentImageIndex]}" 
                    class="w-full object-cover" 
                    style="max-height: 600px;">
            </div>
        `;
    }

    // TEXT POST - no additional content
    return '';
}

/**
 * Render a complete post card
 * This is the SINGLE SOURCE OF TRUTH for post card rendering
 * 
 * @param {Object} post - Post data object
 * @param {number} index - Post index in array (for event handlers)
 * @param {Object} options - Additional options
 */
function renderPostCard(post, index, options = {}) {
    const {
        showMenu = true,
        onLike = null,
        onComment = null,
        onShare = null
    } = options;

    // Determine post author info
    const authorName = post.username || post.full_name || 'Unknown User';
    const authorImage = post.profileImage || post.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}`;
    const authorSubtitle = post.collegeName || post.major || 'Student';
    const accountType = post.accountType || 'student';

    return `
        <article class="post-card bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" data-post-id="${post.id}">
            <!-- Post Header -->
            <div class="p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img src="${authorImage}" 
                            class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="font-semibold text-sm text-gray-900">${escapeHtml(authorName)}</p>
                                ${getBadge(accountType)}
                            </div>
                            <p class="text-xs text-gray-500">${timeAgo(post.createdAt || post.created_at)} • ${escapeHtml(authorSubtitle)}</p>
                        </div>
                    </div>
                    ${showMenu ? `
                        <button class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                    ` : ''}
                </div>

                <!-- Post Caption -->
                ${post.caption ? `
                    <div class="mt-3">
                        <p class="text-sm text-gray-800">${escapeHtml(post.caption)}</p>
                    </div>
                ` : ''}
            </div>

            <!-- Post Content Based on Type -->
            ${renderPostContent(post)}

            <!-- Post Footer -->
            <div class="p-4">
                <!-- Engagement Stats -->
                <div class="flex items-center justify-between text-sm text-gray-500 mb-3 pb-3 border-b border-gray-100">
                    <span class="hover:underline cursor-pointer">
                        <i class="fas fa-heart text-red-500 mr-1"></i>
                        ${(post.likesCount || post.likes_count || 0).toLocaleString()}
                    </span>
                    <div class="flex gap-3">
                        <button onclick="${onComment || `openComments(${index})`}" class="hover:underline">
                            ${post.commentsCount || post.comments_count || 0} comments
                        </button>
                        <span class="hover:underline cursor-pointer">12 shares</span>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center justify-between">
                    <button class="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition group" 
                            onclick="${onLike || `toggleLike(${index})`}">
                        <i class="fas fa-thumbs-up text-lg ${post.isLiked ? 'text-indigo-600' : 'text-gray-500 group-hover:text-indigo-600'}"></i>
                        <span class="text-sm font-medium ${post.isLiked ? 'text-indigo-600' : 'text-gray-700 group-hover:text-indigo-600'}">Like</span>
                    </button>
                    <button class="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition group" 
                            onclick="${onComment || `openComments(${index})`}">
                        <i class="fas fa-comment text-lg text-gray-500 group-hover:text-indigo-600"></i>
                        <span class="text-sm font-medium text-gray-700 group-hover:text-indigo-600">Comment</span>
                    </button>
                    <button class="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition group" 
                            onclick="${onShare || `sharePost(${index})`}">
                        <i class="fas fa-share text-lg text-gray-500 group-hover:text-indigo-600"></i>
                        <span class="text-sm font-medium text-gray-700 group-hover:text-indigo-600">Share</span>
                    </button>
                </div>
            </div>
        </article>
    `;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FOR USE IN OTHER MODULES
// ═══════════════════════════════════════════════════════════════

// Make functions available globally
window.PostUtils = {
    timeAgo,
    getBadge,
    escapeHtml,
    renderPostContent,
    renderPostCard
};
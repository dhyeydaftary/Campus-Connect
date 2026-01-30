// Profile Dropdown Toggle
function toggleProfileDropdown() {
    const menu = document.getElementById('dropdown-menu');
    menu.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function (event) {
    const dropdown = document.getElementById('profile-dropdown');
    const menu = document.getElementById('dropdown-menu');

    if (dropdown && !dropdown.contains(event.target)) {
        menu.classList.add('hidden');
    }
});


let posts = [];
let currentPage = 1;
let loading = false;
let viewer = null;
let hasMore = true;
let currentPostType = 'text';


// Helper: Time Ago Formatter
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


// Helper: Dynamic account badges
function getBadge(type) {
    const styles = {
        club: 'bg-purple-100 text-purple-600',
        student: 'bg-blue-100 text-blue-600',
        official: 'bg-amber-100 text-amber-600'
    };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${styles[type] || 'bg-slate-100'}">${type}</span>`;
}


// Loader Control
const loader = document.getElementById("feed-loader");

function showLoader() {
    if (loader) loader.classList.remove("hidden");
}

function hideLoader() {
    if (loader) loader.classList.add("hidden");
}


// Skeleton Control
const skeleton = document.getElementById("skeleton-container");

function showSkeleton() {
    if (skeleton) skeleton.classList.remove("hidden");
}

function hideSkeleton() {
    if (skeleton) skeleton.classList.add("hidden");
}


// Fetch Posts from API
async function loadPosts() {
    if (loading || !hasMore) return;

    loading = true;
    showSkeleton();

    try {
        const res = await fetch(`/api/posts?page=${currentPage}&limit=5`);
        if (!res.ok) return;

        const data = await res.json();

        // NO MORE POSTS — STOP EVERYTHING
        if (data.posts.length === 0) {
            hasMore = false;
            hideSkeleton();
            return;
        }

        posts = [...posts, ...data.posts];
        renderPosts(true);
        currentPage++;

    } catch (err) {
        console.error("Failed to load posts", err);
    } finally {
        loading = false;
        hideSkeleton();
    }
}


// Main Render Function
function renderPosts(append = false) {
    const container = document.getElementById("posts");
    if (!container) return;

    if (!append) {
        container.innerHTML = "";
    }

    posts.forEach((post, index) => {
        const article = document.createElement("article");
        article.className = "post-card bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden";

        article.innerHTML = `
            <!-- Post Header -->
            <div class="p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img src="${post.profileImage}" 
                            class="w-10 h-10 rounded-full object-cover">
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="font-semibold text-sm text-gray-900">${post.username}</p>
                                ${getBadge(post.accountType)}
                            </div>
                            <p class="text-xs text-gray-500">${timeAgo(post.createdAt)} • ${post.collegeName}</p>
                        </div>
                    </div>
                    <button class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>

                <!-- Post Caption -->
                ${post.caption ? `
                    <div class="mt-3">
                        <p class="text-sm text-gray-800">${post.caption}</p>
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
                        ${post.likesCount.toLocaleString()}
                    </span>
                    <div class="flex gap-3">
                        <button onclick="openComments(${index})" class="hover:underline">
                            ${post.commentsCount} comments
                        </button>
                        <span class="hover:underline cursor-pointer">12 shares</span>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center justify-between">
                    <button class="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition group" 
                            onclick="toggleLike(${index})">
                        <i class="fas fa-thumbs-up text-lg ${post.isLiked ? 'text-indigo-600' : 'text-gray-500 group-hover:text-indigo-600'}"></i>
                        <span class="text-sm font-medium ${post.isLiked ? 'text-indigo-600' : 'text-gray-700 group-hover:text-indigo-600'}">Like</span>
                    </button>
                    <button class="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition group" 
                            onclick="openComments(${index})">
                        <i class="fas fa-comment text-lg text-gray-500 group-hover:text-indigo-600"></i>
                        <span class="text-sm font-medium text-gray-700 group-hover:text-indigo-600">Comment</span>
                    </button>
                    <button class="flex-1 flex items-center justify-center gap-2 py-2 hover:bg-gray-50 rounded-lg transition group">
                        <i class="fas fa-share text-lg text-gray-500 group-hover:text-indigo-600"></i>
                        <span class="text-sm font-medium text-gray-700 group-hover:text-indigo-600">Share</span>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(article);
    });
}


function renderPostContent(post) {
    // Check file_type FIRST (for new posts with file uploads)
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
                    
                    <!-- Download Button (Right Side) -->
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

    // Handle old posts with postImages array (fallback for backward compatibility)
    // Only use this if file_type is not set
    if (post.postImages && post.postImages.length > 0 && !post.file_type) {
        return `
            <div class="relative group">
                <img src="${post.postImages[post.currentImageIndex]}" 
                    class="w-full object-cover" 
                    style="max-height: 600px;">
            </div>
        `;
    }

    // Text posts have no additional content
    return '';
}


// Logic: Toggle Like
async function toggleLike(index) {
    const post = posts[index];

    if (!post.id) {
        console.warn("Fake post — likes disabled");
        return;
    }

    try {
        const res = await fetch(`/api/posts/${post.id}/like`, {
            method: "POST"
        });

        if (!res.ok) return;

        const data = await res.json();
        post.isLiked = data.liked;
        post.likesCount = data.likesCount;
        renderPosts();
    } catch (err) {
        console.error("Like failed", err);
    }
}


// Logic: Image Carousel Navigation
function changeImage(postIndex, direction) {
    const post = posts[postIndex];
    const newIndex = post.currentImageIndex + direction;
    if (newIndex >= 0 && newIndex < post.postImages.length) {
        post.currentImageIndex = newIndex;
        renderPosts();
    }
}


// Logic: Comments Modal
async function openComments(index) {
    const post = posts[index];

    if (!post.id) {
        showToast("Comments disabled for demo posts", "error");
        return;
    }

    const modal = document.getElementById("comment-modal");
    const list = document.getElementById("modal-comments-list");
    const input = document.getElementById("comment-input");

    modal.style.display = "flex";
    input.dataset.postId = post.id;
    input.value = "";

    list.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    `;

    try {
        const res = await fetch(`/api/posts/${post.id}/comments`);
        const comments = await res.json();

        if (comments.length === 0) {
            list.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-comment-slash text-4xl text-gray-300 mb-2"></i>
                    <p class="text-gray-500 text-sm">No comments yet</p>
                    <p class="text-gray-400 text-xs mt-1">Be the first to comment!</p>
                </div>
            `;
        } else {
            list.innerHTML = comments.map(c => `
                <div class="flex gap-3">
                    <img src="https://ui-avatars.com/api/?name=${c.username}&background=random&size=32" 
                        alt="${c.username}" 
                        class="w-8 h-8 rounded-full">
                    <div class="flex-1">
                        <div class="bg-gray-100 rounded-2xl px-4 py-2">
                            <p class="font-semibold text-sm text-gray-900">${c.username}</p>
                            <p class="text-sm text-gray-800">${c.text}</p>
                        </div>
                        <div class="flex items-center gap-4 mt-1 px-2">
                            <button class="text-xs text-gray-500 hover:text-indigo-600 font-medium">Like</button>
                            <button class="text-xs text-gray-500 hover:text-indigo-600 font-medium">Reply</button>
                            <span class="text-xs text-gray-400">${timeAgo(c.createdAt)}</span>
                        </div>
                    </div>
                </div>
            `).join("");
        }
    } catch (error) {
        console.error("Error loading comments:", error);
        list.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exclamation-circle text-4xl text-red-300 mb-2"></i>
                <p class="text-red-500 text-sm">Failed to load comments</p>
            </div>
        `;
    }
}


// Logic: Submit Comment
async function submitComment() {
    const input = document.getElementById("comment-input");
    const postId = input.dataset.postId;
    const text = input.value.trim();

    if (!text) {
        showToast("Comment cannot be empty", "error");
        return;
    }

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        if (!res.ok) {
            showToast("Failed to post comment", "error");
            return;
        }

        input.value = "";
        showToast("Comment posted!", "success");

        // Reload comments
        const post = posts.find(p => p.id == postId);
        if (post) {
            post.commentsCount += 1;
        }

        const commentsRes = await fetch(`/api/posts/${postId}/comments`);
        const comments = await commentsRes.json();

        const list = document.getElementById("modal-comments-list");
        list.innerHTML = comments.map(c => `
            <div class="flex gap-3">
                <img src="https://ui-avatars.com/api/?name=${c.username}&background=random&size=32" 
                    alt="${c.username}" 
                    class="w-8 h-8 rounded-full">
                <div class="flex-1">
                    <div class="bg-gray-100 rounded-2xl px-4 py-2">
                        <p class="font-semibold text-sm text-gray-900">${c.username}</p>
                        <p class="text-sm text-gray-800">${c.text}</p>
                    </div>
                    <div class="flex items-center gap-4 mt-1 px-2">
                        <button class="text-xs text-gray-500 hover:text-indigo-600 font-medium">Like</button>
                        <button class="text-xs text-gray-500 hover:text-indigo-600 font-medium">Reply</button>
                        <span class="text-xs text-gray-400">${timeAgo(c.createdAt)}</span>
                    </div>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error posting comment:", error);
        showToast("Failed to post comment", "error");
    }
}


// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    loadPosts();

    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.addEventListener('click', closeComments);
    }

    const fileInput = document.getElementById('post-file');
    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const preview = document.getElementById('file-preview');
            if (!preview) return;

            preview.classList.remove('hidden');

            if (currentPostType === 'photo') {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const imgPreview = document.getElementById('image-preview');
                    const docPreview = document.getElementById('document-preview');

                    if (imgPreview) {
                        imgPreview.src = e.target.result;
                        imgPreview.classList.remove('hidden');
                    }
                    if (docPreview) {
                        docPreview.classList.add('hidden');
                    }
                };
                reader.readAsDataURL(file);
            } else if (currentPostType === 'document') {
                const imgPreview = document.getElementById('image-preview');
                const docPreview = document.getElementById('document-preview');
                const docName = document.getElementById('doc-name');

                if (imgPreview) {
                    imgPreview.classList.add('hidden');
                }
                if (docPreview) {
                    docPreview.classList.remove('hidden');
                }
                if (docName) {
                    docName.textContent = file.name;
                }
            }
        });
    }

    // Load events on page load
    loadEvents();
});


// Logic: Open Create Post Modal
function openCreatePost() {
    const modal = document.getElementById('create-post-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Reset form
    document.getElementById('post-caption').value = '';
    const fileInput = document.getElementById('post-file');
    if (fileInput) {
        fileInput.value = '';
    }
    const preview = document.getElementById('file-preview');
    if (preview) {
        preview.classList.add('hidden');
    }

    // Default to text type
    selectPostType('text');
}


function openCreatePostWithType(type) {
    currentPostType = type;
    openCreatePost();
    selectPostType(type);
}


// Logic: Close Comments Modal
function closeCreatePost() {
    const modal = document.getElementById('create-post-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}


function selectPostType(type) {
    currentPostType = type;

    // Update button styles
    document.querySelectorAll('.post-type-btn').forEach(btn => {
        btn.classList.remove('border-indigo-500', 'bg-indigo-50');
        btn.classList.add('border-gray-200');
    });

    const selectedBtn = document.getElementById(`btn-${type}`);
    if (selectedBtn) {
        selectedBtn.classList.add('border-indigo-500', 'bg-indigo-50');
        selectedBtn.classList.remove('border-gray-200');
    }

    // Update file input
    const fileInput = document.getElementById('post-file');
    const fileContainer = document.getElementById('file-input-container');
    const helpText = document.getElementById('file-help-text');

    if (fileContainer) {
        if (type === 'text') {
            fileContainer.classList.add('hidden');
        } else {
            fileContainer.classList.remove('hidden');

            if (fileInput) {
                if (type === 'photo') {
                    fileInput.accept = 'image/*';
                    if (helpText) {
                        helpText.textContent = 'Accepts: JPG, PNG, GIF, WEBP (Max 10MB)';
                    }
                } else if (type === 'document') {
                    fileInput.accept = '.pdf,.doc,.docx';
                    if (helpText) {
                        helpText.textContent = 'Accepts: PDF, DOC, DOCX (Max 10MB)';
                    }
                }
            }
        }
    }

    // Reset preview
    const preview = document.getElementById('file-preview');
    if (preview) {
        preview.classList.add('hidden');
    }
}


// Logic: Close Comments Modal
function closeComments(event) {
    const modal = document.getElementById("comment-modal");

    // If event is passed and clicked target is the modal backdrop
    if (event && event.target === modal) {
        modal.style.display = "none";
    } else if (!event) {
        // If called directly without event (from close button)
        modal.style.display = "none";
    }
}


// ============================================
// EVENTS SYSTEM
// ============================================

// NEW FUNCTION: Load Events from API
async function loadEvents() {
    const container = document.getElementById('events-container');
    const loading = document.getElementById('events-loading');
    const empty = document.getElementById('events-empty');

    if (!container) return;

    if (loading) loading.classList.remove('hidden');

    try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Failed to load events');

        const events = await res.json();

        if (loading) loading.classList.add('hidden');

        if (events.length === 0) {
            if (empty) empty.classList.remove('hidden');
            return;
        }

        container.innerHTML = events.map((event, index) => `
            <div class="pb-4 ${index < events.length - 1 ? 'border-b border-gray-100' : ''}">
                <div class="flex gap-3">
                    <!-- Date Box -->
                    <div class="flex-shrink-0 text-center bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-2 w-14 border border-indigo-100">
                        <div class="text-xs font-semibold text-indigo-600">${event.month}</div>
                        <div class="text-xl font-bold text-gray-900">${event.day}</div>
                    </div>
                    
                    <!-- Event Info -->
                    <div class="flex-1 min-w-0">
                        <h4 class="font-semibold text-sm text-gray-900 mb-1">${event.title}</h4>
                        
                        <!-- Time & Location -->
                        <div class="flex items-center text-xs text-gray-500 mb-1">
                            <i class="far fa-clock mr-1"></i>
                            <span>${event.time}</span>
                        </div>
                        <div class="flex items-center text-xs text-gray-500 mb-2">
                            <i class="fas fa-map-marker-alt mr-1"></i>
                            <span>${event.location}</span>
                        </div>
                        
                        <!-- Seats Info -->
                        <div class="flex items-center gap-3 text-xs mb-2">
                            <span class="text-gray-600">
                                <i class="fas fa-users mr-1"></i>
                                ${event.goingCount} going
                            </span>
                            <span class="text-gray-600">
                                <i class="fas fa-star mr-1"></i>
                                ${event.interestedCount} interested
                            </span>
                        </div>
                        <div class="text-xs ${event.availableSeats > 0 ? 'text-green-600' : 'text-red-600'} mb-2">
                            <i class="fas fa-chair mr-1"></i>
                            ${event.availableSeats} of ${event.totalSeats} seats available
                        </div>
                        
                        <!-- Action Buttons -->
                        <div class="flex gap-2 mt-2">
                            ${renderEventButton(event, 'interested')}
                            ${renderEventButton(event, 'going')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Failed to load events:', error);
        if (loading) loading.classList.add('hidden');
        if (container) {
            container.innerHTML = '<p class="text-red-500 text-sm text-center py-4">Failed to load events</p>';
        }
    }
}

// NEW FUNCTION: Render Event Button
function renderEventButton(event, type) {
    const isActive = event.userStatus === type;
    
    if (type === 'interested') {
        return `
            <button onclick="toggleEventStatus(${event.id}, 'interested')"
                    class="group flex-1 px-5 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                        isActive 
                        ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-600' 
                        : 'bg-gray-50 text-gray-700 hover:bg-purple-50 hover:text-purple-600 hover:ring-2 hover:ring-purple-300'
                    }">
                <span class="flex items-center justify-center gap-2">
                    <i class="fas fa-heart text-sm ${isActive ? '' : 'group-hover:scale-125 transition-transform'}"></i>
                    <span>Interested</span>
                </span>
            </button>
        `;
    } else {
        const disabled = event.availableSeats <= 0 && !isActive;
        return `
            <button onclick="toggleEventStatus(${event.id}, 'going')"
                    ${disabled ? 'disabled' : ''}
                    class="group flex-1 px-5 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                        isActive 
                        ? 'bg-green-100 text-green-700 ring-2 ring-green-600' 
                        : disabled
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 hover:ring-2 hover:ring-indigo-300'
                    }">
                <span class="flex items-center justify-center gap-2">
                    <i class="fas ${isActive ? 'fa-check' : disabled ? 'fa-times' : 'fa-plus'} text-sm ${!disabled && !isActive ? 'group-hover:rotate-90 transition-transform' : ''}"></i>
                    <span>${isActive ? "Going" : disabled ? 'Full' : "Join"}</span>
                </span>
            </button>
        `;
    }
}

// NEW FUNCTION: Toggle Event Status
async function toggleEventStatus(eventId, status) {
    try {
        const res = await fetch(`/api/events/${eventId}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || 'Failed to register for event');
            return;
        }

        // Show success message
        showToast(data.message, 'success');

        // Reload events to reflect changes
        await loadEvents();

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to register for event. Please try again.');
    }
}


// Smooth Scroll to Top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


// Show toast notification
function showToast(message, type = 'success') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50 transition-opacity duration-300 ${type === 'success' ? 'bg-green-500' :
            type === 'error' ? 'bg-red-500' :
                'bg-indigo-500'
        }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Fade out and remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500' :
            type === 'error' ? 'bg-red-500' :
                'bg-indigo-500'
        } text-white font-medium`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}


// Logic: Create Post
async function submitPost() {
    const caption = document.getElementById('post-caption').value.trim();
    const fileInput = document.getElementById('post-file');
    const submitBtn = document.getElementById('submit-post-btn');

    // Validation
    if (currentPostType === 'text' && !caption) {
        alert('Please enter some text for your post');
        return;
    }

    if (currentPostType !== 'text' && (!fileInput || !fileInput.files[0])) {
        alert('Please select a file');
        return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Posting...';

    try {
        const formData = new FormData();
        formData.append('post_type', currentPostType);
        formData.append('caption', caption);

        if (currentPostType !== 'text' && fileInput && fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }

        const res = await fetch('/api/posts/create', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to create post');
        }

        // Success - reload posts
        closeCreatePost();
        posts = [];
        currentPage = 1;
        hasMore = true;
        document.getElementById('posts').innerHTML = '';
        await loadPosts();

        // Show success message
        showToast('Post created successfully!', 'success');

    } catch (error) {
        console.error('Error creating post:', error);
        alert(error.message || 'Failed to create post. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    }
}


// Infinite Scroll Handler
function handleScroll() {
    if (!hasMore) return;

    const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300;

    if (nearBottom) {
        loadPosts();
    }
}


// Attach Scroll Event
window.addEventListener("scroll", handleScroll);

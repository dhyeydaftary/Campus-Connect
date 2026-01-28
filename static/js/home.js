// Profile Dropdown Toggle
function toggleProfileDropdown() {
    const menu = document.getElementById('dropdown-menu');
    menu.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
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
function renderPosts(append=false) {
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

            <!-- Post Image -->
            ${post.postImages && post.postImages.length > 0 ? `
                <div class="relative group">
                    <img src="${post.postImages[post.currentImageIndex]}" 
                        class="w-full object-cover" 
                        style="max-height: 600px;">
                    ${post.postImages.length > 1 ? `
                        <button onclick="changeImage(${index}, -1)" 
                                class="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition">
                            <i class="fas fa-chevron-left text-gray-700"></i>
                        </button>
                        <button onclick="changeImage(${index}, 1)" 
                                class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition">
                            <i class="fas fa-chevron-right text-gray-700"></i>
                        </button>
                        <div class="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                            ${post.currentImageIndex + 1}/${post.postImages.length}
                        </div>
                    ` : ''}
                </div>
            ` : ''}

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
});


// Logic: Open Create Post Modal
function openCreatePost() {
    document.getElementById("create-post-modal").style.display = "flex";
}


// Logic: Close Comments Modal
function closeCreatePost() {
    document.getElementById("create-post-modal").style.display = "none";
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
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50 transition-opacity duration-300 ${
        type === 'success' ? 'bg-green-500' : 
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


// Logic: Create Post
async function submitPost() {
    const caption = document.getElementById("post-caption").value.trim();
    const imageUrl = document.getElementById("post-image").value.trim();

    if (!caption || !imageUrl) {
        showToast("Caption and image are required", "error");
        return;
    }

    // Show loading state
    const submitBtn = event.target;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Posting...";
    submitBtn.disabled = true;

    try {
        const res = await fetch("/api/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                caption: caption,
                image_url: imageUrl
            })
        });

        if (!res.ok) {
            showToast("Failed to create post", "error");
            return;
        }

        // Success!
        showToast("Post created successfully!", "success");
        
        // Reset + reload feed
        closeCreatePost();
        document.getElementById("post-caption").value = "";
        document.getElementById("post-image").value = "";

        posts = [];
        currentPage = 1;
        hasMore = true;
        loadPosts();
        
    } catch (error) {
        console.error("Error creating post:", error);
        showToast("Failed to create post", "error");
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
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

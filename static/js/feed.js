let posts = [];
let currentPage = 1;
let loading = false;
let viewer = null;


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


const loader = document.getElementById("feed-loader");

function showLoader() {
    if (loader) loader.classList.remove("hidden");
}

function hideLoader() {
    if (loader) loader.classList.add("hidden");
}


// Fetch Posts from API
async function loadPosts() {
    if (loading) return;
    loading = true;
    showLoader();

    try {
        const res = await fetch(`/api/posts?page=${currentPage}&limit=5`);
        if (!res.ok) return;

        const data = await res.json();

        if (!viewer) {
            viewer = data.viewer;
        }

        if (data.posts.length === 0) {
            window.removeEventListener("scroll", handleScroll);
            hideLoader();
            return;
        }

        posts = [...posts, ...data.posts];
        renderPosts(true);
        currentPage++;
        
    } catch (err) {
        console.error("Failed to load posts", err);
    } finally {
        loading = false;
        hideLoader();
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
        // Removed animation classes
        article.className = "post-card bg-white border rounded-2xl overflow-hidden shadow-sm";

        article.innerHTML = `
            <header class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img src="${post.profileImage}" class="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <p class="font-bold text-sm">${post.username}</p>
                            ${getBadge(post.accountType)}
                        </div>
                        <p class="text-xs text-slate-500">${post.collegeName}</p>
                    </div>
                </div>
                <button class="text-slate-400"><i data-lucide="more-horizontal"></i></button>
            </header>

            ${post.postTag ? `
            <div class="px-4 pb-2">
                <span class="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md capitalize">${post.postTag.replace('-', ' ')}</span>
            </div>` : ''}

            ${post.eventDetails ? `
                <div class="px-4 pb-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <div class="flex items-center gap-1"><i data-lucide="calendar" class="w-3.5 h-3.5 text-indigo-500"></i> ${post.eventDetails.date}</div>
                    <div class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-indigo-500"></i> ${post.eventDetails.location}</div>
                </div>
            ` : ''}

            <div class="relative group aspect-square bg-slate-100">
                <img src="${post.postImages[post.currentImageIndex]}" class="w-full h-full object-cover">
                ${post.postImages.length > 1 ? `
                    <button onclick="changeImage(${index}, -1)" class="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full shadow hover:bg-white opacity-0 group-hover:opacity-100">
                        <i data-lucide="chevron-left"></i>
                    </button>
                    <button onclick="changeImage(${index}, 1)" class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1 rounded-full shadow hover:bg-white opacity-0 group-hover:opacity-100">
                        <i data-lucide="chevron-right"></i>
                    </button>
                    <div class="absolute top-3 right-3 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full">
                        ${post.currentImageIndex + 1}/${post.postImages.length}
                    </div>
                ` : ''}
            </div>

            <div class="p-4">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex gap-4">
                        <button class="like-btn group" onclick="toggleLike(${index})">
                            <i data-lucide="heart" class="w-6 h-6 ${post.isLiked ? 'fill-red-500 text-red-500' : 'text-slate-600 group-hover:text-red-400'}"></i>
                        </button>
                        <button onclick="openComments(${index})"><i data-lucide="message-circle" class="w-6 h-6 text-slate-600"></i></button>
                        <i data-lucide="send" class="w-6 h-6 text-slate-600"></i>
                    </div>
                    <i data-lucide="bookmark" class="w-6 h-6 text-slate-600"></i>
                </div>

                <p class="font-bold text-sm mb-1">${post.likesCount.toLocaleString()} likes</p>

                <p class="text-sm">
                    <span class="font-bold mr-2">${post.username}</span>
                    ${post.caption}
                </p>

                <div class="flex flex-wrap gap-1.5 mt-2">
                    ${post.hashtags ? post.hashtags.map(tag => `<span class="text-xs text-indigo-600 cursor-pointer hover:underline">#${tag}</span>`).join('') : ''}
                </div>

                ${post.postTag === 'event' ? `<button class="w-full mt-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Register for Event</button>` : ''}

                <button onclick="openComments(${index})" class="text-slate-400 text-xs mt-3 block">View all ${post.commentsCount} comments</button>
                
                <p class="text-[10px] text-slate-400 mt-3 uppercase tracking-wider">
                    ${timeAgo(post.createdAt)}
                </p>

            </div>
        `;
        container.appendChild(article);
    });
    if (window.lucide) {
        lucide.createIcons();
    }
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
        alert("Comments disabled for demo posts");
        return;
    }

    const modal = document.getElementById("comment-modal");
    const list = document.getElementById("modal-comments-list");
    const input = document.getElementById("comment-input");

    modal.style.display = "flex";
    input.dataset.postId = post.id;
    input.value = "";

    list.innerHTML = "<p class='text-xs text-slate-400'>Loading...</p>";

    const res = await fetch(`/api/posts/${post.id}/comments`);
    const comments = await res.json();

    list.innerHTML = comments.map(c => `
        <div class="flex gap-3 mb-4">
            <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                ${c.username.charAt(0)}
            </div>
            <div>
                <p class="text-xs"><span class="font-bold">${c.username}</span> ${c.text}</p>
                <p class="text-[10px] text-slate-400">${timeAgo(c.createdAt)}</p>
            </div>
        </div>
    `).join("");
}


// Logic: Submit Comment
async function submitComment() {
    const input = document.getElementById("comment-input");
    const postId = input.dataset.postId;
    const text = input.value.trim();

    if (!text) return;

    const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });

    if (!res.ok) {
        alert("Failed to post comment");
        return;
    }

    input.value = "";

    // Reload comments
    const post = posts.find(p => p.id == postId);
    if (post) {
        post.commentsCount += 1;
    }

    const commentsRes = await fetch(`/api/posts/${postId}/comments`);
    const comments = await commentsRes.json();

    const list = document.getElementById("modal-comments-list");
    list.innerHTML = comments.map(c => `
        <div class="flex gap-3 mb-4">
            <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                ${c.username.charAt(0)}
            </div>
            <div>
                <p class="text-xs">
                    <span class="font-bold">${c.username}</span> ${c.text}
                </p>
                <p class="text-[10px] text-slate-400">
                    ${timeAgo(c.createdAt)}
                </p>
            </div>
        </div>
    `).join("");
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


// Logic: Create Post
async function submitPost() {
    const caption = document.getElementById("post-caption").value.trim();
    const imageUrl = document.getElementById("post-image").value.trim();

    if (!caption || !imageUrl) {
        alert("Caption and image are required");
        return;
    }

    const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            caption: caption,
            image_url: imageUrl
        })
    });

    if (!res.ok) {
        alert("Failed to create post");
        return;
    }

    // Reset + reload feed
    closeCreatePost();
    document.getElementById("post-caption").value = "";
    document.getElementById("post-image").value = "";

    posts = [];
    currentPage = 1;
    loadPosts();
}


// Infinite Scroll
window.addEventListener("scroll", () => {
    const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300;

    if (nearBottom) {
        loadPosts();
    }
});


// Infinite Scroll Handler
function handleScroll() {
    const nearBottom =
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300;

    if (nearBottom) {
        loadPosts();
    }
}
window.addEventListener("scroll", handleScroll);

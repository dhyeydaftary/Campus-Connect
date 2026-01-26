const posts = [
    {
        postId: '1',
        username: 'techclub_mit',
        profileImage: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=150&h=150&fit=crop',
        accountType: 'club', 
        collegeName: 'MIT Campus',
        postImages: [
            'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800',
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
            'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800'
        ],
        currentImageIndex: 0,
        caption: 'Hackathon 2025 is HERE! 🚀 48 hours of pure innovation, coding, and creativity. Over $10,000 in prizes!',
        hashtags: ['Hackathon2025', 'TechClub', 'Innovation', 'Coding'],
        likesCount: 847,
        commentsCount: 56,
        timestamp: '2 hours ago',
        isLiked: false,
        postTag: 'event',
        eventDetails: { date: 'March 15-17, 2025', location: 'Engineering Building Hall A' },
        comments: [
            { id: 'c1', username: 'sarah_codes', text: 'So excited for this! Already forming my team 🔥' },
            { id: 'c2', username: 'dev_john', text: 'Can first-years participate?' }
        ]
    },
    {
        postId: '2',
        username: 'maya.chen',
        profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        accountType: 'student',
        collegeName: 'Stanford University',
        postImages: ['https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800'],
        currentImageIndex: 0,
        caption: 'Officially done with finals! 📚✨ Time to celebrate and recharge.',
        hashtags: ['FinalsWeek', 'CollegeLife', 'Achievement'],
        likesCount: 342,
        commentsCount: 28,
        timestamp: '4 hours ago',
        isLiked: true,
        postTag: 'achievement',
        comments: [
            { id: 'c3', username: 'alex_study', text: 'Congrats Maya! You killed it! 🎉' }
        ]
    }
];

// Helper for dynamic account badges
function getBadge(type) {
    const styles = {
        club: 'bg-purple-100 text-purple-600',
        student: 'bg-blue-100 text-blue-600',
        official: 'bg-amber-100 text-amber-600'
    };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${styles[type] || 'bg-slate-100'}">${type}</span>`;
}

// Main Render Function
function renderPosts() {
    const container = document.getElementById("posts");
    if (!container) return;
    container.innerHTML = "";

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
                
                <p class="text-[10px] text-slate-400 mt-3 uppercase tracking-wider">${post.timestamp}</p>
            </div>
        `;
        container.appendChild(article);
    });
    lucide.createIcons();
}

// Logic: Toggle Like
function toggleLike(index) {
    const post = posts[index];
    post.isLiked = !post.isLiked;
    post.likesCount += post.isLiked ? 1 : -1;
    renderPosts();
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
function openComments(index) {
    const post = posts[index];
    const modal = document.getElementById('comment-modal');
    const list = document.getElementById('modal-comments-list');
    
    if (!modal || !list) return;

    list.innerHTML = post.comments.map(c => `
        <div class="flex gap-3 mb-4">
            <div class="w-8 h-8 rounded-full bg-slate-100 shrink-0 flex items-center justify-center font-bold text-[10px] text-indigo-600 uppercase">
                ${c.username.charAt(0)}
            </div>
            <div>
                <p class="text-xs"><span class="font-bold mr-2">${c.username}</span> ${c.text}</p>
                <p class="text-[10px] text-slate-400 mt-1">Just now</p>
            </div>
        </div>
    `).join('');
    
    modal.style.display = 'flex';
}

function closeComments(event) {
    const modal = document.getElementById('comment-modal');
    if (event.target === modal || event.target.closest('.close-modal')) {
        modal.style.display = 'none';
    }
}

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    renderPosts();
    
    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.addEventListener('click', closeComments);
    }
});
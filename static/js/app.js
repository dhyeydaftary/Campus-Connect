// Mock database using localStorage
const DB = {
    getUsers: () => JSON.parse(localStorage.getItem('users') || '[]'),
    setUsers: (users) => localStorage.setItem('users', JSON.stringify(users)),
    getPosts: () => JSON.parse(localStorage.getItem('posts') || '[]'),
    setPosts: (posts) => localStorage.setItem('posts', JSON.stringify(posts)),
    getCurrentUser: () => JSON.parse(localStorage.getItem('currentUser') || 'null'),
    setCurrentUser: (user) => localStorage.setItem('currentUser', JSON.stringify(user))
};

// Initialize with sample data
function initSampleData() {
    if (DB.getPosts().length === 0) {
        const samplePosts = [
            { id: 1, userId: 0, userName: 'Priya Sharma', content: '🎉 Just finished my final exams! Time to celebrate with friends!', likes: [], createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: 2, userId: 0, userName: 'Rahul Patel', content: 'The new library study rooms are amazing! Finally found my perfect study spot 📚', likes: [], createdAt: new Date(Date.now() - 7200000).toISOString() },
            { id: 3, userId: 0, userName: 'Ananya Singh', content: 'Coffee + coding = perfect evening ☕💻 Working on my semester project!', likes: [], createdAt: new Date(Date.now() - 10800000).toISOString() }
        ];
        DB.setPosts(samplePosts);
    }
}
initSampleData();

// Validate college email
function isValidCollegeEmail(email) {
    return email.endsWith('.edu') || email.endsWith('.ac.in');
}

// Format time ago
function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

// Registration
document.getElementById('registerForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!isValidCollegeEmail(email)) {
        alert('Please use a valid college email (.edu or .ac.in)');
        return;
    }

    const users = DB.getUsers();
    if (users.find(u => u.email === email)) {
        alert('Email already registered!');
        return;
    }

    const newUser = { id: Date.now(), name, email, password };
    users.push(newUser);
    DB.setUsers(users);
    DB.setCurrentUser(newUser);
    window.location.href = 'feed.html';
});

// Login
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const users = DB.getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        DB.setCurrentUser(user);
        window.location.href = 'feed.html';
    } else {
        alert('Invalid email or password!');
    }
});

// Logout
function logout() {
    DB.setCurrentUser(null);
    window.location.href = 'index.html';
}

// Check authentication
function requireAuth() {
    if (!DB.getCurrentUser()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Create post
function createPost() {
    if (!requireAuth()) return;
    const content = document.getElementById('postContent').value.trim();
    if (!content) return;

    const user = DB.getCurrentUser();
    const posts = DB.getPosts();
    const newPost = {
        id: Date.now(),
        userId: user.id,
        userName: user.name,
        content,
        likes: [],
        createdAt: new Date().toISOString()
    };
    posts.unshift(newPost);
    DB.setPosts(posts);
    document.getElementById('postContent').value = '';
    loadFeed();
}

// Toggle like
function toggleLike(postId) {
    if (!requireAuth()) return;
    const user = DB.getCurrentUser();
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    
    if (post) {
        const likeIndex = post.likes.indexOf(user.id);
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1);
        } else {
            post.likes.push(user.id);
        }
        DB.setPosts(posts);
        loadFeed();
    }
}

// Render post HTML
function renderPost(post, currentUserId) {
    const isLiked = post.likes.includes(currentUserId);
    return `
        <div class="bg-white rounded-2xl shadow-md border border-lavender-100 p-6 animate-fade-in">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 bg-lavender-200 rounded-full flex items-center justify-center text-lavender-700 font-bold">
                    ${post.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p class="font-semibold text-gray-900">${post.userName}</p>
                    <p class="text-xs text-gray-400">${timeAgo(post.createdAt)}</p>
                </div>
            </div>
            <p class="text-gray-800 mb-4">${post.content}</p>
            <button onclick="toggleLike(${post.id})" 
                class="flex items-center gap-2 text-sm ${isLiked ? 'text-red-500' : 'text-gray-500'} hover:text-red-500 transition">
                <span class="${isLiked ? 'heart-pop' : ''}">${isLiked ? '❤️' : '🤍'}</span>
                <span>${post.likes.length} ${post.likes.length === 1 ? 'like' : 'likes'}</span>
            </button>
        </div>
    `;
}

// Load feed
function loadFeed() {
    if (!requireAuth()) return;
    const user = DB.getCurrentUser();
    document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
    
    const posts = DB.getPosts();
    const container = document.getElementById('postsContainer');
    container.innerHTML = posts.map(post => renderPost(post, user.id)).join('');
}

// Load profile
function loadProfile() {
    if (!requireAuth()) return;
    const user = DB.getCurrentUser();
    const posts = DB.getPosts();
    
    document.getElementById('profileAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;
    
    const userPosts = posts.filter(p => p.userId === user.id);
    const totalLikes = userPosts.reduce((sum, p) => sum + p.likes.length, 0);
    
    document.getElementById('postCount').textContent = userPosts.length;
    document.getElementById('likeCount').textContent = totalLikes;
    
    const container = document.getElementById('userPosts');
    if (userPosts.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">No posts yet. Share something!</p>';
    } else {
        container.innerHTML = userPosts.map(post => renderPost(post, user.id)).join('');
    }
}

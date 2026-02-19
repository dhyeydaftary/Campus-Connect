// Initialize shared feed loader for home page
let currentPostType = 'text';

// Initialize feed loader on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize feed loader for home page ONLY if we are on /home
    if (window.location.pathname.includes('/home')) {
        window.feedLoader = new FeedLoader('/api/posts', 'post-feed');

        // Load initial posts
        window.feedLoader.loadPosts();

        // Enable infinite scroll
        window.feedLoader.enableInfiniteScroll();
    }

    // Load other components
    loadSuggestions();
    loadProfileCard();
    loadProfileCompletion();
    loadPendingRequests();
    loadEvents();
    setupProfileUpload();

    // Setup comment modal
    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.addEventListener('click', closeComments);
    }

    // Setup file input preview
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
});

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE PHOTO UPLOAD
// ═══════════════════════════════════════════════════════════════════════════

function setupProfileUpload() {
    const input = document.getElementById('home-profile-upload');
    if (!input) return;

    input.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const url = await ProfileUpload.upload(file);
            ProfileUpload.updateGlobalAvatars(url);
            showToast('Profile photo updated!', 'success');
        } catch (err) {
            console.error('Upload error:', err);
            showToast(err.message || 'Failed to upload photo', 'error');
        }
    });
}

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

// Logic: Submit Comment
async function submitComment() {
    const input = document.getElementById('comment-input');
    const postId = input.dataset.postId;
    const text = input.value.trim();
    
    if (!text || !postId) return;
    
    try {
        const response = await fetch(`/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) throw new Error('Failed to post comment');
        
        input.value = '';
        
        // Refresh comments
        if (window.feedLoader) {
            const postIndex = window.feedLoader.posts.findIndex(p => p.id == postId);
            if (postIndex >= 0) {
                // Update count locally
                const post = window.feedLoader.posts[postIndex];
                if (post.commentsCount !== undefined) post.commentsCount++;
                else if (post.comments_count !== undefined) post.comments_count++;
                
                window.feedLoader.renderPosts();
                window.feedLoader.openComments(postIndex);
            }
        }
        
    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Failed to post comment', 'error');
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
            showToast('Registration Failed', data.error || 'Failed to register for event', 'error');
            return;
        }

        // Show success message
        showToast('Success', data.message, 'success');

        // Reload events to reflect changes
        await loadEvents();

    } catch (error) {
        console.error('Error:', error);
        showToast('Network Error', 'Failed to register for event. Please try again.', 'error');
    }
}


// Smooth Scroll to Top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Logic: Create Post
async function submitPost() {
    const caption = document.getElementById('post-caption').value.trim();
    const fileInput = document.getElementById('post-file');
    const submitBtn = document.getElementById('submit-post-btn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Posting...';

    try {
        // Validation: Throw errors to be caught by the catch block.
        if (currentPostType === 'text' && !caption) {
            throw new Error('Please enter some text for your post.');
        }

        if (currentPostType !== 'text' && (!fileInput || !fileInput.files[0])) {
            throw new Error('Please select a file for this post type.');
        }

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

        closeCreatePost();
        
        window.feedLoader.currentPage = 1;
        window.feedLoader.hasMore = true;
        window.feedLoader.posts = [];

        await window.feedLoader.loadPosts(false);

        await loadProfileCard();

        showToast('Success', 'Post created successfully!', 'success');

    } catch (error) {
        console.error('Error creating post:', error);
        const isValidationError = error.message.includes('Please enter') || error.message.includes('Please select');
        showToast(
            isValidationError ? 'Incomplete Post' : 'Post Error',
            error.message,
            isValidationError ? 'warning' : 'error'
        );
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Post';
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTED FOR YOU - DYNAMIC LOADING
// ═══════════════════════════════════════════════════════════════════════════

async function loadSuggestions() {
    try {
        const response = await fetch('/api/suggestions');
        
        if (!response.ok) {
            console.error('Failed to load suggestions');
            return;
        }
        
        const data = await response.json();
        const container = document.getElementById('suggestions-container');
        
        if (!container) {
            console.error('Suggestions container not found');
            return;
        }
        
        // FIX: Enforce Box/Card Styling programmatically
        container.className = "bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6";
        
        if (data.suggestions.length === 0) {
            container.innerHTML = `
                <h3 class="font-bold text-gray-900 mb-4">Suggested for you</h3>
                <p class="text-gray-500 text-sm text-center py-4">
                    No suggestions available
                </p>
            `;
            return;
        }

        // FIX: Rebuild internal structure with Header + List Wrapper
        container.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-bold text-gray-900">Suggested for you</h3>
            </div>
            <div id="suggestions-list-inner" class="space-y-3"></div>
        `;
        
        const listInner = document.getElementById('suggestions-list-inner');
        
        // Add each suggestion
        data.suggestions.forEach(user => {
            const suggestionCard = `
                <div class="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition duration-200">
                    <div class="flex items-center gap-3">
                        <img src="${user.profile_picture}" 
                            class="w-10 h-10 rounded-full object-cover"
                            alt="${user.name}"
                            onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}'">
                        <div>
                            <a href="/profile/${user.id}" 
                                class="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition">
                                    ${user.name}
                                </a>
                            <p class="text-xs text-gray-500 truncate max-w-[140px]">${user.email}</p>
                        </div>
                    </div>
                    <button onclick="sendConnectionRequest(${user.id})"
                            class="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition duration-200">
                        Connect
                    </button>
                </div>
            `;
            listInner.insertAdjacentHTML('beforeend', suggestionCard);
        });
        
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

// Placeholder function for connection request (implement later)
async function sendConnectionRequest(userId) {
    try {
        const response = await fetch('/api/connections/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ receiver_id: userId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Success - show message and refresh suggestions
            showToast('Success', 'Connection request sent successfully!', 'success');
            loadSuggestions(); // Refresh suggestions to remove this user
        } else {
            if (response.status === 401 || response.status === 403) {
                showToast('Session Error', 'Your session has expired. Reloading...', 'error');
                setTimeout(() => window.location.reload(), 1000);
                return;
            }
            // Error - show error message
            showToast('Error', data.error || 'Failed to send connection request', 'error');
        }
        
    } catch (error) {
        console.error('Error sending connection request:', error);
        showToast('Network Error', 'Could not send request. Please try again.', 'error');
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC PROFILE CARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadProfileCard() {
    try {
        const response = await fetch('/api/profile/me');
        
        if (!response.ok) {
            console.error('Failed to load profile');
            return;
        }
        
        const data = await response.json();
        
        // Update posts count
        const postsCount = document.getElementById('profile-posts-count');
        if (postsCount) {
            postsCount.textContent = data.stats.posts;
        }
        
        // Update connections count
        const connectionsCount = document.getElementById('profile-connections-count');
        if (connectionsCount) {
            connectionsCount.textContent = data.stats.connections;
        }
        
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// PROFILE COMPLETION CARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadProfileCompletion() {
    const container = document.getElementById('profile-completion-card');
    if (!container) return;

    try {
        const res = await fetch('/api/profile/completion');
        if (!res.ok) return;
        const data = await res.json();

        // If 100% complete, show success state or hide (showing success here for engagement)
        if (data.percentage === 100) {
            container.innerHTML = `
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <i class="fas fa-check"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-900 text-sm">Profile Complete!</h3>
                            <p class="text-xs text-gray-500">You're all set up.</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Render missing items
        const missingItemsHtml = data.missing_fields.map(item => {
            const actionAttr = item.is_js ? `onclick="${item.action}"` : `href="${item.action}"`;
            const tag = item.is_js ? 'button' : 'a';
            
            return `
                <${tag} ${actionAttr} class="block w-full text-left text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-50 px-2 py-1.5 rounded transition flex items-center gap-2 group">
                    <i class="fas fa-plus-circle text-xs text-indigo-400 group-hover:text-indigo-600"></i>
                    ${item.label}
                </${tag}>
            `;
        }).join('');

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                <div class="flex justify-between items-end mb-2">
                    <h3 class="font-bold text-gray-900 text-sm">Profile Completion</h3>
                    <span class="text-xs font-semibold text-indigo-600">${data.percentage}%</span>
                </div>
                
                <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500" style="width: ${data.percentage}%"></div>
                </div>
                
                <div class="space-y-1">
                    ${missingItemsHtml}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading profile completion:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-LOAD ON PAGE LOAD
// ═══════════════════════════════════════════════════════════════════════════

// Load suggestions when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadSuggestions();
    loadProfileCard();
    loadProfileCompletion();
    loadPendingRequests();
});


async function acceptConnectionRequest(requestId) {
    try {
        const response = await fetch(`/api/connections/accept/${requestId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Connection request accepted!', 'success');
            loadPendingRequests(); // Refresh pending requests
            loadSuggestions(); // Refresh suggestions
            loadProfileCard(); // Refresh connection count
        } else {
            if (response.status === 401 || response.status === 403) {
                showToast('Session mismatch. Reloading...', 'error');
                setTimeout(() => window.location.reload(), 1000);
                return;
            }
            showToast(data.error || 'Failed to accept request', 'error');
        }
        
    } catch (error) {
        console.error('Error accepting request:', error);
        showToast('Error accepting request. Please try again.', 'error');
    }
}


async function rejectConnectionRequest(requestId) {
    try {
        const response = await fetch(`/api/connections/reject/${requestId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Info', 'Connection request rejected', 'info');
            loadPendingRequests(); // Refresh pending requests
        } else {
            if (response.status === 401 || response.status === 403) {
                showToast('Session Error', 'Your session has expired. Reloading...', 'error');
                setTimeout(() => window.location.reload(), 1000);
                return;
            }
            showToast('Error', data.error || 'Failed to reject request', 'error');
        }
        
    } catch (error) {
        console.error('Error rejecting request:', error);
        showToast('Network Error', 'Could not reject request. Please try again.', 'error');
    }
}


async function loadPendingRequests() {
    try {
        const response = await fetch('/api/connections/pending');
        
        if (!response.ok) {
            console.error('Failed to load pending requests');
            return;
        }
        
        const data = await response.json();
        const container = document.getElementById('pending-requests-container');
        
        if (!container) {
            // Container doesn't exist yet, that's okay
            return;
        }
        
        // Update count badge if it exists
        const badge = document.getElementById('pending-requests-badge');
        if (badge) {
            if (data.count > 0) {
                badge.textContent = data.count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        if (data.requests.length === 0) {
            container.innerHTML = `
                <p class="text-gray-500 text-sm text-center py-4">
                    No pending connection requests
                </p>
            `;
            return;
        }
        
        // Add each request
        data.requests.forEach(req => {
            const requestCard = `
                <div class="bg-white p-4 rounded-lg border border-gray-200 mb-3">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="${req.sender.profile_picture}" 
                                class="w-12 h-12 rounded-full object-cover"
                                alt="${req.sender.name}">
                        <div class="flex-1">
                            <a href="/profile/${req.sender.id}" class="font-semibold text-gray-900 hover:text-indigo-600 transition">
                                ${req.sender.name}
                            </a>
                            <p class="text-xs text-gray-500">${req.sender.email}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="acceptConnectionRequest(${req.request_id})"
                                class="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
                            Accept
                        </button>
                        <button onclick="rejectConnectionRequest(${req.request_id})"
                                class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition">
                            Reject
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', requestCard);
        });
        
    } catch (error) {
        console.error('Error loading pending requests:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION BELL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

let notificationsOpen = false;

function toggleNotifications() {
    const dropdown = document.getElementById('notification-dropdown');
    
    if (!dropdown) return;
    
    notificationsOpen = !notificationsOpen;
    
    if (notificationsOpen) {
        dropdown.classList.remove('hidden');
        loadNotifications();
    } else {
        dropdown.classList.add('hidden');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const bell = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');
    
    if (bell && dropdown && notificationsOpen) {
        if (!bell.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.add('hidden');
            notificationsOpen = false;
        }
    }
});


async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        
        if (!response.ok) {
            console.error('Failed to load notifications');
            return;
        }
        
        const data = await response.json();
        const listContainer = document.getElementById('notifications-list');
        
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        if (data.notifications.length === 0) {
            listContainer.innerHTML = `
                <div class="p-8 text-center">
                    <p class="text-gray-500 text-sm">No notifications yet</p>
                </div>
            `;
            return;
        }
        
        data.notifications.forEach(notif => {
            const notifElement = createNotificationElement(notif);
            listContainer.insertAdjacentHTML('beforeend', notifElement);
        });
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}


function createNotificationElement(notif) {
    const isUnread = !notif.is_read;
    const bgClass = isUnread ? 'bg-indigo-50' : 'bg-white';
    const dotClass = isUnread ? 'bg-indigo-600' : 'bg-gray-300';
    
    const actorImg = notif.actor ? notif.actor.profile_picture : 'https://ui-avatars.com/api/?name=System';
    const timeAgo = getTimeAgo(notif.created_at);
    
    return `
        <div class="${bgClass} p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                onclick="handleNotificationClick(${notif.id}, '${notif.type}', ${notif.reference_id})">
            <div class="flex items-start gap-3">
                <img src="${actorImg}" 
                        class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        alt="User">
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-900">${notif.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${timeAgo}</p>
                </div>
                <div class="w-2 h-2 rounded-full ${dotClass} flex-shrink-0 mt-2"></div>
            </div>
        </div>
    `;
}


async function handleNotificationClick(notifId, type, referenceId) {
    // Mark as read
    await markNotificationRead(notifId);
    
    // Handle different notification types
    switch(type) {
        case 'connection_request':
            // Refresh pending requests to show the new request
            if (typeof loadPendingRequests === 'function') {
                loadPendingRequests();
            }
            break;
            
        case 'connection_accepted':
            // Refresh profile to show updated connection count
            if (typeof loadProfileCard === 'function') {
                loadProfileCard();
            }
            break;
            
        case 'post_like':
        case 'post_comment':
            // Could scroll to the post or open it
            console.log('Navigate to post:', referenceId);
            break;
    }
    
    // Close dropdown
    document.getElementById('notification-dropdown').classList.add('hidden');
    notificationsOpen = false;
}


async function markNotificationRead(notifId) {
    try {
        await fetch(`/api/notifications/mark-read/${notifId}`, {
            method: 'POST'
        });
        
        // Refresh badge count
        updateNotificationBadge();
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}


async function markAllAsRead() {
    try {
        const response = await fetch('/api/notifications/mark-all-read', {
            method: 'POST'
        });
        
        if (response.ok) {
            // Reload notifications to update UI
            loadNotifications();
            updateNotificationBadge();
        }
        
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}


function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}


// ═══════════════════════════════════════════════════════════════════════════
// VIEW CONNECTIONS MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openConnectionsModal() {
    const modal = document.getElementById('connections-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadConnectionsList();
    }
}

function closeConnectionsModal() {
    const modal = document.getElementById('connections-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function loadConnectionsList() {
    try {
        const response = await fetch('/api/connections/list');
        
        if (!response.ok) {
            console.error('Failed to load connections');
            return;
        }
        
        const data = await response.json();
        const container = document.getElementById('connections-modal-body');
        const countText = document.getElementById('connections-count-text');
        
        if (!container) return;
        
        // Update count
        if (countText) {
            countText.textContent = `${data.count} connection${data.count !== 1 ? 's' : ''}`;
        }
        
        // Clear container
        container.innerHTML = '';
        
        if (data.connections.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                    <p class="text-gray-500 text-lg mb-2">No connections yet</p>
                    <p class="text-gray-400 text-sm">Start connecting with people to grow your network!</p>
                </div>
            `;
            return;
        }
        
        // Create grid of connections
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
        
        data.connections.forEach(connection => {
            const card = `
                <div class="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="${connection.profile_picture}" 
                                class="w-12 h-12 rounded-full object-cover"
                                alt="${connection.name}">
                        <div class="flex-1 min-w-0">
                            <a href="/profile/${connection.id}" class="font-semibold text-gray-900 hover:text-indigo-600 transition truncate">
                                ${connection.name}
                            </a>
                            <p class="text-xs text-gray-500 truncate">${connection.email}</p>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400 mb-3">
                        ${connection.university} • ${connection.batch}
                    </div>
                    <div class="text-xs text-gray-500">
                        Connected since ${connection.connected_since}
                    </div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', card);
        });
        
        container.appendChild(grid);
        
    } catch (error) {
        console.error('Error loading connections:', error);
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('connections-modal');
    if (modal && !modal.classList.contains('hidden')) {
        if (event.target === modal) {
            closeConnectionsModal();
        }
    }
});
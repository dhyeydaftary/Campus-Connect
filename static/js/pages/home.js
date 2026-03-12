// Initialize shared feed loader for home page
let currentPostType = 'text';

// Initialize feed loader on page load
document.addEventListener('DOMContentLoaded', function () {
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
    initCharCounter();
    initDropZone();

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

    input.addEventListener('change', async function (e) {
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
// NOTE: We use style.display directly, NOT classList.add('flex').
// The CSS rule #create-post-modal { display: none } is an ID selector
// (specificity 0,1,0,0) which beats the .flex class (specificity 0,0,1,0).
// So classList toggling silently fails — style.display always wins.
function openCreatePost() {
    const modal = document.getElementById('create-post-modal');
    modal.style.display = 'flex';

    // Reset form
    document.getElementById('post-caption').value = '';
    const fileInput = document.getElementById('post-file');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('file-preview');
    if (preview) preview.classList.add('hidden');

    // Default to text type
    selectPostType('text');
}


function openCreatePostWithType(type) {
    currentPostType = type;
    openCreatePost();
    selectPostType(type);
}


// Logic: Close Create Post Modal
function closeCreatePost() {
    const modal = document.getElementById('create-post-modal');
    modal.style.display = 'none';
}


// ── Upgraded selectPostType ──────────────────────────────────────
function selectPostType(type) {
    currentPostType = type;

    // Tab active states
    ['text', 'photo', 'document'].forEach(t => {
        const btn = document.getElementById(`btn-${t}`);
        if (btn) btn.classList.remove('cp-tab-active');
    });
    const active = document.getElementById(`btn-${type}`);
    if (active) active.classList.add('cp-tab-active');

    // File zone visibility
    const zone = document.getElementById('file-input-container');
    const fileInput = document.getElementById('post-file');
    const helpText = document.getElementById('file-help-text');
    const dropLabel = document.getElementById('cp-drop-label');
    const dropIcon = document.getElementById('cp-drop-icon');

    if (zone) {
        if (type === 'text') {
            zone.classList.add('hidden');
        } else {
            zone.classList.remove('hidden');
            clearFilePreview();
            if (type === 'photo') {
                if (fileInput) fileInput.accept = 'image/*';
                if (helpText) helpText.textContent = 'JPG, PNG, GIF, WEBP — max 10 MB';
                if (dropLabel) dropLabel.textContent = 'Click to upload or drag & drop';
                if (dropIcon) dropIcon.innerHTML = '<i class="fas fa-image"></i>';
            } else {
                if (fileInput) fileInput.accept = '.pdf,.doc,.docx';
                if (helpText) helpText.textContent = 'PDF, DOC, DOCX — max 10 MB';
                if (dropLabel) dropLabel.textContent = 'Click to upload or drag & drop';
                if (dropIcon) dropIcon.innerHTML = '<i class="fas fa-file-alt"></i>';
            }
        }
    }

    // Reset preview
    clearFilePreview();
}

// Clear file preview 
function clearFilePreview() {
    const preview = document.getElementById('file-preview');
    const imgWrap = document.getElementById('image-preview-wrap');
    const img = document.getElementById('image-preview');
    const docPreview = document.getElementById('document-preview');
    const fileInput = document.getElementById('post-file');
    if (preview) preview.classList.add('hidden');
    if (imgWrap) imgWrap.classList.add('hidden');
    if (img) img.src = '';
    if (docPreview) docPreview.classList.add('hidden');
    if (fileInput) fileInput.value = '';
}

// Char counter 
function initCharCounter() {
    const ta = document.getElementById('post-caption');
    const counter = document.getElementById('cp-char-count');
    const MAX = 1000;
    if (!ta || !counter) return;
    ta.addEventListener('input', () => {
        const len = ta.value.length;
        counter.textContent = `${len} / ${MAX}`;
        counter.classList.toggle('cp-warn', len >= MAX * 0.85 && len < MAX);
        counter.classList.toggle('cp-limit', len >= MAX);
    });
}

// Drag & drop 
function initDropZone() {
    const zone = document.getElementById('file-input-container');
    const input = document.getElementById('post-file');
    if (!zone || !input) return;

    ['dragenter', 'dragover'].forEach(ev => {
        zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(ev => {
        zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag-over'); });
    });
    zone.addEventListener('drop', e => {
        const file = e.dataTransfer.files[0];
        if (!file) return;
        // Inject into the file input and fire change
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
    });
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

    // Mobile containers
    const mobContainer = document.getElementById('mob-events-container');
    const mobEmpty = document.getElementById('mob-events-empty');

    if (!container) return;

    // Show spinner using style.display
    if (loading) {
        loading.style.display = 'flex';
        loading.classList.remove('hidden');
    }

    try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error('Failed to load events');

        const events = await res.json();

        // Hide spinner
        if (loading) {
            loading.style.display = 'none';
            loading.classList.add('hidden');
        }

        const renderHtml = events.map((event, index) => `
            <div style="padding-bottom:0.75rem;${index < events.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
                <div style="display:flex;gap:0.625rem;align-items:flex-start;">
                    <!-- Date Badge -->
                    <div style="flex-shrink:0;width:2.75rem;height:2.75rem;background:hsl(221,68%,28%);border-radius:0.5rem;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;">
                        <span style="font-size:0.5rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;opacity:0.8;line-height:1;">${event.month}</span>
                        <span style="font-size:1.125rem;font-weight:800;line-height:1.15;">${event.day}</span>
                    </div>

                    <!-- Event Info -->
                    <div style="flex:1;min-width:0;">
                        <h4 style="font-size:0.8125rem;font-weight:700;color:var(--ink);margin-bottom:0.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${event.title}</h4>

                        <div style="display:flex;align-items:center;gap:0.25rem;font-size:0.6875rem;color:var(--muted);margin-bottom:0.125rem;">
                            <i class="far fa-clock" style="font-size:0.6rem;flex-shrink:0;"></i>
                            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${event.time}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:0.25rem;font-size:0.6875rem;color:var(--muted);margin-bottom:0.3rem;">
                            <i class="fas fa-map-marker-alt" style="font-size:0.6rem;flex-shrink:0;"></i>
                            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${event.location}</span>
                        </div>

                        <!-- Seats pill -->
                        <div style="margin-bottom:0.4rem;">
                            <span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.625rem;font-weight:600;padding:0.1rem 0.4rem;border-radius:9999px;${event.availableSeats > 0 ? 'background:hsl(142,60%,91%);color:hsl(142,60%,28%);' : 'background:hsl(0,90%,93%);color:hsl(0,65%,45%);'}">
                                <i class="fas fa-chair" style="font-size:0.55rem;"></i>
                                ${event.availableSeats > 0 ? event.availableSeats + ' seats left' : 'Full'}
                            </span>
                        </div>

                        <!-- Action Buttons -->
                        <div style="display:flex;gap:0.375rem;">
                            ${renderEventButton(event, 'interested')}
                            ${renderEventButton(event, 'going')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        if (events.length === 0) {
            if (empty) empty.classList.remove('hidden');
            if (mobEmpty) mobEmpty.classList.remove('hidden');
            container.innerHTML = '';
            if (mobContainer) mobContainer.innerHTML = '';
            return;
        }

        // Update Desktop
        container.innerHTML = renderHtml;
        if (empty) empty.classList.add('hidden');

        // Update Mobile
        if (mobContainer) {
            mobContainer.innerHTML = renderHtml;
            if (mobEmpty) mobEmpty.classList.add('hidden');
        }

    } catch (error) {
        console.error('Failed to load events:', error);
        if (loading) {
            loading.style.display = 'none';
            loading.classList.add('hidden');
        }
        const errorHtml = '<p class="text-red-500 text-sm text-center py-4">Failed to load events</p>';
        if (container) container.innerHTML = errorHtml;
        if (mobContainer) mobContainer.innerHTML = errorHtml;
    }
}

// Compact event action button — sized for the 268px right sidebar
function renderEventButton(event, type) {
    const isActive = event.userStatus === type;

    if (type === 'interested') {
        const base = 'display:inline-flex;align-items:center;justify-content:center;gap:0.3rem;flex:1;padding:0.35rem 0.5rem;font-size:0.6875rem;font-weight:600;border-radius:0.4rem;border:1.5px solid;cursor:pointer;transition:all 0.18s ease;white-space:nowrap;';
        const active = 'background:hsl(270,60%,93%);color:hsl(270,60%,40%);border-color:hsl(270,60%,70%);';
        const inactive = 'background:hsl(220,20%,97%);color:hsl(220,14%,40%);border-color:hsl(220,18%,88%);';
        return `<button onclick="toggleEventStatus(${event.id}, 'interested')" style="${base}${isActive ? active : inactive}">
            <i class="fas fa-heart" style="font-size:0.6rem;"></i> Interested
        </button>`;
    } else {
        const disabled = event.availableSeats <= 0 && !isActive;
        const base = 'display:inline-flex;align-items:center;justify-content:center;gap:0.3rem;flex:1;padding:0.35rem 0.5rem;font-size:0.6875rem;font-weight:600;border-radius:0.4rem;border:1.5px solid;cursor:pointer;transition:all 0.18s ease;white-space:nowrap;';
        const active = 'background:hsl(142,60%,91%);color:hsl(142,60%,28%);border-color:hsl(142,60%,65%);';
        const dis = 'background:hsl(220,18%,95%);color:hsl(220,14%,60%);border-color:hsl(220,18%,88%);cursor:not-allowed;opacity:0.6;';
        const inactive = 'background:hsl(221,68%,95%);color:hsl(221,68%,35%);border-color:hsl(221,68%,75%);';
        const icon = isActive ? 'fa-check' : disabled ? 'fa-times' : 'fa-plus';
        const label = isActive ? 'Going' : disabled ? 'Full' : 'Join';
        return `<button onclick="toggleEventStatus(${event.id}, 'going')" ${disabled ? 'disabled' : ''} style="${base}${isActive ? active : disabled ? dis : inactive}">
            <i class="fas ${icon}" style="font-size:0.6rem;"></i> ${label}
        </button>`;
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
                <div class="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition duration-200">
                    <img src="${user.profile_picture}" 
                        class="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        alt="${user.name}"
                        onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}'">
                    <div class="flex-1 min-w-0">
                        <a href="/profile/${user.id}" 
                            class="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition block truncate">
                                ${user.name}
                            </a>
                        <p class="text-xs text-gray-500 truncate">${user.email}</p>
                    </div>
                    <button onclick="sendConnectionRequest(${user.id})"
                            class="flex-shrink-0 px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition duration-200">
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
document.addEventListener('DOMContentLoaded', function () {
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
                                class="w-12 h-12 rounded-full object-cover flex-shrink-0"
                                alt="${req.sender.name}">
                        <div class="flex-1 min-w-0">
                            <a href="/profile/${req.sender.id}" class="font-semibold text-gray-900 hover:text-indigo-600 transition block truncate">
                                ${req.sender.name}
                            </a>
                            <p class="text-xs text-gray-500 truncate">${req.sender.email}</p>
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
document.addEventListener('click', function (event) {
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
    switch (type) {
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
document.addEventListener('click', function (event) {
    const modal = document.getElementById('connections-modal');
    if (modal && !modal.classList.contains('hidden')) {
        if (event.target === modal) {
            closeConnectionsModal();
        }
    }
});

// =================================================================
// MOBILE BOTTOM NAV + DRAWER
// Only active on screens < 1024px. Desktop layout is untouched.
// =================================================================

(function () {
    // ── State ──
    let _currentTab = null;
    let _dataLoaded = { network: false, more: false };

    // ── Open drawer ──
    function openMobileDrawer(tab) {
        if (window.innerWidth >= 1024) return;

        const drawer = document.getElementById('mob-drawer');
        const backdrop = document.getElementById('mob-drawer-backdrop');
        if (!drawer || !backdrop) return;

        // Show correct panel, hide others
        ['network', 'more'].forEach(t => {
            const panel = document.getElementById('mob-panel-' + t);
            if (panel) panel.classList.toggle('hidden', t !== tab);
        });

        // Update bottom nav active state
        document.querySelectorAll('.mob-nav-item').forEach(el => {
            el.removeAttribute('data-active');
            el.classList.remove('mob-nav-item--active');
        });
        const btn = document.querySelector(`.mob-nav-item[data-tab="${tab}"]`);
        if (btn) btn.setAttribute('data-active', 'true');

        // Animate in
        backdrop.classList.remove('hidden');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => drawer.classList.add('mob-drawer--open'));
        });

        _currentTab = tab;
        document.body.style.overflow = 'hidden';

        // Lazy-load data once per tab
        if (!_dataLoaded[tab]) {
            _dataLoaded[tab] = true;
            if (tab === 'network') _loadNetwork();
            if (tab === 'more') _loadMore();
        }
    }

    // ── Close drawer ──
    function closeMobileDrawer() {
        const drawer = document.getElementById('mob-drawer');
        const backdrop = document.getElementById('mob-drawer-backdrop');
        if (!drawer) return;

        drawer.classList.remove('mob-drawer--open');

        setTimeout(() => {
            if (backdrop) backdrop.classList.add('hidden');
        }, 320);

        // Restore Home as active
        document.querySelectorAll('.mob-nav-item').forEach(el => {
            el.removeAttribute('data-active');
            el.classList.remove('mob-nav-item--active');
        });
        const homeBtn = document.querySelector('.mob-nav-item[data-tab="home"]');
        if (homeBtn) homeBtn.classList.add('mob-nav-item--active');

        _currentTab = null;
        document.body.style.overflow = '';
    }

    // ── Swipe-down to close ──
    let _touchStartY = 0;
    document.addEventListener('touchstart', e => {
        if (document.getElementById('mob-drawer')?.classList.contains('mob-drawer--open')) {
            _touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    document.addEventListener('touchend', e => {
        if (document.getElementById('mob-drawer')?.classList.contains('mob-drawer--open')) {
            const dy = e.changedTouches[0].clientY - _touchStartY;
            if (dy > 80) closeMobileDrawer();
        }
    }, { passive: true });

    // ── Load: Network (Requests + Suggestions) ──
    async function _loadNetwork() {
        // Pending Requests
        try {
            const res = await fetch('/api/connections/pending');
            if (!res.ok) throw new Error();
            const data = await res.json();

            const container = document.getElementById('mob-pending-container');
            const badge = document.getElementById('mob-pending-badge');
            const navBadge = document.getElementById('mob-network-badge');

            // Update badges
            const count = data.count || 0;
            [badge, navBadge].forEach(b => {
                if (!b) return;
                if (count > 0) { b.textContent = count; b.classList.remove('hidden'); }
                else b.classList.add('hidden');
            });

            if (container) {
                if (!data.requests || data.requests.length === 0) {
                    container.innerHTML = '<p class="mob-empty">No pending requests</p>';
                } else {
                    container.innerHTML = data.requests.map(req => `
                        <div style="background:var(--bg);border-radius:var(--r);padding:0.625rem 0.75rem;margin-top:0.5rem;">
                            <div style="display:flex;align-items:center;gap:0.625rem;margin-bottom:0.5rem;">
                                <img src="${req.sender.profile_picture}"
                                     style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid var(--border);"
                                     alt="${req.sender.name}">
                                <div>
                                    <a href="/profile/${req.sender.id}"
                                       style="font-weight:600;font-size:0.8125rem;color:var(--ink);text-decoration:none;">
                                        ${req.sender.name}
                                    </a>
                                    <p style="font-size:0.6875rem;color:var(--muted);">${req.sender.email}</p>
                                </div>
                            </div>
                            <div style="display:flex;gap:0.5rem;">
                                <button onclick="acceptConnectionRequest(${req.request_id})"
                                        style="flex:1;padding:0.375rem 0;background:var(--p);color:#fff;font-size:0.8125rem;font-weight:600;border:none;border-radius:var(--r);cursor:pointer;">
                                    Accept
                                </button>
                                <button onclick="rejectConnectionRequest(${req.request_id})"
                                        style="flex:1;padding:0.375rem 0;background:var(--bg-deep);color:var(--ink-soft);font-size:0.8125rem;font-weight:600;border:1px solid var(--border);border-radius:var(--r);cursor:pointer;">
                                    Reject
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            const c = document.getElementById('mob-pending-container');
            if (c) c.innerHTML = '<p class="mob-empty">Could not load requests</p>';
        }

        // Suggestions
        try {
            const res = await fetch('/api/connections/suggestions');
            if (!res.ok) throw new Error();
            const suggestions = await res.json();
            const container = document.getElementById('mob-suggestions-container');

            if (container) {
                if (!suggestions || suggestions.length === 0) {
                    container.innerHTML = '<p class="mob-empty">No suggestions available</p>';
                } else {
                    container.innerHTML = suggestions.slice(0, 5).map(s => `
                        <div style="display:flex;align-items:center;gap:0.625rem;padding:0.5rem 0;border-bottom:1px solid var(--border-soft);">
                            <img src="${s.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=3b4fd8&color=fff&size=40`}"
                                 style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid var(--border);"
                                 alt="${s.name}">
                            <div style="flex:1;min-width:0;">
                                <a href="/profile/${s.id}"
                                   style="font-weight:600;font-size:0.8125rem;color:var(--ink);text-decoration:none;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                    ${s.name}
                                </a>
                                <p style="font-size:0.6875rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                    ${s.major || ''}
                                </p>
                            </div>
                            <button onclick="sendConnectionRequest(${s.id}, this)"
                                    style="flex-shrink:0;padding:0.3rem 0.75rem;background:var(--p-light);color:var(--p);font-size:0.75rem;font-weight:600;border:1px solid hsl(225 70% 40% / 0.2);border-radius:999px;cursor:pointer;white-space:nowrap;">
                                Connect
                            </button>
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            const c = document.getElementById('mob-suggestions-container');
            if (c) c.innerHTML = '<p class="mob-empty">Could not load suggestions</p>';
        }
    }

    // ── Load: More (Announcements + Events + Profile Completion) ──
    function _loadMore() {
        // Mirror DOM content from desktop sidebar (already fetched by page load)
        // Use a small delay to ensure sidebar JS has already run
        setTimeout(() => {
            // Announcements
            const src = document.getElementById('mini-announcements-list');
            const dest = document.getElementById('mob-announcements-list');
            if (src && dest) dest.innerHTML = src.innerHTML || '<p class="mob-empty">No announcements yet.</p>';

            // Events
            const srcEv = document.getElementById('events-container');
            const destEv = document.getElementById('mob-events-container');
            const srcEmp = document.getElementById('events-empty');
            const destEmp = document.getElementById('mob-events-empty');
            if (srcEv && destEv) {
                if (srcEv.innerHTML.trim()) {
                    destEv.innerHTML = srcEv.innerHTML;
                } else if (srcEmp && !srcEmp.classList.contains('hidden')) {
                    if (destEmp) destEmp.classList.remove('hidden');
                }
            }

            // Profile Completion
            const srcComp = document.getElementById('profile-completion-card');
            const destComp = document.getElementById('mob-completion-card');
            if (srcComp && destComp) destComp.innerHTML = srcComp.innerHTML;

        }, 400);
    }

    // ── Sync network badge on page load ──
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            const desktopBadge = document.getElementById('pending-requests-badge');
            const navBadge = document.getElementById('mob-network-badge');
            if (desktopBadge && navBadge && !desktopBadge.classList.contains('hidden')) {
                navBadge.textContent = desktopBadge.textContent;
                navBadge.classList.remove('hidden');
            }
        }, 1500);
    });

    // ── Expose to global scope (used by onclick in HTML) ──
    window.openMobileDrawer = openMobileDrawer;
    window.closeMobileDrawer = closeMobileDrawer;

})();
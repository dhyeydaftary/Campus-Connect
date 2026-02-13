/**
 * ═══════════════════════════════════════════════════════════════
 * FEED LOADER - Shared Post Loading & Rendering System
 * Campus Connect - Reusable Component
 * ═══════════════════════════════════════════════════════════════
 */

class FeedLoader {
    constructor(apiEndpoint, containerId = 'post-feed') {
        this.apiEndpoint = apiEndpoint;
        this.containerId = containerId;
        this.posts = [];
        this.currentPage = 1;
        this.loading = false;
        this.hasMore = true;
        this.viewer = null;

        // DOM elements
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`FeedLoader Error: Container with ID '${containerId}' not found in DOM.`);
        }

        this.loader = document.getElementById('feed-loader');
        this.skeleton = document.getElementById('skeleton-container');
        this.loadingState = document.getElementById('feed-loading');
        this.errorState = document.getElementById('feed-error');
        this.emptyState = document.getElementById('feed-empty');
        this.loadMoreBtn = document.getElementById('feed-load-more');
        this.endState = document.getElementById('feed-end');
    }

    // ═══════════════════════════════════════════════════════════════
    // LOADING CONTROLS
    // ═══════════════════════════════════════════════════════════════

    showLoader() {
        if (this.loader) this.loader.classList.remove('hidden');
    }

    hideLoader() {
        if (this.loader) this.loader.classList.add('hidden');
    }

    showSkeleton() {
        // Use loadingState since skeleton-container doesn't exist in _post_feed.html
        if (this.loadingState) this.loadingState.classList.remove('hidden');
    }

    hideSkeleton() {
        // Use loadingState since skeleton-container doesn't exist in _post_feed.html
        if (this.loadingState) this.loadingState.classList.add('hidden');
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    showLoadingState() {
        if (this.loadingState) this.loadingState.classList.remove('hidden');
        if (this.errorState) this.errorState.classList.add('hidden');
        if (this.emptyState) this.emptyState.classList.add('hidden');
    }

    hideLoadingState() {
        if (this.loadingState) this.loadingState.classList.add('hidden');
    }

    showErrorState() {
        if (this.loadingState) this.loadingState.classList.add('hidden');
        if (this.errorState) this.errorState.classList.remove('hidden');
        if (this.emptyState) this.emptyState.classList.add('hidden');
    }

    showEmptyState() {
        if (this.loadingState) this.loadingState.classList.add('hidden');
        if (this.errorState) this.errorState.classList.add('hidden');
        if (this.emptyState) {
            this.emptyState.classList.remove('hidden');
        } else {
            console.warn('FeedLoader: Empty state element not found');
        }
    }

    hideEmptyState() {
        if (this.emptyState) this.emptyState.classList.add('hidden');
    }

    // ═══════════════════════════════════════════════════════════════
    // POST LOADING
    // ═══════════════════════════════════════════════════════════════

    async loadPosts(append = false) {
        if (this.loading || !this.hasMore) return;

        this.loading = true;
        this.showSkeleton();

        try {
            const url = `${this.apiEndpoint}?page=${this.currentPage}&limit=5`;
            const response = await fetch(url, {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // NO MORE POSTS — SHOW EMPTY STATE IF FIRST PAGE
            if (data.posts.length === 0) {
                this.hasMore = false;
                this.hideSkeleton();

                if (this.currentPage === 1) {
                    this.showEmptyState();
                } else {
                    this.showEndState();
                }
                return;
            }

            // Store viewer info
            if (data.viewer) {
                this.viewer = data.viewer;
            }

            // Append or replace posts
            if (append) {
                this.posts = [...this.posts, ...data.posts];
            } else {
                this.posts = data.posts;
            }

            this.renderPosts(append, data.posts);
            this.currentPage++;

        } catch (error) {
            console.error('Failed to load posts:', error);
            this.showErrorState();
        } finally {
            this.loading = false;
            this.hideSkeleton();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // POST RENDERING
    // ═══════════════════════════════════════════════════════════════

    renderPosts(append = false, newPosts = []) {
        if (!this.container) {
            console.error(`FeedLoader: Cannot render posts. Container '${this.containerId}' is missing.`);
            return;
        }

        // Safety check for PostUtils
        if (typeof window.PostUtils === 'undefined') {
            console.error('FeedLoader: PostUtils is not defined. Ensure post-utils.js is loaded.');
            return;
        }

        this.hideLoadingState();
        this.hideEmptyState();

        if (!append) {
            this.container.innerHTML = '';
        }

        const postsToRender = newPosts.length > 0 ? newPosts : this.posts;

        postsToRender.forEach((post) => {
            // Create a temporary container to parse the HTML string
            const tempDiv = document.createElement('div');

            // Find the global index in this.posts for correct event handler binding
            const globalIndex = this.posts.findIndex(p => p.id === post.id);
            const safeIndex = globalIndex >= 0 ? globalIndex : this.posts.length;

            tempDiv.innerHTML = window.PostUtils.renderPostCard(post, safeIndex, {
                onLike: `window.feedLoader.toggleLike(${safeIndex})`,
                onComment: `window.feedLoader.openComments(${safeIndex})`,
                onShare: `window.feedLoader.sharePost(${safeIndex})`
            });

            // Append the actual post element (first child of tempDiv) to the container
            if (tempDiv.firstElementChild) {
                this.container.appendChild(tempDiv.firstElementChild);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // POST INTERACTIONS
    // ═══════════════════════════════════════════════════════════════

    async toggleLike(index) {
        const post = this.posts[index];

        if (!post.id) {
            console.warn('Fake post — likes disabled');
            return;
        }

        try {
            const response = await fetch(`/api/posts/${post.id}/like`, {
                method: 'POST'
            });

            if (!response.ok) return;

            const data = await response.json();
            post.isLiked = data.liked;
            post.likesCount = data.likesCount;
            this.renderPosts();

        } catch (error) {
            console.error('Like failed:', error);
        }
    }

    async openComments(index) {
        const post = this.posts[index];

        if (!post.id) {
            this.showToast('Comments disabled for demo posts', 'error');
            return;
        }

        const modal = document.getElementById('comment-modal');
        const list = document.getElementById('modal-comments-list');
        const input = document.getElementById('comment-input');

        modal.style.display = 'flex';
        input.dataset.postId = post.id;
        input.value = '';

        list.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        `;

        try {
            const response = await fetch(`/api/posts/${post.id}/comments`);
            const comments = await response.json();

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
                                <span class="text-xs text-gray-400">${window.PostUtils.timeAgo(c.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            list.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-exclamation-circle text-4xl text-red-300 mb-2"></i>
                    <p class="text-red-500 text-sm">Failed to load comments</p>
                </div>
            `;
        }
    }

    sharePost(index) {
        const post = this.posts[index];
        if (!post) return;
        
        // Open Modal
        const modal = document.getElementById('share-modal');
        if (!modal) {
            this.showToast('Share modal not found', 'error');
            return;
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Store current post data in modal for sending
        modal.dataset.postData = JSON.stringify({
            postId: post.id,
            authorId: post.user_id || 0, // Assuming user_id is available in post object
            authorName: post.username || post.full_name,
            authorAvatar: post.profileImage || post.profile_picture,
            image: (post.postImages && post.postImages[0]) || post.image_url || null,
            caption: post.caption
        });
        
        // Load connections
        this.loadShareConnections();
        
        // Setup search listener
        const searchInput = document.getElementById('share-search');
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = (e) => this.filterShareConnections(e.target.value);
        }
    }

    async loadShareConnections() {
        const list = document.getElementById('share-connections-list');
        if (!list) return;
        
        list.innerHTML = '<div class="text-center py-4 text-gray-500"><i class="fas fa-spinner fa-spin"></i> Loading connections...</div>';
        
        try {
            const res = await fetch('/api/connections/list');
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            
            this.shareConnections = data.connections || [];
            this.renderShareConnections(this.shareConnections);
            
        } catch (e) {
            list.innerHTML = '<div class="text-center py-4 text-red-500">Failed to load connections</div>';
        }
    }

    renderShareConnections(connections) {
        const list = document.getElementById('share-connections-list');
        if (!list) return;
        
        if (connections.length === 0) {
            list.innerHTML = '<div class="text-center py-4 text-gray-500">No connections found</div>';
            return;
        }
        
        list.innerHTML = connections.map(conn => `
            <div class="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition" onclick="window.feedLoader.sendShare(${conn.id})">
                <div class="flex items-center gap-3">
                    <img src="${conn.profile_picture}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                    <div>
                        <p class="font-semibold text-sm text-gray-900">${window.PostUtils.escapeHtml(conn.name)}</p>
                        <p class="text-xs text-gray-500 truncate max-w-[150px]">${window.PostUtils.escapeHtml(conn.major || '')}</p>
                    </div>
                </div>
                <button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `).join('');
    }

    filterShareConnections(query) {
        if (!this.shareConnections) return;
        const lower = query.toLowerCase();
        const filtered = this.shareConnections.filter(c => c.name.toLowerCase().includes(lower));
        this.renderShareConnections(filtered);
    }

    async sendShare(recipientId) {
        const modal = document.getElementById('share-modal');
        const postData = JSON.parse(modal.dataset.postData || '{}');
        
        // Construct share payload
        const content = `[POST_SHARE]${JSON.stringify(postData)}`;
        
        try {
            const res = await fetch('/api/chats/send_message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient_id: recipientId,
                    content: content
                })
            });
            
            if (res.ok) {
                this.showToast('Post shared successfully!', 'success');
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            } else {
                throw new Error('Failed to share');
            }
        } catch (e) {
            this.showToast('Failed to share post', 'error');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════════════════════════

    loadMore() {
        if (this.hasMore && !this.loading) {
            this.loadPosts(true);
        }
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.posts = [];
        this.loadPosts();
    }

    showEndState() {
        if (this.endState) this.endState.classList.remove('hidden');
        if (this.loadMoreBtn) this.loadMoreBtn.classList.add('hidden');
    }

    showToast(message, type = 'success') {
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

    // ═══════════════════════════════════════════════════════════════
    // INFINITE SCROLL
    // ═══════════════════════════════════════════════════════════════

    enableInfiniteScroll() {
        window.addEventListener('scroll', () => {
            if (!this.hasMore) return;

            const nearBottom =
                window.innerHeight + window.scrollY >=
                document.body.offsetHeight - 300;

            if (nearBottom) {
                this.loadPosts(true);
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FOR GLOBAL USE
// ═══════════════════════════════════════════════════════════════

window.FeedLoader = FeedLoader;
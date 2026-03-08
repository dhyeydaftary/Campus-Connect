/* ==============================================================================
 * Campus Connect - Messages Page JavaScript
 * Real-time messaging controller using Socket.IO
 * ============================================================================== */
document.addEventListener('DOMContentLoaded', function () {

    // ==============================================================================
    // STATE
    // Runtime values shared across all functions in this module.
    // ==============================================================================
    const state = {
        conversations: [],
        currentConversationId: null,
        currentUser: null,
        socket: null,
        lastRequestId: 0,
        composeModalOpen: false,
        searchDebounceTimer: null,
        activeSearchRequestId: 0,
        pendingChatUser: null,
        typingTimeout: null,
        selectedFile: null
    };

    // ==============================================================================
    // DOM REFS
    // Collected once on load to avoid repeated querySelector calls.
    // ==============================================================================
    const els = {
        sidebar: document.getElementById('sidebar-panel'),
        chatPanel: document.getElementById('chat-panel'),
        convList: document.getElementById('conversation-list'),
        searchInput: document.getElementById('conversation-search'),
        emptyState: document.getElementById('empty-state'),
        activeChatContainer: document.getElementById('active-chat-container'),
        messagesArea: document.getElementById('messages-area'),
        msgInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-button'),
        backBtn: document.getElementById('back-button'),
        headerName: document.getElementById('chat-header-name'),
        headerInfo: document.getElementById('chat-header-info'),
        headerAvatar: document.getElementById('chat-header-avatar'),
        typingIndicator: document.getElementById('typing-indicator'),
        composeBtn: document.getElementById('compose-btn'),
        composeModal: document.getElementById('compose-modal'),
        closeComposeBtn: document.getElementById('close-compose'),
        composeSearch: document.getElementById('compose-search'),
        composeResults: document.getElementById('compose-results'),
        attachBtn: document.getElementById('attach-btn'),
        fileInput: document.getElementById('chat-file-input'),
        previewArea: document.getElementById('attachment-preview'),
        convSkeletons: document.getElementById('conv-skeletons')
    };

    // ==============================================================================
    // INIT
    // Entry point: identifies current user, sets up Socket.IO,
    // attaches all event listeners, and loads the conversation list.
    // ==============================================================================
    function init() {
        state.currentUser = { id: document.body.dataset.userId };
        state.socket = io();
        setupSocketListeners();

        if (els.searchInput) els.searchInput.addEventListener('input', handleSearch);
        if (els.sendBtn) els.sendBtn.addEventListener('click', sendMessage);
        if (els.backBtn) els.backBtn.addEventListener('click', showSidebarMobile);

        if (els.msgInput) {
            els.msgInput.addEventListener('keydown', handleInputKeydown);
            els.msgInput.addEventListener('input', function () {
                handleTyping();
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
        }

        if (els.composeBtn) els.composeBtn.addEventListener('click', openComposeModal);
        if (els.closeComposeBtn) els.closeComposeBtn.addEventListener('click', closeComposeModal);
        if (els.composeModal) els.composeModal.addEventListener('click', (e) => {
            if (e.target === els.composeModal) closeComposeModal();
        });
        if (els.composeSearch) els.composeSearch.addEventListener('input', handleComposeSearch);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.composeModalOpen) closeComposeModal();
        });

        if (els.attachBtn) els.attachBtn.addEventListener('click', () => els.fileInput.click());
        if (els.fileInput) els.fileInput.addEventListener('change', handleFileSelect);

        // If a conversation ID is in the URL (e.g. from a notification
        // link), open it directly and clean the URL to avoid re-opening
        // on refresh.
        const urlParams = new URLSearchParams(window.location.search);
        const autoConvId = urlParams.get('conversation');
        if (autoConvId) window.history.replaceState({}, document.title, window.location.pathname);

        loadConversations(autoConvId);
    }

    // ==============================================================================
    // SOCKET.IO
    // Handles incoming real-time events: new messages, typing
    // indicators, read receipts, and server-side errors.
    // ==============================================================================
    function setupSocketListeners() {
        state.socket.on('connect', () => console.log('Connected to chat server'));

        state.socket.on('new_message', (msg) => {
            if (state.currentConversationId == msg.conversation_id) {
                appendMessage(msg);
                scrollToBottom();
                if (msg.sender_id != state.currentUser.id) markAsRead(msg.conversation_id);
            } else {
                updateUnreadCount(msg.conversation_id, 1);
                if (window.NavbarUtils && window.NavbarUtils.updateMessageBadge) {
                    window.NavbarUtils.updateMessageBadge();
                }
            }
            updateConversationListPreview(msg);
        });

        state.socket.on('user_typing', (data) => {
            if (state.currentConversationId == data.conversation_id) showTypingIndicator();
        });

        state.socket.on('messages_read', (data) => {
            if (data.read_by == state.currentUser.id) return;
            if (state.currentConversationId == data.conversation_id) {
                els.messagesArea.querySelectorAll('.msg-status').forEach(el => {
                    el.textContent = 'seen';
                    el.classList.add('seen');
                });
            }
            const chat = state.conversations.find(c => c.conversation_id == data.conversation_id);
            if (chat && chat.last_msg_is_own) {
                chat.last_msg_is_read = true;
                renderConversations(state.conversations);
            }
        });

        state.socket.on('error', (data) => {
            console.error('Socket error:', data);
            alert(data.message || 'An error occurred');
        });
    }

    // ==============================================================================
    // API
    // Fetch-based calls to the backend REST endpoints.
    // ==============================================================================
    async function loadConversations(autoSelectId = null) {
        try {
            const res = await fetch('/api/chats');
            if (!res.ok) throw new Error('Failed to load chats');
            state.conversations = await res.json();

            // Skeleton placeholders served on initial load; remove once data arrives.
            if (els.convSkeletons) els.convSkeletons.remove();

            renderConversations(state.conversations);

            if (autoSelectId) {
                const chat = state.conversations.find(c => c.conversation_id == autoSelectId);
                if (chat) {
                    window.selectConversation(autoSelectId);
                } else {
                    fetch(`/api/chats/${autoSelectId}`)
                        .then(r => { if (!r.ok) throw new Error('Chat not found'); return r.json(); })
                        .then(data => {
                            state.currentConversationId = data.conversation_id;
                            state.pendingChatUser = null;
                            els.headerName.textContent = data.partner_name;
                            els.headerAvatar.src = data.partner_avatar;
                            openChatPanel();
                            loadMessages(data.conversation_id);
                        })
                        .catch(err => console.error('Failed to auto-open chat:', err));
                }
            }
        } catch (err) {
            console.error(err);
            if (els.convSkeletons) els.convSkeletons.remove();
            els.convList.innerHTML = `<div class="conv-empty"><div class="conv-empty-icon"><i class="fas fa-exclamation-triangle"></i></div><p style="color:#ef4444;">Failed to load conversations</p></div>`;
        }
    }

    async function loadMessages(conversationId) {
        const requestId = ++state.lastRequestId;
        try {
            els.messagesArea.innerHTML = `<div class="msg-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;

            if (state.currentConversationId && state.currentConversationId !== conversationId) {
                state.socket.emit('leave_chat', { conversation_id: state.currentConversationId });
            }

            const res = await fetch(`/api/messages/${conversationId}`);
            if (!res.ok) throw new Error('Failed to load messages');
            const messages = await res.json();
            if (requestId !== state.lastRequestId) return;

            const firstUnreadId = renderMessages(messages);

            if (firstUnreadId) {
                const el = document.getElementById(firstUnreadId);
                if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
                else scrollToBottom();
            } else {
                scrollToBottom();
            }

            state.socket.emit('join_chat', { conversation_id: conversationId });
            markAsRead(conversationId);
        } catch (err) {
            console.error(err);
            els.messagesArea.innerHTML = `<div class="msg-empty"><div class="msg-empty-icon"><i class="fas fa-exclamation-circle"></i></div><p style="color:#ef4444;">Failed to load messages</p></div>`;
        }
    }

    async function markAsRead(conversationId) {
        try {
            await fetch(`/api/messages/${conversationId}/mark-read`, { method: 'POST' });
            state.socket.emit('mark_read', { conversation_id: conversationId });
            updateUnreadCount(conversationId, 0, true);
            if (window.NavbarUtils && window.NavbarUtils.updateMessageBadge) {
                window.NavbarUtils.updateMessageBadge();
            }
        } catch (err) {
            console.error('Failed to mark read', err);
        }
    }

    // ==============================================================================
    // RENDERING
    // Functions that build and inject HTML from data objects.
    // ==============================================================================
    function renderConversations(conversations) {
        // Rebuilds the full conversation list on every update.
        // Re-rendering is safe here because the list is small and
        // the active highlight needs to reflect state changes.
        const container = els.convList;

        if (conversations.length === 0) {
            container.innerHTML = `
        <div class="conv-empty">
          <div class="conv-empty-icon"><i class="fas fa-comments"></i></div>
          <p>No conversations yet</p>
          <p style="font-size:.75rem;color:#9ca3af;font-family:Inter,sans-serif;">Start a new one with the compose button</p>
        </div>`;
            return;
        }

        container.innerHTML = conversations.map((chat, i) => {
            const isOwn = chat.last_msg_is_own;
            const isRead = chat.last_msg_is_read;
            const isActive = state.currentConversationId == chat.conversation_id;

            // Delivery status shown to the right of the last own message.
            let statusHtml = '';
            if (isOwn) {
                const cls = isRead ? 'seen' : '';
                const text = isRead ? 'Seen' : 'Sent';
                statusHtml = `<span class="conv-status ${cls}">${text}</span>`;
            }

            // Count badge; springs in when unread_count > 0.
            const unreadHtml = chat.unread_count > 0
                ? `<span class="conv-unread-badge">${chat.unread_count}</span>`
                : '';

            // Green dot used as an active indicator when there are unread messages.
            const onlineDot = chat.unread_count > 0
                ? `<div class="conv-online-dot"></div>`
                : '';

            return `
        <div class="conv-item ${isActive ? 'active' : ''}"
             onclick="window.selectConversation(${chat.conversation_id})"
             data-id="${chat.conversation_id}"
             style="animation-delay:${i * 35}ms">

          <div class="conv-avatar-wrap">
            <img src="${chat.partner_avatar}" alt="${escapeHtml(chat.partner_name)}" class="conv-avatar" loading="lazy">
            ${onlineDot}
          </div>

          <div class="conv-meta">
            <div class="conv-top">
              <span class="conv-name">${escapeHtml(chat.partner_name)}</span>
              <span class="conv-time">${formatTimeShort(chat.last_message_at)}</span>
            </div>
            <div class="conv-preview-row">
              <span class="conv-preview ${chat.unread_count > 0 ? 'unread' : ''}">
                ${isOwn ? '<span style="color:#9ca3af;font-size:.72rem;">You: </span>' : ''}${escapeHtml(chat.last_message || 'Start a conversation')}
              </span>
              <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                ${statusHtml}
                ${unreadHtml}
              </div>
            </div>
          </div>
        </div>`;
        }).join('');
    }

    function renderMessages(messages) {
        if (messages.length === 0) {
            els.messagesArea.innerHTML = `
        <div class="msg-empty">
          <div class="msg-empty-icon"><i class="fas fa-hand-wave" style="font-size:1.8rem;">👋</i></div>
          <p>No messages yet. Say hello!</p>
        </div>`;
            return null;
        }

        let lastDate = null;
        let html = '';
        let firstUnreadId = null;

        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.created_at).toLocaleDateString();

            if (msgDate !== lastDate) {
                html += `
          <div class="msg-date-divider">
            <div class="msg-date-chip">${formatDateDivider(msg.created_at)}</div>
          </div>`;
                lastDate = msgDate;
            }

            let msgHtml = createMessageHTML(msg, msg.is_own, index === messages.length - 1);

            if (!firstUnreadId && !msg.is_own && !msg.is_read) {
                firstUnreadId = `msg-${msg.id}`;
                msgHtml = msgHtml.replace('<div class="msg-row', `<div id="${firstUnreadId}" class="msg-row`);
            }

            html += msgHtml;
        });

        els.messagesArea.innerHTML = html;
        return firstUnreadId;
    }

    function createMessageHTML(msg, isSent, isLast = false) {
        let content = msg.content;
        let attachmentHtml = '';

        // Parse [ATTACHMENT] prefix — could be an image or a file.
        // The content after stripping the prefix is JSON with url, type, name, caption.
        if (content.startsWith('[ATTACHMENT]')) {
            try {
                const data = JSON.parse(content.substring(12));
                content = data.caption || '';
                if (data.type === 'image') {
                    attachmentHtml = `
            <img src="${data.url}" alt="Image" class="msg-attachment-img"
                 onclick="window.open('${data.url}','_blank')" loading="lazy">`;
                } else {
                    attachmentHtml = `
            <div class="msg-attachment-file">
              <i class="fas fa-file-pdf" style="color:#f87171;font-size:1.1rem;flex-shrink:0;"></i>
              <a href="${data.url}" target="_blank" rel="noopener"
                 style="font-size:.8rem;text-decoration:underline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;
                        color:${isSent ? 'rgba(255,255,255,.9)' : '#4f46e5'};">
                ${escapeHtml(data.name)}
              </a>
            </div>`;
                }
            } catch (e) { console.error('Error parsing attachment', e); }
        }

        // Parse [POST_SHARE] prefix — renders a linked card pointing
        // to the original post rather than plain text.
        if (content.startsWith('[POST_SHARE]')) {
            try {
                const data = JSON.parse(content.substring(12));
                content = '';
                attachmentHtml = `
          <div class="msg-post-card" onclick="window.location.href='/post/${data.postId}'">
            <span style="font-size:.72rem;font-weight:700;color:${isSent ? 'rgba(255,255,255,.7)' : '#6b7280'};
                         text-transform:uppercase;letter-spacing:.06em;font-family:Inter,sans-serif;">Shared a post</span>
            <p style="font-size:.82rem;font-weight:700;margin:.4rem 0 .2rem;
                      color:${isSent ? '#fff' : '#111827'};font-family:'Plus Jakarta Sans',sans-serif;
                      overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">
              ${escapeHtml(data.authorName)}
            </p>
            <p style="font-size:.78rem;color:${isSent ? 'rgba(255,255,255,.75)' : '#6b7280'};
                      font-family:Inter,sans-serif;overflow:hidden;text-overflow:ellipsis;
                      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:.5rem;">
              ${escapeHtml(data.caption || 'View post')}
            </p>
            <div style="display:flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;
                        text-transform:uppercase;letter-spacing:.07em;
                        color:${isSent ? 'rgba(255,255,255,.8)' : '#4f46e5'};">
              <i class="fas fa-arrow-up-right-from-square" style="font-size:.6rem;"></i> View Post
            </div>
          </div>`;
            } catch (e) { console.error('Error parsing post share', e); }
        }

        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dir = isSent ? 'sent' : 'recv';

        const statusHtml = (isSent && isLast)
            ? `<div class="msg-status ${msg.is_read ? 'seen' : ''}">${msg.is_read ? 'Seen' : 'Sent'}</div>`
            : '';

        return `
      <div class="msg-row ${dir}">
        <div class="msg-bubble">
          ${attachmentHtml}
          ${content ? `<p style="margin:0;">${escapeHtml(content)}</p>` : ''}
          <span class="msg-time">${time}</span>
        </div>
      </div>
      ${statusHtml}`;
    }

    function appendMessage(msg) {
        // Remove the matching optimistic placeholder (if present)
        // before appending the confirmed server message.
        const tempMsg = Array.from(els.messagesArea.querySelectorAll('.temp-message'))
            .find(el => el.dataset.content === msg.content);
        if (tempMsg) tempMsg.remove();

        // Clear the Sent/Seen label from earlier bubbles; it only
        // appears on the most recent message.
        els.messagesArea.querySelectorAll('.msg-status').forEach(el => el.remove());

        const isSent = msg.sender_id == document.body.dataset.userId;
        const html = createMessageHTML(msg, isSent, true);
        els.messagesArea.insertAdjacentHTML('beforeend', html);
    }

    // ==============================================================================
    // PANEL HELPERS
    // Toggle between the sidebar and chat panel on mobile.
    // ==============================================================================
    function openChatPanel() {
        // On viewports below 768px, slide the chat panel over the
        // sidebar rather than showing both side by side.
        if (window.innerWidth < 768) {
            els.sidebar.classList.add('mobile-hidden');
            els.chatPanel.classList.add('mobile-open');
        }
        els.emptyState.style.display = 'none';
        els.activeChatContainer.style.display = 'flex';
    }

    function closeChatPanelMobile() {
        els.sidebar.classList.remove('mobile-hidden');
        els.chatPanel.classList.remove('mobile-open');
        els.activeChatContainer.style.display = 'none';
        els.emptyState.style.display = '';
        state.currentConversationId = null;
    }

    // ==============================================================================
    // ACTIONS
    // User-triggered operations: select conversation, send message,
    // handle typing events.
    // ==============================================================================
    window.selectConversation = function (id) {
        state.currentConversationId = id;
        state.pendingChatUser = null;

        const chat = state.conversations.find(c => c.conversation_id == id);
        if (!chat) return;

        els.headerName.textContent = chat.partner_name;
        els.headerAvatar.src = chat.partner_avatar;

        openChatPanel();
        renderConversations(state.conversations); // Refresh list to move active highlight.
        loadMessages(id);
    };

    async function sendMessage() {
        const content = els.msgInput.value.trim();
        const file = state.selectedFile;

        if ((!content && !file) || (!state.currentConversationId && !state.pendingChatUser)) return;

        let finalContent = content;

        // If a file is queued, upload it first and convert the response
        // into an [ATTACHMENT] JSON payload before sending via socket.
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            els.sendBtn.disabled = true;
            els.sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Upload failed');
                const data = await res.json();
                const attachmentData = {
                    type: data.type,
                    url: data.url,
                    name: data.original_name,
                    caption: content
                };
                finalContent = `[ATTACHMENT]${JSON.stringify(attachmentData)}`;
                clearAttachment();
            } catch (e) {
                alert('Failed to upload file');
                els.sendBtn.disabled = false;
                els.sendBtn.innerHTML = '<i class="fas fa-paper-plane" style="transform:translateX(1px);"></i>';
                return;
            }
            els.sendBtn.disabled = false;
            els.sendBtn.innerHTML = '<i class="fas fa-paper-plane" style="transform:translateX(1px);"></i>';
        }

        // Append a temporary copy of the message immediately so the
        // UI feels instant. The socket confirmation replaces it.
        if (state.currentConversationId) {
            els.messagesArea.querySelectorAll('.msg-status').forEach(el => el.remove());

            const tempMsg = { content: finalContent, created_at: new Date().toISOString(), is_own: true };
            const html = createMessageHTML(tempMsg, true, true);
            const wrap = document.createElement('div');
            wrap.innerHTML = html;
            // Tag the element for deduplication when the real event arrives.
            const msgEl = wrap.querySelector('.msg-row');
            if (msgEl) {
                msgEl.classList.add('temp-message');
                msgEl.style.opacity = '0.65';
                msgEl.dataset.content = finalContent;
            }
            while (wrap.firstChild) els.messagesArea.appendChild(wrap.firstChild);
            scrollToBottom();

            state.socket.emit('send_message', {
                conversation_id: state.currentConversationId,
                content: finalContent
            });
        } else if (state.pendingChatUser) {
            state.socket.emit('send_message', {
                recipient_id: state.pendingChatUser.id,
                content: finalContent
            });
        }

        els.msgInput.value = '';
        els.msgInput.style.height = 'auto';
        els.msgInput.focus();
    }

    function handleTyping() {
        if (!state.currentConversationId) return;
        state.socket.emit('typing', { conversation_id: state.currentConversationId });
    }

    // ==============================================================================
    // COMPOSE MODAL
    // Open/close handlers and user-search logic for the
    // 'New Message' overlay.
    // ==============================================================================
    function openComposeModal() {
        state.composeModalOpen = true;
        els.composeModal.style.display = 'flex';
        void els.composeModal.offsetWidth; // Force reflow so CSS transition fires correctly.
        els.composeModal.classList.add('visible');
        els.composeSearch.value = '';
        els.composeResults.innerHTML = `
      <div class="msg-empty" style="padding:32px 20px;">
        <div class="msg-empty-icon"><i class="fas fa-user-friends"></i></div>
        <p>Search to find people</p>
      </div>`;
        els.composeSearch.focus();
        document.body.style.overflow = 'hidden';
    }

    function closeComposeModal() {
        state.composeModalOpen = false;
        els.composeModal.classList.remove('visible');
        setTimeout(() => {
            els.composeModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 220);
    }

    function handleComposeSearch(e) {
        const query = e.target.value.trim();
        clearTimeout(state.searchDebounceTimer);
        if (query.length < 1) {
            els.composeResults.innerHTML = `
        <div class="msg-empty" style="padding:32px 20px;">
          <div class="msg-empty-icon"><i class="fas fa-user-friends"></i></div>
          <p>Search to find people</p>
        </div>`;
            return;
        }
        state.searchDebounceTimer = setTimeout(() => performUserSearch(query), 300);
    }

    async function performUserSearch(query) {
        const requestId = ++state.activeSearchRequestId;
        els.composeResults.innerHTML = `<div class="msg-spinner"><i class="fas fa-spinner fa-spin"></i></div>`;
        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            if (requestId !== state.activeSearchRequestId) return;
            if (!res.ok) throw new Error('Search failed');
            const users = await res.json();
            renderComposeResults(users);
        } catch (err) {
            if (requestId !== state.activeSearchRequestId) return;
            console.error(err);
            els.composeResults.innerHTML = `<div class="msg-empty"><p style="color:#ef4444;">Search failed</p></div>`;
        }
    }

    function renderComposeResults(users) {
        if (users.length === 0) {
            els.composeResults.innerHTML = `
        <div class="msg-empty">
          <div class="msg-empty-icon"><i class="fas fa-user-slash"></i></div>
          <p>No users found</p>
        </div>`;
            return;
        }
        els.composeResults.innerHTML = users.map(user => `
      <div class="compose-user-item" onclick="startConversation(${user.id})">
        <img src="${user.avatar}" alt="${escapeHtml(user.name)}" class="compose-user-avatar" loading="lazy">
        <span class="compose-user-name">${escapeHtml(user.name)}</span>
        <button class="compose-start-btn" title="Start conversation">
          <i class="fas fa-paper-plane" style="font-size:.7rem;transform:translateX(1px);"></i>
        </button>
      </div>`).join('');
    }

    window.startConversation = async function (userId) {
        const originalContent = els.composeResults.innerHTML;
        els.composeResults.innerHTML = `
      <div class="msg-empty" style="height:160px;">
        <div class="msg-spinner"><i class="fas fa-spinner fa-spin"></i></div>
        <p>Starting conversation…</p>
      </div>`;

        try {
            const res = await fetch('/api/chats/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_id: userId })
            });
            if (!res.ok) throw new Error('Failed to start chat');
            const data = await res.json();

            closeComposeModal();

            if (data.status === 'exists') {
                await loadConversations();
                const chatExists = state.conversations.find(c => c.conversation_id == data.conversation_id);
                if (chatExists) {
                    window.selectConversation(data.conversation_id);
                } else {
                    state.currentConversationId = data.conversation_id;
                    state.pendingChatUser = null;
                    els.headerName.textContent = data.partner_name;
                    els.headerAvatar.src = data.partner_avatar;
                    openChatPanel();
                    loadMessages(data.conversation_id);
                }
            } else {
                state.pendingChatUser = {
                    id: data.temp_user_id,
                    name: data.temp_user_name,
                    avatar: data.temp_user_avatar
                };
                state.currentConversationId = null;
                els.headerName.textContent = state.pendingChatUser.name;
                els.headerAvatar.src = state.pendingChatUser.avatar;
                els.messagesArea.innerHTML = `
          <div class="msg-empty">
            <div class="msg-empty-icon" style="font-size:2rem;">👋</div>
            <p>Start a new conversation with ${escapeHtml(state.pendingChatUser.name)}</p>
          </div>`;
                openChatPanel();
            }
        } catch (err) {
            console.error(err);
            els.composeResults.innerHTML = `
        <div class="msg-empty">
          <p style="color:#ef4444;">Failed to start conversation.</p>
          <button onclick="els.composeResults.innerHTML = originalContent"
            style="margin-top:8px;font-size:.8rem;color:#4f46e5;text-decoration:underline;border:none;background:none;cursor:pointer;">
            Try again
          </button>
        </div>`;
        }
    };

    // ==============================================================================
    // FILE HANDLING
    // Handles image and document selection for attachment.
    // Shows a preview strip above the input bar before sending.
    // ==============================================================================
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        state.selectedFile = file;
        els.previewArea.style.display = 'block';

        let previewHtml = '';
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            previewHtml = `
        <div style="position:relative;display:inline-block;">
          <img src="${url}" style="height:72px;width:auto;border-radius:10px;border:1.5px solid #e5e7eb;display:block;">
          <button onclick="window.clearAttachment()"
            style="position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;
                   background:#ef4444;color:white;border:2px solid white;
                   display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.65rem;
                   box-shadow:0 2px 6px rgb(239 68 68/.3);">
            <i class="fas fa-times"></i>
          </button>
        </div>`;
        } else {
            previewHtml = `
        <div style="display:inline-flex;align-items:center;gap:10px;background:white;
                    padding:10px 14px;border-radius:12px;border:1.5px solid #e5e7eb;">
          <i class="fas fa-file-pdf" style="color:#f87171;font-size:1.1rem;"></i>
          <span style="font-size:.82rem;color:#374151;font-family:Inter,sans-serif;
                       overflow:hidden;text-overflow:ellipsis;max-width:160px;white-space:nowrap;">
            ${file.name}
          </span>
          <button onclick="window.clearAttachment()"
            style="color:#9ca3af;background:none;border:none;cursor:pointer;font-size:.8rem;
                   padding:2px;transition:color .15s ease;"
            onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#9ca3af'">
            <i class="fas fa-times"></i>
          </button>
        </div>`;
        }
        els.previewArea.innerHTML = previewHtml;
    }

    window.clearAttachment = function () {
        state.selectedFile = null;
        els.fileInput.value = '';
        els.previewArea.innerHTML = '';
        els.previewArea.style.display = 'none';
    };

    // ==============================================================================
    // TYPING INDICATOR
    // Reveals animated dots when the socket reports the partner
    // is typing. Auto-hides after 3 seconds of silence.
    // ==============================================================================
    function showTypingIndicator() {
        const chat = state.conversations.find(c => c.conversation_id == state.currentConversationId);
        const nameEl = document.getElementById('typing-name');
        if (nameEl && chat) nameEl.textContent = chat.partner_name;
        els.typingIndicator.style.display = 'flex';
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            els.typingIndicator.style.display = 'none';
        }, 3000);
    }

    function showSidebarMobile() {
        closeChatPanelMobile();
    }

    // ==============================================================================
    // LIST SEARCH
    // Client-side filter on the loaded conversation list.
    // No additional API call needed; filters by partner name.
    // ==============================================================================
    function handleSearch(e) {
        const term = e.target.value.toLowerCase();
        const filtered = state.conversations.filter(c =>
            c.partner_name.toLowerCase().includes(term)
        );
        renderConversations(filtered);
    }

    // ==============================================================================
    // CONVERSATION LIST UPDATES
    // Keeps the sidebar preview in sync when a socket message
    // arrives, without re-fetching the full list from the API.
    // ==============================================================================
    function updateConversationListPreview(msg) {
        const chatIndex = state.conversations.findIndex(c => c.conversation_id == msg.conversation_id);
        if (chatIndex > -1) {
            const chat = state.conversations[chatIndex];
            let content = msg.content;
            if (content.startsWith('[ATTACHMENT]')) {
                try {
                    const data = JSON.parse(content.substring(12));
                    content = data.caption || (data.type === 'image' ? 'Sent a photo 📷' : 'Sent a document 📎');
                } catch (e) { content = 'Sent an attachment'; }
            } else if (content.startsWith('[POST_SHARE]')) {
                try {
                    const data = JSON.parse(content.substring(12));
                    content = `Shared a post by ${data.authorName || 'someone'}`;
                } catch (e) { content = 'Shared a post'; }
            }
            chat.last_message = content;
            chat.last_message_at = msg.created_at;
            chat.last_msg_is_own = (msg.sender_id == state.currentUser.id);
            chat.last_msg_is_read = false;
            if (state.currentConversationId != msg.conversation_id) {
                chat.unread_count = (chat.unread_count || 0) + 1;
            }
            state.conversations.splice(chatIndex, 1);
            state.conversations.unshift(chat);
            renderConversations(state.conversations);
        } else {
            loadConversations();
        }
    }

    function updateUnreadCount(convId, count, reset = false) {
        const chat = state.conversations.find(c => c.conversation_id == convId);
        if (chat) {
            chat.unread_count = reset ? 0 : (chat.unread_count || 0) + count;
            renderConversations(state.conversations);
        }
    }

    // ==============================================================================
    // UTILS
    // Small helper functions used throughout this module.
    // ==============================================================================
    function scrollToBottom() {
        els.messagesArea.scrollTop = els.messagesArea.scrollHeight;
    }

    function formatTimeShort(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString();
    }

    function formatDateDivider(isoString) {
        const date = new Date(isoString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    }

    function handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ========================= START ==========================
    init();

}); // End DOMContentLoaded
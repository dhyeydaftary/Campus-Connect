document.addEventListener('DOMContentLoaded', function () {
    // --- State Management ---
    const state = {
        conversations: [],
        currentConversationId: null,
        currentUser: null,
        socket: null,
        lastRequestId: 0,
        composeModalOpen: false,
        searchDebounceTimer: null,
        activeSearchRequestId: 0,
        pendingChatUser: null, // { id, name, avatar }
        typingTimeout: null,
        selectedFile: null
    };

    // DOM Elements
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
        previewArea: document.getElementById('attachment-preview')
    };

    // --- Initialization ---
    function init() {
        state.currentUser = { id: document.body.dataset.userId };
        // Initialize Socket.IO
        state.socket = io();
        setupSocketListeners();

        // Load initial data
        loadConversations();

        // Event Listeners
        if (els.searchInput) els.searchInput.addEventListener('input', handleSearch);
        if (els.sendBtn) els.sendBtn.addEventListener('click', sendMessage);
        if (els.backBtn) els.backBtn.addEventListener('click', showSidebarMobile);
        
        if (els.msgInput) {
            els.msgInput.addEventListener('keydown', handleInputKeydown);
            els.msgInput.addEventListener('input', function() {
                handleTyping();
                // Auto-resize
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        }

        // Compose Modal Listeners
        if (els.composeBtn) els.composeBtn.addEventListener('click', openComposeModal);
        if (els.closeComposeBtn) els.closeComposeBtn.addEventListener('click', closeComposeModal);
        if (els.composeModal) els.composeModal.addEventListener('click', (e) => {
            if (e.target === els.composeModal) closeComposeModal();
        });
        if (els.composeSearch) els.composeSearch.addEventListener('input', handleComposeSearch);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.composeModalOpen) closeComposeModal(); });

        // File Attachment
        if (els.attachBtn) els.attachBtn.addEventListener('click', () => els.fileInput.click());
        if (els.fileInput) els.fileInput.addEventListener('change', handleFileSelect);

        // Check for conversation ID in URL (Auto-open)
        const urlParams = new URLSearchParams(window.location.search);
        const autoConvId = urlParams.get('conversation');
        if (autoConvId) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        // Pass autoConvId to loadConversations
        loadConversations(autoConvId);
    }

    // --- Socket.IO Handling ---
    function setupSocketListeners() {
        state.socket.on('connect', () => {
            console.log('Connected to chat server');
        });

        state.socket.on('new_message', (msg) => {
            if (state.currentConversationId == msg.conversation_id) {
                // Remove optimistic message if it exists (simple dedup by content/time could be added here)
                // For MVP, we just append. If we implemented optimistic UI fully, we'd replace.
                // To avoid duplicates if optimistic UI is used, we can check if the last message 
                // has the same content and is 'sending'.
                // For this task, we will just append as requested in "OPTIONAL OPTIMISTIC UI" section 
                // but we need to be careful not to duplicate if we already appended it.
                appendMessage(msg);
                scrollToBottom();
                if (msg.sender_id != state.currentUser.id) {
                    markAsRead(msg.conversation_id);
                }
            } else {
                updateUnreadCount(msg.conversation_id, 1);
                if (window.NavbarUtils && window.NavbarUtils.updateMessageBadge) {
                    window.NavbarUtils.updateMessageBadge();
                }
            }
            updateConversationListPreview(msg);
        });

        state.socket.on('user_typing', (data) => {
            if (state.currentConversationId == data.conversation_id) {
                showTypingIndicator();
            }
        });

        state.socket.on('messages_read', (data) => {
            if (data.read_by == state.currentUser.id) return;

            // Update chat window if active
            if (state.currentConversationId == data.conversation_id) {
                const sentMessages = els.messagesArea.querySelectorAll('.message-sent .status-icon');
                sentMessages.forEach(el => {
                    el.innerHTML = '<span class="text-sm text-gray-500">seen</span>';
                });
            }
            // Update conversation list
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

    // --- API Calls ---
    async function loadConversations(autoSelectId = null) {
        try {
            const res = await fetch('/api/chats');
            if (!res.ok) throw new Error('Failed to load chats');
            state.conversations = await res.json();
            renderConversations(state.conversations);
            
            if (autoSelectId) {
                const chat = state.conversations.find(c => c.conversation_id == autoSelectId);
                if (chat) {
                    window.selectConversation(autoSelectId);
                } else {
                    // Chat exists but not in list (likely empty). Fetch details manually.
                    fetch(`/api/chats/${autoSelectId}`)
                        .then(res => {
                            if (!res.ok) throw new Error('Chat not found');
                            return res.json();
                        })
                        .then(data => {
                            // Manually setup chat UI
                            state.currentConversationId = data.conversation_id;
                            state.pendingChatUser = null;
                            
                            els.headerName.textContent = data.partner_name;
                            els.headerAvatar.src = data.partner_avatar;
                            
                            els.sidebar.classList.add('hidden', 'md:flex');
                            els.chatPanel.classList.remove('hidden');
                            els.chatPanel.classList.add('flex');
                            
                            els.emptyState.classList.add('hidden');
                            els.activeChatContainer.classList.remove('hidden');
                            els.activeChatContainer.classList.add('flex');
                            
                            // Deselect list items
                            document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('bg-indigo-50', 'border-l-indigo-600'));
                            
                            loadMessages(data.conversation_id);
                        })
                        .catch(err => console.error('Failed to auto-open chat:', err));
                }
            }
        } catch (err) {
            console.error(err);
            els.convList.innerHTML = `<div class="p-4 text-center text-red-500">Failed to load conversations</div>`;
        }
    }

    async function loadMessages(conversationId) {
        // Race condition handling
        const requestId = ++state.lastRequestId;
        
        try {
            els.messagesArea.innerHTML = `<div class="flex justify-center p-4"><i class="fas fa-spinner fa-spin text-indigo-500"></i></div>`;
            
            // Room cleanup: Leave previous room if exists
            if (state.currentConversationId && state.currentConversationId !== conversationId) {
                state.socket.emit('leave_chat', { conversation_id: state.currentConversationId });
            }
            
            const res = await fetch(`/api/messages/${conversationId}`);
            if (!res.ok) throw new Error('Failed to load messages');
            
            const messages = await res.json();
            
            // Only render if this is still the latest request
            if (requestId !== state.lastRequestId) return;
            
            const firstUnreadId = renderMessages(messages);
            
            if (firstUnreadId) {
                const el = document.getElementById(firstUnreadId);
                if (el) el.scrollIntoView({ block: 'center', behavior: 'auto' });
                else scrollToBottom();
            } else {
                scrollToBottom();
            }
            
            // Join new socket room
            state.socket.emit('join_chat', { conversation_id: conversationId });
            
            // Mark as read
            markAsRead(conversationId);

        } catch (err) {
            console.error(err);
            els.messagesArea.innerHTML = `<div class="p-4 text-center text-red-500">Failed to load messages</div>`;
        }
    }

    async function markAsRead(conversationId) {
        try {
            await fetch(`/api/messages/${conversationId}/mark-read`, { method: 'POST' });
            state.socket.emit('mark_read', { conversation_id: conversationId });
            updateUnreadCount(conversationId, 0, true); // Reset count locally
            if (window.NavbarUtils && window.NavbarUtils.updateMessageBadge) {
                window.NavbarUtils.updateMessageBadge();
            }
        } catch (err) {
            console.error('Failed to mark read', err);
        }
    }

    // --- Rendering ---
    function renderConversations(conversations) {
        if (conversations.length === 0) {
            els.convList.innerHTML = `<div class="p-8 text-center text-gray-500">No conversations yet</div>`;
            return;
        }

        els.convList.innerHTML = conversations.map(chat => {
            const isOwn = chat.last_msg_is_own;
            const isRead = chat.last_msg_is_read;
            const statusIcon = isOwn 
                ? (isRead ? '<span class="text-sm text-blue-500">seen</span>' : '<span class="text-sm text-gray-400">sent</span>') 
                : '';

            return `
            <div class="conversation-item flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition border-b border-gray-50 ${state.currentConversationId == chat.conversation_id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}"
                onclick="window.selectConversation(${chat.conversation_id})"
                data-id="${chat.conversation_id}">
                
                <div class="relative shrink-0">
                    <img src="${chat.partner_avatar}" class="w-12 h-12 rounded-full object-cover border border-gray-200">
                    ${chat.unread_count > 0 ? '<span class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>' : ''}
                </div>
                
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline mb-1">
                        <h4 class="font-semibold text-gray-900 truncate">${chat.partner_name}</h4>
                        <span class="text-xs text-gray-400 shrink-0">${formatTimeShort(chat.last_message_at)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <p class="text-sm text-gray-500 truncate last-msg-preview ${chat.unread_count > 0 ? 'font-semibold text-gray-800' : ''}">
                            ${chat.last_message || 'Start a conversation'}
                        </p>
                        <div class="flex items-center gap-2 ml-2 shrink-0">
                            ${statusIcon}
                            ${chat.unread_count > 0 ? `<span class="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.25rem] text-center">${chat.unread_count}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');
    }

    function renderMessages(messages) {
        if (messages.length === 0) {
            els.messagesArea.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm">No messages yet. Say hello! 👋</div>`;
            return null;
        }

        let lastDate = null;
        let html = '';
        let firstUnreadId = null;
        
        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.created_at).toLocaleDateString();
            
            if (msgDate !== lastDate) {
                html += `
                    <div class="flex justify-center my-4">
                        <div class="px-3 py-1 text-xs bg-gray-200 rounded-full text-gray-600">
                            ${formatDateDivider(msg.created_at)}
                        </div>
                    </div>
                `;
                lastDate = msgDate;
            }
            
            let msgHtml = createMessageHTML(msg, msg.is_own, index === messages.length - 1);
            
            if (!firstUnreadId && !msg.is_own && !msg.is_read) {
                firstUnreadId = `msg-${msg.id}`;
                msgHtml = msgHtml.replace('<div', `<div id="${firstUnreadId}"`);
            }
            
            html += msgHtml;
        });

        els.messagesArea.innerHTML = html;
        return firstUnreadId;
    }

    function createMessageHTML(msg, isSent, isLast = false) {
        let content = msg.content;
        let attachmentHtml = '';

        // Check for attachment prefix
        if (content.startsWith('[ATTACHMENT]')) {
            try {
                const jsonStr = content.substring(12); // Remove prefix
                const data = JSON.parse(jsonStr);
                content = data.caption || ''; // Show caption as text
                
                if (data.type === 'image') {
                    attachmentHtml = `
                        <div class="mb-2 rounded-lg overflow-hidden">
                            <img src="${data.url}" alt="Image" class="max-w-full max-h-64 object-cover cursor-pointer" onclick="window.open('${data.url}', '_blank')">
                        </div>`;
                } else {
                    attachmentHtml = `
                        <div class="mb-2 p-3 bg-gray-100/20 rounded-lg border border-white/20 flex items-center gap-3">
                            <i class="fas fa-file-pdf text-red-400 text-xl"></i>
                            <a href="${data.url}" target="_blank" class="text-sm underline truncate max-w-[150px]">${data.name}</a>
                        </div>`;
                }
            } catch (e) { console.error('Error parsing attachment', e); }
        }

        // Check for post share prefix
        if (content.startsWith('[POST_SHARE]')) {
            try {
                const jsonStr = content.substring(12);
                const data = JSON.parse(jsonStr);
                content = ''; // Clear text content as we render a card
                
                attachmentHtml = `
                    <div class="bg-white rounded-lg p-3 shadow-sm border-l-4 border-indigo-500 text-left cursor-pointer hover:bg-gray-50 transition min-w-[200px]" onclick="window.location.href='/post/${data.postId}'">
                        <div class="mb-1">
                            <span class="text-xs font-bold text-gray-800 block truncate">${escapeHtml(data.authorName)}</span>
                        </div>
                        <p class="text-xs text-gray-600 line-clamp-2 mb-2 leading-snug">${escapeHtml(data.caption || 'Shared a post')}</p>
                        <div class="flex items-center text-indigo-600">
                            <i class="fas fa-link text-[10px] mr-1"></i>
                            <span class="text-[10px] font-bold uppercase tracking-wide">View Post</span>
                        </div>
                    </div>
                `;
            } catch (e) { console.error('Error parsing post share', e); }
        }

        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (isSent) {
            const status = msg.is_read 
                ? '<span class="text-sm text-gray-500">seen</span>' 
                : '<span class="text-sm text-gray-400">sent</span>';
            
            const statusHtml = isLast ? `<div class="status-icon text-right mt-1 mr-1">${status}</div>` : '';

            return `
                <div class="flex flex-col items-end group message-sent">
                    <div class="max-w-[75%] bg-indigo-600 text-white rounded-2xl rounded-tr-none px-4 py-2 shadow-sm relative">
                        ${attachmentHtml}
                        ${content ? `<p class="text-sm leading-relaxed">${escapeHtml(content)}</p>` : ''}
                        <div class="flex items-center justify-end gap-1 mt-1 space-x-0.5">
                            <span class="text-[10px] text-indigo-200">${time}</span>
                        </div>
                    </div>
                    ${statusHtml}
                </div>
            `;
        } else {
            return `
                <div class="flex justify-start group">
                    <div class="max-w-[75%] bg-white text-gray-800 rounded-2xl rounded-tl-none px-4 py-2 shadow-sm border border-gray-100">
                        ${attachmentHtml}
                        ${content ? `<p class="text-sm leading-relaxed">${escapeHtml(content)}</p>` : ''}
                        <div class="mt-1">
                            <span class="text-[10px] text-gray-400">${time}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    function appendMessage(msg) {
        // Determine if message is sent by current user based on state or payload
        // For incoming socket messages, we check if sender_id matches current user (unlikely for 'new_message' unless multi-tab)
        // But typically 'new_message' is broadcast. 
        // We can infer is_own if we had current user ID. 
        // For now, we assume if it came via socket and we didn't send it (handled in sendMessage), it's incoming.
        // However, to be safe, let's rely on the fact that sendMessage adds it optimistically or we reload.
        // Actually, best practice: append incoming, ignore own if already added.
        // Simplified: Just append.
        
        // Check if we already have this message (dedup)
        // ... skip for simplicity
        
        // Simple dedup for optimistic UI: remove temporary message if real one arrives
        const tempMsg = Array.from(els.messagesArea.querySelectorAll('.temp-message')).find(el => el.dataset.content === msg.content);
        if (tempMsg) {
            tempMsg.remove();
        }
        
        // Remove status from previous messages
        els.messagesArea.querySelectorAll('.status-icon').forEach(el => el.remove());

        const isSent = msg.sender_id == document.body.dataset.userId;
        const html = createMessageHTML(msg, isSent, true);
        els.messagesArea.insertAdjacentHTML('beforeend', html);
    }

    // --- Actions ---
    window.selectConversation = function(id) {
        state.currentConversationId = id;
        state.pendingChatUser = null; // Clear pending if selecting existing
        
        const chat = state.conversations.find(c => c.conversation_id == id);
        
        if (!chat) return;

        // Update UI
        els.headerName.textContent = chat.partner_name;
        els.headerAvatar.src = chat.partner_avatar;
        
        // Toggle Views (Mobile)
        els.sidebar.classList.add('hidden', 'md:flex');
        els.chatPanel.classList.remove('hidden');
        els.chatPanel.classList.add('flex');
        
        // Show Chat Container
        els.emptyState.classList.add('hidden');
        els.activeChatContainer.classList.remove('hidden');
        els.activeChatContainer.classList.add('flex');

        // Highlight active item
        renderConversations(state.conversations); // Re-render to update highlights

        loadMessages(id);
    };

    async function sendMessage() {
        const content = els.msgInput.value.trim();
        const file = state.selectedFile;

        if ((!content && !file) || (!state.currentConversationId && !state.pendingChatUser)) return;

        let finalContent = content;
        
        // Handle File Upload
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            
            // Show uploading state (simple blocking for MVP)
            els.sendBtn.disabled = true;
            els.sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            try {
                const res = await fetch('/api/chat/upload', { method: 'POST', body: formData });
                if (!res.ok) throw new Error('Upload failed');
                const data = await res.json();
                
                // Construct attachment payload
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
                els.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                return;
            }
            els.sendBtn.disabled = false;
            els.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }

        // Optimistic UI: Append temporary message
        const tempMsg = {
            content: finalContent,
            created_at: new Date().toISOString(),
            is_own: true // It's our message
        };
        
        // Only append optimistically if we have a conversation ID (simplifies logic)
        if (state.currentConversationId) {
            // Remove status from previous messages
            els.messagesArea.querySelectorAll('.status-icon').forEach(el => el.remove());

            const html = createMessageHTML(tempMsg, true, true);
            
            // Inject data-content for dedup and temp classes
            // We use a temporary DOM element to safely set attributes
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = html;
            const msgEl = tempContainer.firstElementChild;
            msgEl.classList.add('temp-message', 'opacity-70');
            msgEl.setAttribute('data-content', finalContent);
            
            els.messagesArea.appendChild(msgEl);
            scrollToBottom();

            state.socket.emit('send_message', {
                conversation_id: state.currentConversationId,
                content: finalContent
            });
        } else if (state.pendingChatUser) {
            // Create conversation on first message
            state.socket.emit('send_message', {
                recipient_id: state.pendingChatUser.id,
                content: finalContent
            });
            // We don't have conversation_id yet, so we wait for 'new_message' event
            // which will contain the new conversation_id.
            // However, to properly switch state, we might need to handle the response.
            // For now, the socket event 'new_message' will trigger updates.
        }

        els.msgInput.value = '';
        els.msgInput.style.height = 'auto';
        els.msgInput.focus();
    }

    function handleTyping() {
        if (!state.currentConversationId) return;
        state.socket.emit('typing', { conversation_id: state.currentConversationId });
    }

    // --- Compose Modal Logic ---

    function openComposeModal() {
        state.composeModalOpen = true;
        els.composeModal.classList.remove('hidden');
        els.composeModal.classList.add('flex'); // Ensure flex is added for centering
        // Trigger reflow for transition
        void els.composeModal.offsetWidth;
        els.composeModal.classList.remove('opacity-0');
        els.composeModal.querySelector('div').classList.remove('scale-95');
        els.composeModal.querySelector('div').classList.add('scale-100');
        
        els.composeSearch.value = '';
        els.composeResults.innerHTML = '<div class="text-center text-gray-400 mt-8 text-sm">Type to search for people</div>';
        els.composeSearch.focus();
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    function closeComposeModal() {
        state.composeModalOpen = false;
        els.composeModal.classList.add('opacity-0');
        els.composeModal.querySelector('div').classList.remove('scale-100');
        els.composeModal.querySelector('div').classList.add('scale-95');
        
        setTimeout(() => {
            els.composeModal.classList.add('hidden');
            els.composeModal.classList.remove('flex');
            document.body.style.overflow = '';
        }, 200);
    }

    function handleComposeSearch(e) {
        const query = e.target.value.trim();
        clearTimeout(state.searchDebounceTimer);

        if (query.length < 1) {
            els.composeResults.innerHTML = '<div class="text-center text-gray-400 mt-8 text-sm">Type to search for people</div>';
            return;
        }

        state.searchDebounceTimer = setTimeout(() => performUserSearch(query), 300);
    }

    async function performUserSearch(query) {
        const requestId = ++state.activeSearchRequestId;
        els.composeResults.innerHTML = '<div class="flex justify-center p-4"><i class="fas fa-spinner fa-spin text-indigo-500"></i></div>';

        try {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
            if (requestId !== state.activeSearchRequestId) return; // Stale request

            if (!res.ok) throw new Error('Search failed');
            const users = await res.json();

            renderComposeResults(users);
        } catch (err) {
            if (requestId !== state.activeSearchRequestId) return;
            console.error(err);
            els.composeResults.innerHTML = '<div class="text-center text-red-500 mt-4 text-sm">Failed to search users</div>';
        }
    }

    function renderComposeResults(users) {
        if (users.length === 0) {
            els.composeResults.innerHTML = '<div class="text-center text-gray-500 mt-8 text-sm">No users found</div>';
            return;
        }

        els.composeResults.innerHTML = users.map(user => `
            <div class="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
                onclick="startConversation(${user.id})">
                <img src="${user.avatar}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-900 truncate">${escapeHtml(user.name)}</div>
                </div>
                <button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `).join('');
    }

    // Expose to window for onclick handler in HTML string
    window.startConversation = async function(userId) {
        // Show loading state in modal
        const originalContent = els.composeResults.innerHTML;
        els.composeResults.innerHTML = '<div class="flex flex-col items-center justify-center h-40 gap-3"><i class="fas fa-spinner fa-spin text-indigo-500 text-2xl"></i><span class="text-sm text-gray-500">Starting conversation...</span></div>';
        
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
                // Existing conversation
                await loadConversations();
                
                // Check if conversation is in the list (it might be hidden if empty)
                const chatExists = state.conversations.find(c => c.conversation_id == data.conversation_id);
                
                if (chatExists) {
                    window.selectConversation(data.conversation_id);
                } else {
                    // It exists but hidden (empty), so set up UI manually
                    state.currentConversationId = data.conversation_id;
                    state.pendingChatUser = null;
                    
                    els.headerName.textContent = data.partner_name;
                    els.headerAvatar.src = data.partner_avatar;
                    
                    // Toggle Views (Mobile)
                    els.sidebar.classList.add('hidden', 'md:flex');
                    els.chatPanel.classList.remove('hidden');
                    els.chatPanel.classList.add('flex');
                    
                    // Show Chat Container
                    els.emptyState.classList.add('hidden');
                    els.activeChatContainer.classList.remove('hidden');
                    els.activeChatContainer.classList.add('flex');
                    
                    loadMessages(data.conversation_id);
                }
            } else {
                // New pending conversation
                state.pendingChatUser = {
                    id: data.temp_user_id,
                    name: data.temp_user_name,
                    avatar: data.temp_user_avatar
                };
                state.currentConversationId = null;
                
                // Setup UI for new chat
                els.headerName.textContent = state.pendingChatUser.name;
                els.headerAvatar.src = state.pendingChatUser.avatar;
                
                els.messagesArea.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm">Start a new conversation with ${escapeHtml(state.pendingChatUser.name)}</div>`;
                
                // Toggle Views (Mobile)
                els.sidebar.classList.add('hidden', 'md:flex');
                els.chatPanel.classList.remove('hidden');
                els.chatPanel.classList.add('flex');
                
                // Show Chat Container
                els.emptyState.classList.add('hidden');
                els.activeChatContainer.classList.remove('hidden');
                els.activeChatContainer.classList.add('flex');
            }
            
        } catch (err) {
            console.error(err);
            els.composeResults.innerHTML = `<div class="text-center text-red-500 p-4">Failed to start conversation. <button onclick="this.parentElement.parentElement.innerHTML = '${escapeHtml(originalContent)}'" class="underline">Try again</button></div>`;
        }
    };

    // --- File Handling ---
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        state.selectedFile = file;
        els.previewArea.classList.remove('hidden');
        
        let previewHtml = '';
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            previewHtml = `<div class="relative inline-block"><img src="${url}" class="h-20 w-auto rounded-lg border border-gray-200"><button onclick="window.clearAttachment()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm"><i class="fas fa-times"></i></button></div>`;
        } else {
            previewHtml = `<div class="relative inline-flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200"><i class="fas fa-file-pdf text-red-500"></i> <span class="text-sm truncate max-w-[150px]">${file.name}</span><button onclick="window.clearAttachment()" class="ml-2 text-gray-400 hover:text-red-500"><i class="fas fa-times"></i></button></div>`;
        }
        
        els.previewArea.innerHTML = previewHtml;
    }

    // Expose to window for onclick in preview HTML
    window.clearAttachment = function() {
        state.selectedFile = null;
        els.fileInput.value = '';
        els.previewArea.innerHTML = '';
        els.previewArea.classList.add('hidden');
    };

    function showTypingIndicator() {
        els.typingIndicator.classList.remove('hidden');
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            els.typingIndicator.classList.add('hidden');
        }, 3000);
    }

    function showSidebarMobile() {
        els.sidebar.classList.remove('hidden');
        els.chatPanel.classList.add('hidden');
        els.chatPanel.classList.remove('flex');
        state.currentConversationId = null;
    }

    // --- Helpers ---
    function handleSearch(e) {
        const term = e.target.value.toLowerCase();
        const filtered = state.conversations.filter(c => 
            c.partner_name.toLowerCase().includes(term)
        );
        renderConversations(filtered);
    }

    function updateConversationListPreview(msg) {
        const chatIndex = state.conversations.findIndex(c => c.conversation_id == msg.conversation_id);
        if (chatIndex > -1) {
            const chat = state.conversations[chatIndex];
            
            // Parse content for preview
            let content = msg.content;
            if (content.startsWith('[ATTACHMENT]')) {
                try {
                    const data = JSON.parse(content.substring(12));
                    content = data.caption || (data.type === 'image' ? 'Sent a photo' : 'Sent a document');
                } catch (e) {
                    content = 'Sent an attachment';
                }
            } else if (content.startsWith('[POST_SHARE]')) {
                try {
                    const data = JSON.parse(content.substring(12));
                    const author = data.authorName || 'someone';
                    content = `Shared a post by ${author}`;
                } catch (e) {
                    content = 'Shared a post';
                }
            }
            
            chat.last_message = content;
            chat.last_message_at = msg.created_at;
            
            // Determine ownership based on sender_id if available, or infer
            chat.last_msg_is_own = (msg.sender_id == state.currentUser.id);
            chat.last_msg_is_read = false; // New message is initially unread

            if (state.currentConversationId != msg.conversation_id) {
                chat.unread_count = (chat.unread_count || 0) + 1;
            }
            
            // Move to top
            state.conversations.splice(chatIndex, 1);
            state.conversations.unshift(chat);
            renderConversations(state.conversations);
        } else {
            // New conversation started (or became active), reload list to show it
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
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Start
    init();
});
"""
═══════════════════════════════════════════════════════════════════════════
CHAT WEBSOCKET HANDLERS
Campus Connect - Real-time messaging via Flask-SocketIO
═══════════════════════════════════════════════════════════════════════════

SOCKET EVENTS:
- join_chat          - User joins a conversation room
- leave_chat         - User leaves a conversation room
- send_message       - Send a new message
- mark_read          - Mark messages as read
- typing             - User is typing indicator

SECURITY:
- All events validate session user
- Room access validated before joining
- Messages validated before saving
"""

from flask_socketio import emit, join_room, leave_room, SocketIO
from flask import session, request
from models import db, User, Conversation, Message
from datetime import datetime, timezone

# SocketIO instance will be initialized in app.py
# This file only defines the event handlers

def init_socket_events(socketio):
    """
    Initialize all socket event handlers.
    Call this function from app.py after creating socketio instance.
    """
    
    # ═══════════════════════════════════════════════════════════════════════
    # HELPER: Get authenticated user from session
    # ═══════════════════════════════════════════════════════════════════════
    
    def get_socket_user_id():
        """Get user ID from session or return None"""
        return session.get("user_id")
    
    
    # ═══════════════════════════════════════════════════════════════════════
    # EVENT: join_chat
    # Purpose: User joins a conversation room for real-time updates
    # ═══════════════════════════════════════════════════════════════════════
    
    @socketio.on('join_chat')
    def handle_join_chat(data):
        """
        User joins a conversation room.
        
        Expected data:
        {
            "conversation_id": 1
        }
        
        Emits: join_success or error
        """
        user_id = get_socket_user_id()
        if not user_id:
            emit('error', {'message': 'Unauthorized'})
            return
        
        try:
            conversation_id = data.get('conversation_id')
            
            if not conversation_id:
                emit('error', {'message': 'conversation_id is required'})
                return
            
            # Validate conversation exists
            conversation = Conversation.query.get(conversation_id)
            
            if not conversation:
                emit('error', {'message': 'Conversation not found'})
                return
            
            # Security check: User must be part of this conversation
            if user_id not in [conversation.user1_id, conversation.user2_id]:
                emit('error', {'message': 'Access denied'})
                return
            
            # Join the room
            room_name = f"chat_{conversation_id}"
            join_room(room_name)
            
            # Mark all messages as read when joining
            Message.mark_conversation_as_read(conversation_id, user_id)
            
            # Notify success
            emit('join_success', {
                'conversation_id': conversation_id,
                'room': room_name
            })
            
            # Notify other user that this user joined (online status)
            other_user_id = conversation.get_other_user_id(user_id)
            emit('user_joined', {
                'user_id': user_id,
                'conversation_id': conversation_id
            }, room=room_name, include_self=False)
            
        except Exception as e:
            print(f"Error joining chat: {e}")
            emit('error', {'message': 'Failed to join chat'})
    
    
    # ═══════════════════════════════════════════════════════════════════════
    # EVENT: leave_chat
    # Purpose: User leaves a conversation room
    # ═══════════════════════════════════════════════════════════════════════
    
    @socketio.on('leave_chat')
    def handle_leave_chat(data):
        """
        User leaves a conversation room.
        
        Expected data:
        {
            "conversation_id": 1
        }
        """
        user_id = get_socket_user_id()
        if not user_id:
            return
        
        try:
            conversation_id = data.get('conversation_id')
            if not conversation_id:
                return
            
            room_name = f"chat_{conversation_id}"
            leave_room(room_name)
            
            # Notify other user
            emit('user_left', {
                'user_id': user_id,
                'conversation_id': conversation_id
            }, room=room_name)
            
        except Exception as e:
            print(f"Error leaving chat: {e}")
    
    
    # ═══════════════════════════════════════════════════════════════════════
    # EVENT: send_message
    # Purpose: Send a new message in real-time
    # ═══════════════════════════════════════════════════════════════════════
    
    @socketio.on('send_message')
    def handle_send_message(data):
        """
        Send a new message.
        
        Expected data:
        {
            "conversation_id": 1,
            "content": "Hello!"
        }
        
        Emits: new_message to all users in the room
        """
        user_id = get_socket_user_id()
        if not user_id:
            emit('error', {'message': 'Unauthorized'})
            return
        
        try:
            conversation_id = data.get('conversation_id')
            content = data.get('content', '').strip()
            
            # Validation
            if not conversation_id:
                emit('error', {'message': 'conversation_id is required'})
                return
            
            if not content:
                emit('error', {'message': 'Message content cannot be empty'})
                return
            
            if len(content) > 5000:
                emit('error', {'message': 'Message too long (max 5000 characters)'})
                return
            
            # Validate conversation
            conversation = Conversation.query.get(conversation_id)
            
            if not conversation:
                emit('error', {'message': 'Conversation not found'})
                return
            
            # Security check
            if user_id not in [conversation.user1_id, conversation.user2_id]:
                emit('error', {'message': 'Access denied'})
                return
            
            # Get receiver ID
            receiver_id = conversation.get_other_user_id(user_id)
            
            # Create message
            message = Message(
                conversation_id=conversation_id,
                sender_id=user_id,
                receiver_id=receiver_id,
                content=content
            )
            
            db.session.add(message)
            
            # Update conversation timestamp (will be done by trigger, but set here too)
            conversation.updated_at = datetime.now(timezone.utc)
            
            db.session.commit()
            
            # Get sender info
            sender = User.query.get(user_id)
            
            # Prepare message data
            message_data = message.to_dict()
            
            # Emit to all users in the room (including sender for confirmation)
            room_name = f"chat_{conversation_id}"
            emit('new_message', message_data, room=room_name)
            
            # Send notification to receiver if they're not in the room
            # This would require tracking active rooms per user
            # For now, frontend can poll unread count
            
        except Exception as e:
            print(f"Error sending message: {e}")
            db.session.rollback()
            emit('error', {'message': 'Failed to send message'})
    
    
    # ═══════════════════════════════════════════════════════════════════════
    # EVENT: mark_read
    # Purpose: Mark messages as read and send read receipt
    # ═══════════════════════════════════════════════════════════════════════
    
    @socketio.on('mark_read')
    def handle_mark_read(data):
        """
        Mark messages as read.
        
        Expected data:
        {
            "conversation_id": 1,
            "message_ids": [1, 2, 3]  # Optional: specific messages, or all if not provided
        }
        
        Emits: messages_read to sender
        """
        user_id = get_socket_user_id()
        if not user_id:
            return
        
        try:
            conversation_id = data.get('conversation_id')
            message_ids = data.get('message_ids', [])
            
            if not conversation_id:
                return
            
            # Validate access
            conversation = Conversation.query.get(conversation_id)
            if not conversation or user_id not in [conversation.user1_id, conversation.user2_id]:
                return
            
            # Mark specific messages or all
            if message_ids:
                messages = Message.query.filter(
                    Message.id.in_(message_ids),
                    Message.conversation_id == conversation_id,
                    Message.receiver_id == user_id,
                    Message.is_read == False
                ).all()
            else:
                messages = Message.query.filter_by(
                    conversation_id=conversation_id,
                    receiver_id=user_id,
                    is_read=False
                ).all()
            
            # Mark as read
            now = datetime.now(timezone.utc)
            marked_ids = []
            
            for message in messages:
                message.is_read = True
                message.read_at = now
                marked_ids.append(message.id)
            
            if messages:
                db.session.commit()
            
            # Emit read receipt to room
            if marked_ids:
                room_name = f"chat_{conversation_id}"
                emit('messages_read', {
                    'conversation_id': conversation_id,
                    'message_ids': marked_ids,
                    'read_by': user_id,
                    'read_at': now.isoformat()
                }, room=room_name)
            
        except Exception as e:
            print(f"Error marking messages as read: {e}")
            db.session.rollback()
    
    
    # ═══════════════════════════════════════════════════════════════════════
    # EVENT: typing
    # Purpose: Show typing indicator to other user
    # ═══════════════════════════════════════════════════════════════════════
    
    @socketio.on('typing')
    def handle_typing(data):
        """
        User is typing indicator.
        
        Expected data:
        {
            "conversation_id": 1,
            "is_typing": true
        }
        
        Emits: user_typing to other user
        """
        user_id = get_socket_user_id()
        if not user_id:
            return
        
        try:
            conversation_id = data.get('conversation_id')
            is_typing = data.get('is_typing', False)
            
            if not conversation_id:
                return
            
            # Validate access
            conversation = Conversation.query.get(conversation_id)
            if not conversation or user_id not in [conversation.user1_id, conversation.user2_id]:
                return
            
            # Get user info
            user = User.query.get(user_id)
            
            # Emit to room (excluding sender)
            room_name = f"chat_{conversation_id}"
            emit('user_typing', {
                'user_id': user_id,
                'user_name': user.full_name if user else 'Unknown',
                'is_typing': is_typing,
                'conversation_id': conversation_id
            }, room=room_name, include_self=False)
            
        except Exception as e:
            print(f"Error handling typing event: {e}")
    
    
    # ═══════════════════════════════════════════════════════════════════════
    # EVENT: disconnect
    # Purpose: Clean up when user disconnects
    # ═══════════════════════════════════════════════════════════════════════
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle user disconnect"""
        user_id = get_socket_user_id()
        if user_id:
            print(f"User {user_id} disconnected from chat")
        # Rooms are automatically cleaned up by Flask-SocketIO

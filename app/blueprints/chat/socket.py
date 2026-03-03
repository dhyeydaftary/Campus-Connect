from flask import session
from flask_socketio import emit, join_room, leave_room
from app.models import db, Conversation, Message, User
from datetime import datetime, timezone
def init_socket_events(socketio):
    
    @socketio.on('connect')
    def on_connect():
        if "user_id" not in session:
            return False
            
    @socketio.on('disconnect')
    def on_disconnect():
        pass
        
    @socketio.on('join_chat')
    def on_join(data):
        if not data:
            return
        user_id = session.get("user_id")
        room_id = data.get('conversation_id')
        
        if not user_id or not room_id:
            return
            
        # Validate room_id is int
        if not isinstance(room_id, int) and not (isinstance(room_id, str) and room_id.isdigit()):
            return
            
        # Validate DB access
        conversation = db.session.get(Conversation, int(room_id))
        if not conversation:
            emit('error', {'message': 'Conversation not found'})
            return
            
        if user_id not in [conversation.user1_id, conversation.user2_id]:
            emit('error', {'message': 'Access denied'})
            return
            
        join_room(f"chat_{int(room_id)}")
        emit('joined', {'status': 'success', 'room': f"chat_{int(room_id)}"}) # Default emit to sender

    @socketio.on('leave_chat')
    def on_leave(data):
        if not data:
            return
        user_id = session.get("user_id")
        room_id = data.get('conversation_id')
        
        if not user_id or not room_id:
            return
            
        if not isinstance(room_id, int) and not (isinstance(room_id, str) and room_id.isdigit()):
            return
            
        # Verify DB access (optional but good for consistency)
        conversation = db.session.get(Conversation, int(room_id))
        if conversation and user_id in [conversation.user1_id, conversation.user2_id]:
            leave_room(f"chat_{int(room_id)}")

    @socketio.on('send_message')
    def on_send_message(data):
        if not data:
            return
        user_id = session.get("user_id")
        conversation_id = data.get('conversation_id')
        content = data.get('content')
        recipient_id = data.get('recipient_id')
        
        if not user_id or not content:
            return
            
        conversation = None
        receiver_id = None

        # Case 1: Existing conversation
        if conversation_id:
            # Validate conversation_id
            if not isinstance(conversation_id, int) and not (isinstance(conversation_id, str) and conversation_id.isdigit()):
                return
            
            conversation = db.session.get(Conversation, int(conversation_id))
            if not conversation:
                return
            
            if user_id not in [conversation.user1_id, conversation.user2_id]:
                return
            
            receiver_id = conversation.user2_id if conversation.user1_id == user_id else conversation.user1_id

        # Case 2: New conversation (pending)
        elif recipient_id:
            try:
                recipient_id = int(recipient_id)
                # Create conversation on first message
                conversation, _ = Conversation.get_or_create(user_id, recipient_id)
                conversation_id = conversation.id
                receiver_id = recipient_id
                # Join the room for the new conversation immediately
                join_room(f"chat_{conversation_id}")
            except Exception:
                return
        
        try:
            # 1. Save to DB
            new_msg = Message(
                conversation_id=conversation_id,
                sender_id=user_id,
                receiver_id=receiver_id,
                content=content,
                created_at=datetime.now(timezone.utc),
                is_read=False
            )
            db.session.add(new_msg)
            
            # Update conversation timestamp
            conversation.updated_at = datetime.now(timezone.utc)
            
            db.session.commit()
            
            # 2. Construct Payload (Must match GET /api/messages structure)
            sender = db.session.get(User, user_id)
            payload = {
                "id": new_msg.id,
                "conversation_id": conversation_id,
                "sender_id": user_id,
                "sender_name": sender.full_name,
                "sender_avatar": sender.profile_picture or f"https://ui-avatars.com/api/?name={sender.full_name}",
                "content": content,
                "created_at": new_msg.created_at.isoformat(),
                "is_read": False,
                "is_own": False # Receiver sees this as False
            }
            
            # 3. Emit to the specific room
            # 3. Emit to the specific room
            emit('new_message', payload, room=f"chat_{conversation_id}")
        except Exception:
            db.session.rollback()
            emit('error', {'message': 'Failed to send message'})

    @socketio.on('mark_read')
    def on_mark_read(data):
        if not data:
            return
        user_id = session.get("user_id")
        conversation_id = data.get('conversation_id')
        
        if not user_id or not conversation_id:
            return
            
        try:
            conversation_id = int(conversation_id)
            if conversation_id <= 0:
                return
        except (ValueError, TypeError):
            return
            
        # Verify participation
        conversation = db.session.get(Conversation, conversation_id)
        if not conversation or user_id not in [conversation.user1_id, conversation.user2_id]:
            return
            
        try:
            # Update DB: Mark messages received by me as read
            Message.mark_conversation_as_read(conversation_id, user_id)
            
            # Notify the room (so the other user sees "Read" status)
            emit('messages_read', {
                'conversation_id': conversation_id,
                'read_by': user_id
            }, room=f"chat_{conversation_id}")
        except Exception:
            db.session.rollback()

    @socketio.on('typing')
    def on_typing(data):
        if not data:
            return
        conversation_id = data.get('conversation_id')
        user_id = session.get("user_id")
        
        if not conversation_id or not user_id:
            return

        try:
            conversation_id = int(conversation_id)
        except (ValueError, TypeError):
            return

        # Verify participation
        conversation = db.session.get(Conversation, conversation_id)
        if conversation and user_id in [conversation.user1_id, conversation.user2_id]:
            # include_self=False ensures the sender doesn't see their own typing indicator
            emit('user_typing', {
                'conversation_id': conversation_id,
                'user_id': user_id
            }, room=f"chat_{conversation_id}", include_self=False)

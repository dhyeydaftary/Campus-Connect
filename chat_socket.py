from flask import session
from flask_socketio import emit, join_room
from models import db, Conversation, Message
from datetime import datetime, timezone

def init_socket_events(socketio):
    
    @socketio.on('join_chat')
    def on_join(data):
        if not data:
            return
        user_id = session.get("user_id")
        room = data.get('conversation_id')
        
        if not user_id or not room:
            return
            
        # Validate DB access
        conversation = db.session.get(Conversation, room)
        if conversation and user_id in [conversation.user1_id, conversation.user2_id]:
            join_room(f"chat_{room}")
            # emit('status', {'msg': f'Joined room {room}'})

    @socketio.on('send_message')
    def on_send_message(data):
        if not data:
            return
        user_id = session.get("user_id")
        conversation_id = data.get('conversation_id')
        content = data.get('content')
        
        if not user_id or not conversation_id or not content:
            return
            
        # Verify conversation access
        conversation = db.session.get(Conversation, conversation_id)
        if not conversation:
            return
        
        if user_id not in [conversation.user1_id, conversation.user2_id]:
            return

        # Determine receiver
        receiver_id = conversation.user2_id if conversation.user1_id == user_id else conversation.user1_id

        try:
            # 1. Save to DB
            new_msg = Message(
                conversation_id=conversation_id,
                sender_id=user_id,
                receiver_id=receiver_id,
                content=content
            )
            db.session.add(new_msg)
            
            db.session.commit()
            
            # 2. Construct Payload (Must match GET /api/messages structure)
            payload = new_msg.to_dict()
            
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
            
        # Update DB: Mark messages received by me as read
        Message.mark_conversation_as_read(conversation_id, user_id)
        
        # Notify the room (so the other user sees "Read" status)
        emit('messages_read', {
            'conversation_id': conversation_id,
            'read_by': user_id
        }, room=f"chat_{conversation_id}")

    @socketio.on('typing')
    def on_typing(data):
        if not data:
            return
        conversation_id = data.get('conversation_id')
        user_id = session.get("user_id")
        
        if conversation_id and user_id:
            # include_self=False ensures the sender doesn't see their own typing indicator
            emit('user_typing', {
                'conversation_id': conversation_id,
                'user_id': user_id
            }, room=f"chat_{conversation_id}", include_self=False)
import os
import json
from flask import Blueprint, request, jsonify, session, current_app
from app.models import db, User, Conversation, Message, Connection
from werkzeug.utils import secure_filename
from sqlalchemy import or_, and_, func, case, desc
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from app.extensions import limiter

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/api/chats', methods=['GET'])
def get_chats():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # 1. Subquery for unread counts per conversation for this user
    unread_subq = db.session.query(
        Message.conversation_id,
        func.count(Message.id).label('unread_count')
    ).filter(
        Message.receiver_id == user_id,
        Message.is_read == False
    ).group_by(Message.conversation_id).subquery()

    # 2. Subquery for the last message content per conversation
    last_msg_subq = db.session.query(
        Message.conversation_id,
        func.max(Message.id).label('last_msg_id')
    ).group_by(Message.conversation_id).subquery()

    last_msg_details = db.session.query(
        Message.conversation_id,
        Message.content,
        Message.sender_id,
        Message.is_read
    ).join(
        last_msg_subq, 
        Message.id == last_msg_subq.c.last_msg_id
    ).subquery().alias('last_msg_details_subq')

    # 3. Main Query
    results = db.session.query(
        Conversation, 
        User,
        func.coalesce(unread_subq.c.unread_count, 0),
        last_msg_details.c.content,
        last_msg_details.c.sender_id,
        last_msg_details.c.is_read
    ).join(
        User,
        or_(
            and_(Conversation.user1_id == user_id, Conversation.user2_id == User.id),
            and_(Conversation.user2_id == user_id, Conversation.user1_id == User.id)
        )
    ).outerjoin(
        unread_subq, Conversation.id == unread_subq.c.conversation_id
    ).outerjoin(
        last_msg_details, Conversation.id == last_msg_details.c.conversation_id
    ).filter(
        last_msg_details.c.content != None,
        User.account_type != 'admin',
        or_(Conversation.user1_id == user_id, Conversation.user2_id == user_id)
    ).order_by(Conversation.updated_at.desc()).all()

    chats_data = []
    for conversation, partner, unread, last_msg_text, last_msg_sender_id, last_msg_is_read in results:
        
        # Parse attachment for preview
        display_message = last_msg_text
        if last_msg_text and last_msg_text.startswith('[ATTACHMENT]'):
            try:
                data = json.loads(last_msg_text[12:])
                if data.get('caption'):
                    display_message = data.get('caption')
                else:
                    display_message = 'Sent a photo' if data.get('type') == 'image' else 'Sent a document'
            except:
                display_message = 'Sent an attachment'
        elif display_message and display_message.startswith('[POST_SHARE]'):
            try:
                data = json.loads(display_message[12:])
                author = data.get('authorName', 'someone')
                display_message = f"Shared a post by {author}"
            except:
                display_message = "Shared a post"

        chats_data.append({
            "conversation_id": conversation.id,
            "partner_id": partner.id,
            "partner_name": partner.full_name,
            "partner_avatar": partner.profile_picture or f"https://ui-avatars.com/api/?name={partner.full_name}",
            "last_message": display_message,
            "last_message_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
            "unread_count": unread,
            "last_msg_is_own": last_msg_sender_id == user_id,
            "last_msg_is_read": last_msg_is_read
        })

    return jsonify(chats_data), 200

@chat_bp.route('/api/chats/start', methods=['POST'])
def start_chat():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body"}), 400
    recipient_id = data.get("recipient_id")
    
    if not recipient_id:
        return jsonify({"error": "Recipient ID required"}), 400
        
    if not str(recipient_id).isdigit():
        return jsonify({"error": "Invalid recipient ID"}), 400
        
    if int(recipient_id) == int(user_id):
        return jsonify({"error": "Cannot chat with yourself"}), 400
        
    # Check if recipient exists
    recipient = db.session.get(User, recipient_id)
    if not recipient:
        return jsonify({"error": "User not found"}), 404

    # Check if conversation exists
    u1_id, u2_id = (user_id, recipient_id) if user_id < int(recipient_id) else (recipient_id, user_id)
    
    conversation = Conversation.query.filter_by(
        user1_id=u1_id,
        user2_id=u2_id
    ).first()
    
    if conversation:
        # Get partner details
        partner_id = conversation.user2_id if conversation.user1_id == user_id else conversation.user1_id
        partner = db.session.get(User, partner_id)
        return jsonify({
            "conversation_id": conversation.id,
            "status": "exists",
            "partner_id": partner.id,
            "partner_name": partner.full_name,
            "partner_avatar": partner.profile_picture or f"https://ui-avatars.com/api/?name={partner.full_name}"
        }), 409
    else:
        # Create new conversation
        new_conversation = Conversation(user1_id=u1_id, user2_id=u2_id)
        db.session.add(new_conversation)
        db.session.commit()

        return jsonify({
            "conversation_id": new_conversation.id,
            "status": "created",
            "partner_id": recipient.id,
            "partner_name": recipient.full_name,
            "partner_avatar": recipient.profile_picture or f"https://ui-avatars.com/api/?name={recipient.full_name}"
        }), 201

@chat_bp.route('/api/chats/<int:conversation_id>', methods=['GET'])
def get_chat_details(conversation_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    conversation = db.session.get(Conversation, conversation_id)
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
        
    if user_id not in [conversation.user1_id, conversation.user2_id]:
        return jsonify({"error": "Access denied"}), 403
        
    partner_id = conversation.user2_id if conversation.user1_id == user_id else conversation.user1_id
    partner = db.session.get(User, partner_id)
    
    return jsonify({
        "conversation_id": conversation.id,
        "partner_id": partner.id,
        "partner_name": partner.full_name,
        "partner_avatar": partner.profile_picture or f"https://ui-avatars.com/api/?name={partner.full_name}",
    }), 200

@chat_bp.route('/api/messages/<int:conversation_id>', methods=['GET'])
def get_messages(conversation_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    conversation = db.session.get(Conversation, conversation_id)
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
        
    # SECURITY FIX: Ensure user is part of this conversation
    if user_id not in [conversation.user1_id, conversation.user2_id]:
        return jsonify({"error": "Access denied"}), 403
        
    # Pagination
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    
    pagination = Message.query.options(joinedload(Message.sender))\
        .filter_by(conversation_id=conversation_id)\
        .order_by(Message.created_at.asc())\
        .paginate(page=page, per_page=limit, error_out=False)
        
    results = []
    for msg in pagination.items:
        results.append({
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender.full_name,
            "sender_avatar": msg.sender.profile_picture or f"https://ui-avatars.com/api/?name={msg.sender.full_name}",
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
            "is_read": msg.is_read,
            "is_own": msg.sender_id == user_id
        })
        
    return jsonify(results), 200

@chat_bp.route('/api/chats/unread-count', methods=['GET'])
@limiter.exempt
def get_total_unread_count():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    results = db.session.query(
        Message.conversation_id, 
        func.count(Message.id)
    ).filter(
        Message.receiver_id == user_id,
        Message.is_read == False
    ).group_by(Message.conversation_id).all()
    
    counts = {chat_id: count for chat_id, count in results}
    total = sum(counts.values())
    
    return jsonify({"per_conversation": counts, "total_unread": total}), 200

@chat_bp.route('/api/users/search', methods=['GET'])
def search_users_for_chat():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
        
    users = User.query.filter(
        User.id != user_id,
        User.status == 'ACTIVE',
        User.account_type != 'admin',
        or_(
            User.first_name.ilike(f"%{query}%"),
            User.last_name.ilike(f"%{query}%"),
            User.major.ilike(f"%{query}%")
        )
    ).limit(10).all()
    
    return jsonify([{
        "id": u.id,
        "name": u.full_name,
        "avatar": u.profile_picture or f"https://ui-avatars.com/api/?name={u.full_name}"
    } for u in users]), 200

@chat_bp.route('/api/messages/<int:conversation_id>/mark-read', methods=['POST'])
def mark_messages_read(conversation_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    conversation = db.session.get(Conversation, conversation_id)
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
        
    if user_id not in [conversation.user1_id, conversation.user2_id]:
        return jsonify({"error": "Access denied"}), 403
        
    count = Message.mark_conversation_as_read(conversation_id, user_id)
    
    return jsonify({"success": True, "marked_count": count}), 200

@chat_bp.route('/api/chat/upload', methods=['POST'])
def upload_chat_attachment():
    if "user_id" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        filename = secure_filename(file.filename)
        import time
        timestamp = int(time.time())
        unique_filename = f"chat_{session['user_id']}_{timestamp}_{filename}"
        
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        file_type = 'image' if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp'] else 'document'
        
        subfolder = 'chat_images' if file_type == 'image' else 'chat_docs'
        upload_folder = os.path.join(current_app.root_path, 'static', 'uploads', 'chat', subfolder)
        os.makedirs(upload_folder, exist_ok=True)
        
        file.save(os.path.join(upload_folder, unique_filename))
        
        return jsonify({
            "url": f"/static/uploads/chat/{subfolder}/{unique_filename}",
            "type": file_type,
            "original_name": filename
        })

@chat_bp.route('/api/chats/send_message', methods=['POST'])
def send_message_http():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.get_json()
    recipient_id = data.get('recipient_id')
    content = data.get('content')
    
    if not recipient_id or not content:
        return jsonify({"error": "Recipient and content required"}), 400
        
    if int(recipient_id) == int(user_id):
        return jsonify({"error": "Cannot chat with yourself"}), 400
        
    if not str(content).strip():
        return jsonify({"error": "Content cannot be empty"}), 400
        
    if len(str(content)) > 5000:
        return jsonify({"error": "Message too long"}), 400
        
    try:
        # Get or create conversation
        u1_id, u2_id = (user_id, int(recipient_id)) if user_id < int(recipient_id) else (int(recipient_id), user_id)
        
        conversation = Conversation.query.filter_by(user1_id=u1_id, user2_id=u2_id).first()
        
        if not conversation:
            conversation = Conversation(user1_id=u1_id, user2_id=u2_id)
            db.session.add(conversation)
            db.session.commit()
            
        # Create message
        new_msg = Message(
            conversation_id=conversation.id,
            sender_id=user_id,
            receiver_id=int(recipient_id),
            content=content,
            created_at=datetime.now(timezone.utc),
            is_read=False
        )
        db.session.add(new_msg)
        conversation.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        
        # Emit socket event if socketio is available
        socketio = current_app.extensions.get('socketio')
        if socketio:
            sender = db.session.get(User, user_id)
            payload = {
                "id": new_msg.id,
                "conversation_id": conversation.id,
                "sender_id": user_id,
                "sender_name": sender.full_name,
                "sender_avatar": sender.profile_picture or f"https://ui-avatars.com/api/?name={sender.full_name}",
                "content": content,
                "created_at": new_msg.created_at.isoformat(),
                "is_read": False,
                "is_own": False
            }
            socketio.emit('new_message', payload, room=f"chat_{conversation.id}")
            
        return jsonify({"success": True}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@chat_bp.route('/api/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    msg = db.session.get(Message, message_id)
    if not msg:
        return jsonify({"error": "Message not found"}), 404
        
    if msg.sender_id != user_id:
        return jsonify({"error": "Access denied"}), 403
        
    db.session.delete(msg)
    db.session.commit()
    
    return jsonify({"success": True}), 200

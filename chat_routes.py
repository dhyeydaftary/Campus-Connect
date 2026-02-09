from flask import Blueprint, request, jsonify, session
from models import db, User, Conversation, Message
from sqlalchemy import or_, and_, func, case, desc
from sqlalchemy.orm import joinedload

chat_bp = Blueprint('chat', __name__)

# 1) GET /api/chats
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
    # We use a window function approach or a correlated subquery.
    # Given the constraints, a correlated subquery for the content is often simplest for "last message"
    # if we don't want to rely on complex window functions in ORM.
    # However, since we already have updated_at on Conversation, we just need the content.
    
    # Efficient approach: Join on a subquery that gets the latest message ID per conversation
    last_msg_subq = db.session.query(
        Message.conversation_id,
        func.max(Message.id).label('last_msg_id')
    ).group_by(Message.conversation_id).subquery()

    last_msg_content = db.session.query(
        Message.conversation_id,
        Message.content
    ).join(
        last_msg_subq, 
        Message.id == last_msg_subq.c.last_msg_id
    ).subquery()

    # 3. Main Query
    results = db.session.query(
        Conversation, 
        User,
        func.coalesce(unread_subq.c.unread_count, 0),
        last_msg_content.c.content
    ).join(
        User,
        or_(
            and_(Conversation.user1_id == user_id, Conversation.user2_id == User.id),
            and_(Conversation.user2_id == user_id, Conversation.user1_id == User.id)
        )
    ).outerjoin(
        unread_subq, Conversation.id == unread_subq.c.conversation_id
    ).outerjoin(
        last_msg_content, Conversation.id == last_msg_content.c.conversation_id
    ).filter(
        or_(Conversation.user1_id == user_id, Conversation.user2_id == user_id)
    ).order_by(Conversation.updated_at.desc()).all()

    chats_data = []
    for conversation, partner, unread, last_msg_text in results:
        
        chats_data.append({
            "conversation_id": conversation.id,
            "partner_id": partner.id,
            "partner_name": partner.full_name,
            "partner_avatar": partner.profile_picture or f"https://ui-avatars.com/api/?name={partner.full_name}",
            "last_message": last_msg_text,
            "last_message_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
            "unread_count": unread
        })

    return jsonify(chats_data), 200

# 2) POST /api/chats/start
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

    # Use model method to get or create (handles bidirectional check)
    conversation, created = Conversation.get_or_create(user_id, recipient_id)
    
    if not conversation:
        return jsonify({"error": "Failed to create conversation"}), 500
    
    return jsonify({
        "conversation_id": conversation.id,
        "status": "created" if created else "exists"
    }), 200 if not created else 201

# 3) GET /api/messages/<conversation_id>
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
        
    messages = Message.query.options(joinedload(Message.sender)).filter_by(conversation_id=conversation_id)\
        .order_by(Message.created_at.asc()).all()
        
    return jsonify([m.to_dict() for m in messages]), 200

# 4) GET /api/chats/unread-count
@chat_bp.route('/api/chats/unread-count', methods=['GET'])
def get_total_unread_count():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    # Count all unread messages where receiver is current user
    # Group by conversation to satisfy "per conversation" requirement
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

# 5) POST /api/messages/<conversation_id>/mark-read
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
        
    # Mark only messages received by this user as read
    count = Message.mark_conversation_as_read(conversation_id, user_id)
    
    return jsonify({"success": True, "marked_count": count}), 200
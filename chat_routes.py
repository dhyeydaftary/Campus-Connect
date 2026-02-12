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
    ).subquery().alias('last_msg_content_subq') # Alias for clarity

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
        last_msg_content.c.content != None,  # Only include conversations with messages
        User.account_type != 'admin',  # Exclude admin from chat list
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
        }), 200
    else:
        return jsonify({
            "temp_user_id": recipient.id,
            "temp_user_name": recipient.full_name,
            "temp_user_avatar": recipient.profile_picture or f"https://ui-avatars.com/api/?name={recipient.full_name}",
            "status": "new"
        }), 200

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

# 5) GET /api/users/search
@chat_bp.route('/api/users/search', methods=['GET'])
def search_users_for_chat():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
        
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
        
    # Search users by name, excluding current user
    # Limit to 10 results for performance
    users = User.query.filter(
        User.id != user_id,
        User.is_active == True,
        User.account_type != 'admin',  # Exclude admin from search
        or_(
            User.first_name.ilike(f"%{query}%"),
            User.last_name.ilike(f"%{query}%"),
            User.major.ilike(f"%{query}%") # Optional: search by major too
        )
    ).limit(10).all()
    
    return jsonify([{
        "id": u.id,
        "name": u.full_name,
        "avatar": u.profile_picture or f"https://ui-avatars.com/api/?name={u.full_name}"
    } for u in users]), 200

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
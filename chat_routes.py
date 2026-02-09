"""
═══════════════════════════════════════════════════════════════════════════
CHAT API ROUTES
Campus Connect - Direct Messaging REST API
═══════════════════════════════════════════════════════════════════════════

ENDPOINTS:
- GET  /api/chats                    - Get all conversations for logged-in user
- GET  /api/messages/<conversation_id> - Get all messages in a conversation
- POST /api/chats/start              - Start a new conversation
- GET  /api/chats/unread-count       - Get total unread message count

SECURITY:
- All endpoints require authentication (session["user_id"])
- Users can only access their own conversations
- Input validation on all endpoints
- SQL injection prevention via SQLAlchemy ORM
"""

from flask import Blueprint, request, jsonify, session
from models import db, User, Conversation, Message
from sqlalchemy import or_, and_
from datetime import datetime, timezone

# Create Blueprint
chat_bp = Blueprint('chat', __name__)


# ═══════════════════════════════════════════════════════════════════════════
# AUTHENTICATION HELPER
# ═══════════════════════════════════════════════════════════════════════════

def require_auth():
    """
    Check if user is authenticated.
    Returns: user_id if authenticated, None otherwise
    """
    return session.get("user_id")


def get_authenticated_user_id():
    """
    Get authenticated user ID or return error response.
    Returns: (user_id, error_response)
    """
    user_id = require_auth()
    if not user_id:
        return None, jsonify({"error": "Unauthorized"}), 401
    return user_id, None


# ═══════════════════════════════════════════════════════════════════════════
# ROUTE: GET /api/chats
# Purpose: Get all conversations for logged-in user
# ═══════════════════════════════════════════════════════════════════════════

@chat_bp.route('/api/chats', methods=['GET'])
def get_chats():
    """
    Get all conversations for the logged-in user with metadata.
    
    Returns:
    {
        "conversations": [
            {
                "conversation_id": 1,
                "other_user_id": 2,
                "other_user_name": "John Doe",
                "other_user_avatar": "uploads/images/profile.jpg",
                "last_message": "Hey, how are you?",
                "last_message_time": "2024-01-15T10:30:00Z",
                "last_message_sender_id": 2,
                "unread_count": 3,
                "is_online": false
            }
        ]
    }
    """
    user_id, error = get_authenticated_user_id()
    if error:
        return error
    
    try:
        # Get all conversations for this user
        conversations = Conversation.get_user_conversations(user_id)
        
        result = []
        for conv in conversations:
            # Get the other user
            other_user_id = conv.get_other_user_id(user_id)
            other_user = User.query.get(other_user_id)
            
            if not other_user:
                continue  # Skip if user was deleted
            
            # Get last message
            last_message = conv.get_last_message()
            
            # Get unread count
            unread_count = conv.get_unread_count(user_id)
            
            result.append({
                "conversation_id": conv.id,
                "other_user_id": other_user.id,
                "other_user_name": other_user.full_name,
                "other_user_avatar": other_user.profile_picture or f"https://ui-avatars.com/api/?name={other_user.full_name}",
                "other_user_major": other_user.major,
                "last_message": last_message.content if last_message else None,
                "last_message_time": last_message.created_at.isoformat() if last_message else conv.created_at.isoformat(),
                "last_message_sender_id": last_message.sender_id if last_message else None,
                "unread_count": unread_count,
                "updated_at": conv.updated_at.isoformat()
            })
        
        # Sort by updated_at (most recent first)
        result.sort(key=lambda x: x["updated_at"], reverse=True)
        
        return jsonify({
            "success": True,
            "conversations": result
        }), 200
        
    except Exception as e:
        print(f"Error fetching chats: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to fetch conversations"
        }), 500


# ═══════════════════════════════════════════════════════════════════════════
# ROUTE: GET /api/messages/<conversation_id>
# Purpose: Get all messages in a conversation
# ═══════════════════════════════════════════════════════════════════════════

@chat_bp.route('/api/messages/<int:conversation_id>', methods=['GET'])
def get_messages(conversation_id):
    """
    Get all messages in a conversation.
    Security: Validates that user belongs to the conversation.
    
    Query Parameters:
    - limit: Max number of messages to return (default: 100)
    - before_id: Get messages before this message ID (for pagination)
    
    Returns:
    {
        "success": true,
        "messages": [
            {
                "id": 1,
                "sender_id": 2,
                "receiver_id": 1,
                "content": "Hey!",
                "is_read": true,
                "read_at": "2024-01-15T10:31:00Z",
                "created_at": "2024-01-15T10:30:00Z",
                "sender_name": "John Doe",
                "sender_avatar": "..."
            }
        ],
        "conversation": {
            "id": 1,
            "other_user_name": "John Doe",
            "other_user_avatar": "..."
        }
    }
    """
    user_id, error = get_authenticated_user_id()
    if error:
        return error
    
    try:
        # Get conversation and validate access
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "Conversation not found"
            }), 404
        
        # Security check: User must be part of this conversation
        if user_id not in [conversation.user1_id, conversation.user2_id]:
            return jsonify({
                "success": False,
                "error": "Access denied"
            }), 403
        
        # Get pagination parameters
        limit = request.args.get('limit', 100, type=int)
        before_id = request.args.get('before_id', type=int)
        
        # Build query
        query = Message.query.filter_by(conversation_id=conversation_id)
        
        if before_id:
            query = query.filter(Message.id < before_id)
        
        # Get messages ordered by created_at ASC (oldest first)
        messages = query.order_by(Message.created_at.asc()).limit(limit).all()
        
        # Convert to dict
        messages_data = [msg.to_dict() for msg in messages]
        
        # Get other user info
        other_user_id = conversation.get_other_user_id(user_id)
        other_user = User.query.get(other_user_id)
        
        return jsonify({
            "success": True,
            "messages": messages_data,
            "conversation": {
                "id": conversation.id,
                "other_user_id": other_user.id,
                "other_user_name": other_user.full_name if other_user else "Unknown",
                "other_user_avatar": other_user.profile_picture if other_user else None,
                "other_user_major": other_user.major if other_user else None
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to fetch messages"
        }), 500


# ═══════════════════════════════════════════════════════════════════════════
# ROUTE: POST /api/chats/start
# Purpose: Start a conversation with another user
# ═══════════════════════════════════════════════════════════════════════════

@chat_bp.route('/api/chats/start', methods=['POST'])
def start_chat():
    """
    Start a conversation with another user.
    If conversation exists, returns existing conversation.
    
    Request Body:
    {
        "user_id": 2
    }
    
    Returns:
    {
        "success": true,
        "conversation_id": 1,
        "was_created": false,
        "other_user": {
            "id": 2,
            "name": "John Doe",
            "avatar": "...",
            "major": "Computer Science"
        }
    }
    """
    user_id, error = get_authenticated_user_id()
    if error:
        return error
    
    try:
        data = request.get_json()
        
        if not data or 'user_id' not in data:
            return jsonify({
                "success": False,
                "error": "user_id is required"
            }), 400
        
        other_user_id = data['user_id']
        
        # Validation
        if not isinstance(other_user_id, int) or other_user_id <= 0:
            return jsonify({
                "success": False,
                "error": "Invalid user_id"
            }), 400
        
        if other_user_id == user_id:
            return jsonify({
                "success": False,
                "error": "Cannot start conversation with yourself"
            }), 400
        
        # Check if other user exists
        other_user = User.query.get(other_user_id)
        if not other_user:
            return jsonify({
                "success": False,
                "error": "User not found"
            }), 404
        
        # Get or create conversation
        conversation, was_created = Conversation.get_or_create(user_id, other_user_id)
        
        return jsonify({
            "success": True,
            "conversation_id": conversation.id,
            "was_created": was_created,
            "other_user": {
                "id": other_user.id,
                "name": other_user.full_name,
                "avatar": other_user.profile_picture or f"https://ui-avatars.com/api/?name={other_user.full_name}",
                "major": other_user.major
            }
        }), 201 if was_created else 200
        
    except Exception as e:
        print(f"Error starting chat: {e}")
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Failed to start conversation"
        }), 500


# ═══════════════════════════════════════════════════════════════════════════
# ROUTE: GET /api/chats/unread-count
# Purpose: Get total unread message count for badge display
# ═══════════════════════════════════════════════════════════════════════════

@chat_bp.route('/api/chats/unread-count', methods=['GET'])
def get_unread_count():
    """
    Get total number of unread messages for the logged-in user.
    
    Returns:
    {
        "success": true,
        "count": 5
    }
    """
    user_id, error = get_authenticated_user_id()
    if error:
        return error
    
    try:
        count = Message.query.filter_by(
            receiver_id=user_id,
            is_read=False
        ).count()
        
        return jsonify({
            "success": True,
            "count": count
        }), 200
        
    except Exception as e:
        print(f"Error getting unread count: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to get unread count"
        }), 500


# ═══════════════════════════════════════════════════════════════════════════
# ROUTE: POST /api/messages/<conversation_id>/mark-read
# Purpose: Mark all messages in a conversation as read
# ═══════════════════════════════════════════════════════════════════════════

@chat_bp.route('/api/messages/<int:conversation_id>/mark-read', methods=['POST'])
def mark_conversation_read(conversation_id):
    """
    Mark all messages in a conversation as read for the current user.
    
    Returns:
    {
        "success": true,
        "marked_count": 3
    }
    """
    user_id, error = get_authenticated_user_id()
    if error:
        return error
    
    try:
        # Validate conversation exists and user has access
        conversation = Conversation.query.get(conversation_id)
        
        if not conversation:
            return jsonify({
                "success": False,
                "error": "Conversation not found"
            }), 404
        
        if user_id not in [conversation.user1_id, conversation.user2_id]:
            return jsonify({
                "success": False,
                "error": "Access denied"
            }), 403
        
        # Mark all unread messages as read
        marked_count = Message.mark_conversation_as_read(conversation_id, user_id)
        
        return jsonify({
            "success": True,
            "marked_count": marked_count
        }), 200
        
    except Exception as e:
        print(f"Error marking messages as read: {e}")
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Failed to mark messages as read"
        }), 500

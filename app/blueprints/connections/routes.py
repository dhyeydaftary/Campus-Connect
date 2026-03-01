from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, abort, current_app, send_file
from sqlalchemy import func, or_, and_
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timezone, timedelta
import time
from app.extensions import db, limiter
from app.models import (
    User, Post, Like, Comment, Event, EventRegistration,
    Connection, ConnectionRequest, Notification, Announcement,
    Skill, Experience, Education
)
from app.utils.decorators import login_required

from app.utils.helpers import (
    get_clean_filename, _get_user_avatar, save_uploaded_file,
    _format_post_for_api, get_content_activity
)
from app.services.email_service import send_welcome_email
from app.services.comment_queue import comment_queue_service
from sqlalchemy.orm import joinedload

from . import connections_bp



@connections_bp.route("/suggestions", methods=["GET"])
@login_required
def get_suggestions():
    """Generates a list of connection suggestions for the current user."""
    current_user_id = session["user_id"]
    current_user = db.session.get(User, current_user_id)
    
    if not current_user:
        return jsonify({"error": "User not found"}), 404
    
    # 1. Get IDs of users who are already connected.
    connected_ids = current_user.get_connection_ids()
    
    # 2. Get IDs of users with pending requests (both sent and received).
    pending_sent = [r.receiver_id for r in ConnectionRequest.query.filter_by(
        sender_id=current_user_id, 
        status='pending'
    ).all()]
    
    pending_received = [r.sender_id for r in ConnectionRequest.query.filter_by(
        receiver_id=current_user_id, 
        status='pending'
    ).all()]
    
    # 3. Combine all users to be excluded from suggestions.
    exclude_ids = set(connected_ids + pending_sent + pending_received + [current_user_id])
    
    # 4. Query for suggestions with a priority system.
    suggestions = []
    
    # Priority 1: Same university + same major
    suggestions = User.query.filter(
        User.id.notin_(exclude_ids),
        User.account_type != 'admin',
        User.university == current_user.university,
        User.major == current_user.major
    ).order_by(func.random()).limit(5).all()
    
    # Priority 2: If not enough, add same university (any major)
    if len(suggestions) < 5:
        additional = User.query.filter(
            User.id.notin_(exclude_ids),
            User.account_type != 'admin',
            User.id.notin_([s.id for s in suggestions]),
            User.university == current_user.university
        ).order_by(func.random()).limit(5 - len(suggestions)).all()
        suggestions.extend(additional)
    
    # Priority 3: If still not enough, add anyone else
    if len(suggestions) < 5:
        additional = User.query.filter(
            User.id.notin_(exclude_ids),
            User.account_type != 'admin',
            User.id.notin_([s.id for s in suggestions])
        ).order_by(func.random()).limit(5 - len(suggestions)).all()
        suggestions.extend(additional)
    
    # Step 5: Format response
    result = [] # Renamed from 'suggestions' to avoid confusion with the query result
    for user in suggestions:
        result.append({
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "university": user.university,
            "major": user.major,
            "batch": user.batch,
            "profile_picture": _get_user_avatar(user)
        })
    
    return jsonify({"suggestions": result})



# ==============================================================================
# CONNECTIONS API ROUTES
# ==============================================================================

@connections_bp.route("/connections/request", methods=["POST"])
@login_required
def send_connection_request():
    """Sends a connection request to another user or re-sends a rejected one."""
    data = request.get_json()
    receiver_id = data.get("receiver_id")
    
    if not receiver_id:
        return jsonify({"error": "Receiver ID required"}), 400
    
    sender_id = session["user_id"]
    
    if sender_id == receiver_id:
        return jsonify({"error": "Cannot connect with yourself"}), 400
    
    # Check if receiver exists
    receiver = db.session.get(User, receiver_id)
    if not receiver:
        return jsonify({"error": "User not found"}), 404
    
    # Check if already connected
    existing_connection = Connection.query.filter(
        or_(
            and_(Connection.user_id == sender_id, Connection.connected_user_id == receiver_id),
            and_(Connection.user_id == receiver_id, Connection.connected_user_id == sender_id)
        )
    ).first()
    
    if existing_connection:
        return jsonify({"error": "Already connected"}), 400
    
    # Check if I already sent a request (any status)
    my_request = ConnectionRequest.query.filter_by(
        sender_id=sender_id,
        receiver_id=receiver_id
    ).first()
    
    if my_request:
        if my_request.status == 'pending':
            return jsonify({"error": "Request already sent"}), 400
        elif my_request.status == 'accepted':
            return jsonify({"error": "Already connected"}), 400
        elif my_request.status == 'rejected':
            # Reactivate rejected request
            my_request.status = 'pending'
            my_request.created_at = datetime.now(timezone.utc)
            my_request.responded_at = None
            
            # Create notification for receiver
            sender = db.session.get(User, sender_id)
            notification = Notification(
                user_id=receiver_id,
                type='connection_request',
                message=f"{sender.full_name} sent you a connection request",
                reference_id=my_request.id,
                actor_id=sender_id
            )
            
            db.session.add(notification)
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": "Connection request sent",
                "request_id": my_request.id
            })

    # Check if they sent me a request
    their_request = ConnectionRequest.query.filter_by(
        sender_id=receiver_id,
        receiver_id=sender_id
    ).first()
    
    if their_request:
        if their_request.status == 'pending':
            return jsonify({"error": "This user already sent you a request"}), 400
        elif their_request.status == 'accepted':
            return jsonify({"error": "Already connected"}), 400
        # If rejected, we allow sending a new request from me to them
    
    # Create new connection request
    new_request = ConnectionRequest(
        sender_id=sender_id,
        receiver_id=receiver_id,
        status='pending'
    )
    
    db.session.add(new_request)
    
    # Create notification for receiver
    sender = db.session.get(User, sender_id)
    notification = Notification(
        user_id=receiver_id,
        type='connection_request',
        message=f"{sender.full_name} sent you a connection request",
        reference_id=new_request.id,
        actor_id=sender_id
    )
    
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Connection request sent",
        "request_id": new_request.id
    })



@connections_bp.route("/connections/accept/<int:request_id>", methods=["POST"])
@login_required
def accept_connection_request(request_id):
    """Accepts a pending connection request."""
    current_user_id = session["user_id"]
    
    # Get the request
    conn_request = db.session.get(ConnectionRequest, request_id)
    
    if not conn_request:
        return jsonify({"error": "Request not found"}), 404
    
    # Verify you're the receiver
    if conn_request.receiver_id != current_user_id:
        return jsonify({"error": "Not authorized"}), 403
    
    # Check if already accepted
    if conn_request.status == 'accepted':
        return jsonify({"error": "Already accepted"}), 400
    
    # Update request status
    conn_request.status = 'accepted'
    conn_request.responded_at = datetime.now(timezone.utc)
    
    # Create connection (store smaller ID first for consistency)
    user_a = min(conn_request.sender_id, conn_request.receiver_id)
    user_b = max(conn_request.sender_id, conn_request.receiver_id)
    
    new_connection = Connection(
        user_id=user_a,
        connected_user_id=user_b
    )
    
    db.session.add(new_connection)
    db.session.flush()
    
    # Create notification for sender
    receiver = db.session.get(User, current_user_id)
    notification = Notification(
        user_id=conn_request.sender_id,
        type='connection_accepted',
        message=f"{receiver.full_name} accepted your connection request",
        reference_id=new_connection.id,
        actor_id=current_user_id
    )
    
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Connection request accepted"
    })



@connections_bp.route("/connections/reject/<int:request_id>", methods=["POST"])
@login_required
def reject_connection_request(request_id):
    """Rejects a pending connection request."""
    current_user_id = session["user_id"]
    
    # Get the request
    conn_request = db.session.get(ConnectionRequest, request_id)
    
    if not conn_request:
        return jsonify({"error": "Request not found"}), 404
    
    # Verify you're the receiver
    if conn_request.receiver_id != current_user_id:
        return jsonify({"error": "Not authorized"}), 403
    
    # Update request status
    conn_request.status = 'rejected'
    conn_request.responded_at = datetime.now(timezone.utc)
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Connection request rejected"
    })



@connections_bp.route("/connections/pending", methods=["GET"])
@login_required
def get_pending_requests():
    """Fetches all connection requests received by the current user that are pending."""
    current_user_id = session["user_id"]
    
    # Get requests where current user is the receiver
    pending_requests = ConnectionRequest.query.filter_by(
        receiver_id=current_user_id,
        status='pending'
    ).order_by(ConnectionRequest.created_at.desc()).all()
    
    result = []
    for req in pending_requests:
        sender = db.session.get(User, req.sender_id)
        if sender:
            result.append({
                "request_id": req.id,
                "sender": {
                    "id": sender.id,
                    "name": sender.full_name,
                    "email": sender.email,
                    "university": sender.university,
                    "major": sender.major,
                    "profile_picture": _get_user_avatar(sender)
                },
                "created_at": req.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    return jsonify({"requests": result, "count": len(result)})



@connections_bp.route("/connections/sent", methods=["GET"])
@login_required
def get_sent_requests():
    """Fetches all connection requests sent by the current user that are still pending."""
    current_user_id = session["user_id"]
    
    # Get requests where current user is the sender
    sent_requests = ConnectionRequest.query.filter_by(
        sender_id=current_user_id,
        status='pending'
    ).order_by(ConnectionRequest.created_at.desc()).all()
    
    result = []
    for req in sent_requests:
        receiver = db.session.get(User, req.receiver_id)
        if receiver:
            result.append({
                "request_id": req.id,
                "receiver": {
                    "id": receiver.id,
                    "name": receiver.full_name,
                    "email": receiver.email,
                    "university": receiver.university,
                    "major": receiver.major,
                    "profile_picture": _get_user_avatar(receiver)
                },
                "created_at": req.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })
    
    return jsonify({"requests": result, "count": len(result)})



@connections_bp.route("/connections/list", methods=["GET"])
@login_required
def get_connections_list():
    """Fetches a simple list of all of the current user's connections."""
    current_user_id = session["user_id"]
    
    # Get all connections (bidirectional check)
    connections = Connection.query.filter(
        or_(
            Connection.user_id == current_user_id,
            Connection.connected_user_id == current_user_id
        )
    ).order_by(Connection.connected_at.desc()).all()
    
    result = []
    for conn in connections:
        # Get the OTHER user's ID
        other_user_id = conn.connected_user_id if conn.user_id == current_user_id else conn.user_id
        other_user = db.session.get(User, other_user_id)
        
        if other_user:
            result.append({
                "id": other_user.id,
                "name": other_user.full_name,
                "email": other_user.email,
                "university": other_user.university,
                "major": other_user.major,
                "batch": other_user.batch,
                "profile_picture": _get_user_avatar(other_user),
                "connected_since": conn.connected_at.strftime("%B %Y")
            })
    
    return jsonify({"connections": result, "count": len(result)})



@connections_bp.route("/connections/<int:user_id>", methods=["DELETE"])
@login_required
def remove_connection(user_id):
    """Removes a connection between the current user and another user."""
    current_user_id = session["user_id"]
    
    # Find connection (bidirectional check)
    connection = Connection.query.filter(
        or_(
            and_(Connection.user_id == current_user_id, Connection.connected_user_id == user_id),
            and_(Connection.user_id == user_id, Connection.connected_user_id == current_user_id)
        )
    ).first()
    
    if not connection:
        return jsonify({"error": "Connection not found"}), 404
        
    db.session.delete(connection)
    
    # Clean up associated connection requests to allow re-connecting
    requests = ConnectionRequest.query.filter(
        or_(
            and_(ConnectionRequest.sender_id == current_user_id, ConnectionRequest.receiver_id == user_id),
            and_(ConnectionRequest.sender_id == user_id, ConnectionRequest.receiver_id == current_user_id)
        )
    ).all()
    
    for req in requests:
        db.session.delete(req)
        
    db.session.commit()
    
    return jsonify({"success": True, "message": "Connection removed"})


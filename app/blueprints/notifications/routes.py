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

from . import notifications_bp



# ==============================================================================
# NOTIFICATIONS API ROUTES
# ==============================================================================

@notifications_bp.route("/notifications", methods=["GET"])
@login_required
def get_notifications():
    """Fetches the latest notifications for the current user."""
    user_id = session["user_id"]
    
    # Get all notifications, ordered by newest first
    notifications = Notification.query.filter_by(
        user_id=user_id
    ).order_by(Notification.created_at.desc()).limit(20).all()
    
    result = []
    for notif in notifications:
        # Get actor info if exists
        actor = None
        if notif.actor_id:
            actor_user = db.session.get(User, notif.actor_id)
            if actor_user:
                actor = {
                    "id": actor_user.id,
                    "name": actor_user.full_name,
                    "profile_picture": _get_user_avatar(actor_user)
                }
        
        result.append({
            "id": notif.id,
            "type": notif.type,
            "message": notif.message,
            "reference_id": notif.reference_id,
            "actor": actor,
            "is_read": notif.is_read,
            "created_at": notif.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    # Add unread_count to response so frontend doesn't reset badge to 0
    unread_count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()
    
    return jsonify({"notifications": result, "unread_count": unread_count})



@notifications_bp.route("/notifications/unread-count", methods=["GET"])
@limiter.exempt
@login_required
def get_unread_count():
    """Fetches only the count of unread notifications, for badge updates."""
    user_id = session["user_id"]
    
    unread_count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()
    
    return jsonify({"count": unread_count})



@notifications_bp.route("/notifications/mark-read/<int:notification_id>", methods=["POST"])
@login_required
def mark_notification_read(notification_id):
    """Marks a single notification as read."""
    user_id = session["user_id"]
    
    notification = db.session.get(Notification, notification_id)
    
    if not notification:
        return jsonify({"error": "Notification not found"}), 404
    
    if notification.user_id != user_id:
        return jsonify({"error": "Not authorized"}), 403
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({"success": True})



@notifications_bp.route("/notifications/mark-all-read", methods=["POST"])
@login_required
def mark_all_notifications_read():
    """Marks all of the user's unread notifications as read."""
    user_id = session["user_id"]
    
    Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).update({"is_read": True})
    
    db.session.commit()
    
    return jsonify({"success": True})



@notifications_bp.route("/notifications/clear", methods=["POST"])
@login_required
def clear_notifications():
    """Deletes all notifications for the current user."""
    user_id = session["user_id"]
    
    Notification.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    
    return jsonify({"success": True})


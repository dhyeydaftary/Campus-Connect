"""
Helper functions for Campus Connect.
"""

import os
import re
from datetime import datetime, timezone, timedelta
from flask import session, current_app
from werkzeug.utils import secure_filename
from sqlalchemy import func
from app.extensions import db
from app.models import User, Post, Event, Like


def get_clean_filename(file_path):
    """
    Extracts the original filename from the system-generated unique filename.
    The pattern is expected to be: {userID}_{timestamp}_{original_filename}.
    """
    if not file_path:
        return None
    filename = os.path.basename(file_path)
    # Pattern: userID_YYYYMMDD_HHMMSS_ActualName
    match = re.match(r'^\d+_\d{8}_\d{6}_(.+)$', filename)
    if match:
        return match.group(1)
    return filename


def _get_user_avatar(user):
    """Returns user's profile picture URL or a default avatar."""
    if not user:
        return None
    return getattr(user, 'profile_picture', None) or f"https://ui-avatars.com/api/?name={user.full_name}"


def save_uploaded_file(file, file_type):
    """
    Saves an uploaded file to a designated directory with a unique filename.

    Returns: The relative path to the saved file, or None if the file is invalid.
    """
    if not file or file.filename == '':
        return None
    
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{session['user_id']}_{timestamp}_{secure_filename(file.filename)}"
    
    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'post', 'post_images' if file_type == 'image' else 'post_docs')
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)
    
    return file_path.replace('static/', '')


def _format_post_for_api(post_data_tuple, current_user_id, liked_post_ids=None):
    """
    Standardizes the format of a post object for API responses.

    Args:
        post_data_tuple: A tuple containing (Post, User, likes_count, comments_count).
        current_user_id: The ID of the user viewing the post, to check 'isLiked' status.
        liked_post_ids: (Optional) A set of post IDs the current user has liked.
                        Providing this avoids N+1 queries in feed endpoints.
    """
    post, user, likes_count, comments_count = post_data_tuple

    is_liked = False
    if current_user_id:
        if liked_post_ids is not None:
            # Performant check using pre-fetched data
            is_liked = post.id in liked_post_ids
        else:
            # Fallback for single-post fetches (acceptable performance)
            is_liked = db.session.query(Like.query.filter_by(post_id=post.id, user_id=current_user_id).exists()).scalar()

    return {
        "id": post.id,
        "user_id": post.user_id,
        "username": user.full_name.title() if user.full_name else "",
        "profileImage": _get_user_avatar(user),
        "postImages": [f"/static/{post.file_path}"] if post.file_path else ([post.image_url] if post.image_url else []),
        "currentImageIndex": 0,
        "caption": post.caption,
        "accountType": user.account_type,
        "collegeName": user.major,
        "likesCount": likes_count,
        "commentsCount": comments_count,
        "comments": [], # Intentionally empty for performance; fetched on demand
        "isLiked": is_liked,
        "createdAt": post.created_at.isoformat(),
        "file_path": post.file_path,
        "file_type": post.file_type,
        "image_url": f"/static/{post.file_path}" if post.file_path else post.image_url,
        "original_filename": get_clean_filename(post.file_path)
    }


def get_content_activity():
    """
    Calculates content activity (posts and events) for the last 7 days.

    Returns:
        A dictionary containing labels for the last 7 days and corresponding
        counts for posts and events created on each day.
    """
    today_utc = datetime.now(timezone.utc).date()
    days = [today_utc - timedelta(days=i) for i in range(6, -1, -1)]

    start_dt = datetime.combine(days[0], datetime.min.time(), tzinfo=timezone.utc)

    posts_counts = {day: 0 for day in days}
    events_counts = {day: 0 for day in days}

    posts_query = (
        db.session.query(
            func.date(Post.created_at),
            func.count(Post.id)
        )
        .join(User, Post.user_id == User.id)
        .filter(Post.created_at >= start_dt)
        .filter(User.status == 'ACTIVE')
        .group_by(func.date(Post.created_at))
        .all()
    )

    for day, count in posts_query:
        if day in posts_counts:
            posts_counts[day] = count

    events_query = (
        db.session.query(
            func.date(Event.event_date),
            func.count(Event.id)
        )
        .join(User, Event.user_id == User.id)
        .filter(Event.event_date >= start_dt)
        .filter(User.status == 'ACTIVE')
        .group_by(func.date(Event.event_date))
        .all()
    )

    for day, count in events_query:
        if day in events_counts:
            events_counts[day] = count

    return {
        "labels": [d.strftime("%b %d") for d in days],
        "posts": [posts_counts[d] for d in days],
        "events": [events_counts[d] for d in days],
    }


def _format_admin_event(event):
    """Helper to format an event object for the admin events list API."""
    dt_iso = event.event_date.isoformat()
    if event.event_date.tzinfo is None:
        dt_iso += "Z"
    return {
        "id": event.id,
        "title": event.title,
        "date": dt_iso,
        "location": event.location,
        "description": event.description,
        "total_seats": event.total_seats,
        "interested_count": event.interested_count,
        "going_count": event.going_count,
        "is_past": event.event_date < datetime.now(timezone.utc)
    }

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

from . import events_bp



# ==============================================================================
# EVENTS API ROUTES
# ==============================================================================

@events_bp.route("/events")
@login_required
def get_events():
    """Fetches all upcoming events and the current user's registration status for each."""
    user_id = session["user_id"]
    
    events = Event.query.filter(
        Event.event_date >= datetime.now(timezone.utc)
    ).order_by(Event.event_date.asc()).all()
    
    event_ids = [e.id for e in events]
    
    # Fetch all registrations for these events in one query
    registrations = EventRegistration.query.filter(
        EventRegistration.event_id.in_(event_ids)
    ).all() if event_ids else []
    
    # Pre-calculate counts in memory
    reg_data = {e_id: {'going': 0, 'interested': 0, 'user_status': None} for e_id in event_ids}
    for r in registrations:
        if r.status == 'going':
            reg_data[r.event_id]['going'] += 1
        elif r.status == 'interested':
            reg_data[r.event_id]['interested'] += 1
            
        if r.user_id == user_id:
            reg_data[r.event_id]['user_status'] = r.status
    
    events_data = []
    for event in events:
        data = reg_data[event.id]
        events_data.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "location": event.location,
            "eventDate": event.event_date.isoformat(),
            "totalSeats": event.total_seats,
            "availableSeats": max(0, event.total_seats - data["going"]),
            "goingCount": data["going"],
            "interestedCount": data["interested"],
            "userStatus": data["user_status"],
            "month": event.event_date.strftime("%b").upper(),
            "day": event.event_date.day,
            "time": event.event_date.strftime("%I:%M %p"),
            "dateTime": event.event_date.strftime("%B %d, %Y at %I:%M %p")
        })
    
    return jsonify(events_data)



@events_bp.route("/events/<int:event_id>/register", methods=["POST"])
@login_required
def register_for_event(event_id):
    """Registers, unregisters, or updates a user's status for an event ('going' or 'interested')."""
    user_id = session["user_id"]
    data = request.json
    status = data.get("status")  # 'going' or 'interested'
    
    if status not in ['going', 'interested']:
        return jsonify({"error": "Invalid status. Must be 'going' or 'interested'"}), 400
    
    # Security: Use `with_for_update()` to lock the event row during the transaction.
    # This prevents race conditions where two users join the last seat simultaneously.
    event = db.session.query(Event).with_for_update().filter_by(id=event_id).first()
    
    if not event:
        return jsonify({"error": "Event not found"}), 404
    
    if event.is_cancelled:
        return jsonify({"error": "Cannot register for a cancelled event"}), 400
    
    # Hardening: Prevent registration for past events
    event_date = event.event_date
    if event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=timezone.utc)
        
    if event_date < datetime.now(timezone.utc):
        return jsonify({"error": "Cannot register for a past event"}), 400
    
    # Check existing registration
    existing = EventRegistration.query.filter_by(
        event_id=event_id,
        user_id=user_id
    ).first()
    
    message = ""
    user_status = None
    status_code = 200

    if existing:
        # User wants to change status
        if existing.status == status:
            # Same status - remove registration (toggle off)
            db.session.delete(existing)
            message = "Registration cancelled"
            user_status = None
            status_code = 200
        else:
            # Different status - update
            # If changing from interested to going, check seats
            if status == 'going':                
                current_going = event.registrations.filter_by(status='going').count()
                if (event.total_seats - current_going) <= 0:
                    return jsonify({"error": "No seats available"}), 400
            
            existing.status = status
            message = f"Status updated to {status}"
            user_status = status
            status_code = 200
    else:
        # New registration
        if status == 'going':
            current_going = event.registrations.filter_by(status='going').count()
            if (event.total_seats - current_going) <= 0:
                return jsonify({"error": "No seats available"}), 400
        
        registration = EventRegistration(
            event_id=event_id,
            user_id=user_id,
            status=status
        )
        db.session.add(registration)
        message = f"Registered as {status}"
        user_status = status
        status_code = 201
    
    db.session.commit()
    
    # Re-query counts after the transaction to ensure the response is accurate.
    final_going = event.registrations.filter_by(status='going').count()
    final_interested = event.registrations.filter_by(status='interested').count()
    final_available = max(0, event.total_seats - final_going)
    
    return jsonify({
        "message": message,
        "userStatus": user_status,
        "availableSeats": final_available,
        "goingCount": final_going,
        "interestedCount": final_interested
    }), status_code


from flask import Blueprint, jsonify
from app.extensions import db
from sqlalchemy import text

health_bp = Blueprint('health', __name__)

@health_bp.route('/health')
def health_check():
    """
    Load balancer health check endpoint.
    Verifies that the application process is running and the database is reachable.
    """
    try:
        # Check database connection
        db.session.execute(text('SELECT 1'))
        
        return jsonify({
            "status": "ok",
            "service": "Campus Connect",
            "database": "ok"
        }), 200
        
    except Exception:
        return jsonify({
            "status": "error",
            "service": "Campus Connect",
            "database": "down",
            "message": "Database connection failed"
        }), 503

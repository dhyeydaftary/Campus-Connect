"""
Campus Connect — Application Factory
"""

from dotenv import load_dotenv
load_dotenv(override=True)

import os

from flask import Flask, redirect, url_for, session, request, flash, jsonify
from datetime import datetime, timezone
from sqlalchemy import event as sa_event

from app.extensions import db, bcrypt, mail, socketio, limiter, csrf, migrate
from app.config import Config


def create_app(test_config=None):
    """Create and configure the Flask application."""
    app = Flask(
        __name__,
        static_folder='../static',
        template_folder='../templates'
    )
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    # Configure Logging
    from app.logging_config import configure_logging
    configure_logging(app)

    if not app.secret_key:
        raise RuntimeError("SECRET_KEY not set. Check .env file.")
    if not app.config.get("SECURITY_PASSWORD_SALT"):
        raise RuntimeError("SECURITY_PASSWORD_SALT not set. Check .env and config.py.")
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL not set. Check .env file.")
    if not app.config.get("FRONTEND_URL"):
        raise RuntimeError("FRONTEND_URL not set. Check .env and config.py.")

    # Initialize extensions
    if app.config.get("TESTING"):
        app.config["REDIS_URL"] = None
        
    db.init_app(app)
    
    # Enable SQLite foreign key support
    if app.config.get("SQLALCHEMY_DATABASE_URI", "").startswith("sqlite"):
        with app.app_context():
            @sa_event.listens_for(db.engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

    migrate.init_app(app, db)
    bcrypt.init_app(app)
    mail.init_app(app)
    csrf.init_app(app)
    
    is_testing = os.environ.get("TESTING") == "true"
    redis_url = app.config.get("REDIS_URL")
    
    # Attempt to use Redis, but fall back to memory if server is unreachable
    use_redis = False
    if redis_url and not is_testing:
        try:
            import redis
            r = redis.from_url(redis_url)
            r.ping()
            use_redis = True
        except (ImportError, Exception):
            app.logger.warning("Redis is configured but unreachable. Falling back to memory storage.")
            use_redis = False

    if use_redis:
        socketio.init_app(app, cors_allowed_origins=[], message_queue=redis_url)
        app.config["RATELIMIT_STORAGE_URI"] = redis_url
    else:
        socketio.init_app(app, cors_allowed_origins=[])
        app.config["RATELIMIT_STORAGE_URI"] = "memory://"
        
    limiter.init_app(app)

    # User init event listener
    from app.models import User
    @sa_event.listens_for(User, 'init')
    def set_user_defaults(target, args, kwargs):
        account_type = kwargs.get('account_type')
        if 'is_password_set' not in kwargs:
            if account_type == 'admin':
                target.is_password_set = True
            elif account_type == 'student':
                target.is_password_set = False

    # Rate limit error handler
    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify(error="ratelimit exceeded", description=str(e.description)), 429

    # Context processor
    @app.context_processor
    def inject_global_template_vars():
        return {'current_year': datetime.now(timezone.utc).year}

    # Before request middleware
    @app.before_request
    def before_request_funcs():
        return enforce_user_state()

    def enforce_user_state():
        if 'user_id' not in session:
            return

        exempt_endpoints = [
            'main.home', 'auth.login_page', 'auth.logout', 'static', 'main.favicon',
            'auth.set_password_page', 'auth.update_password',
            'auth.reset_password_page', 'auth.reset_password_with_token'
        ]
        if request.endpoint in exempt_endpoints or (request.path and request.path.startswith('/api/auth/')):
            return

        user = db.session.get(User, session['user_id'])
        if not user:
            session.clear()
            return redirect(url_for('auth.login_page'))

        if user.status == "BLOCKED":
            session.clear()
            flash("Your account is blocked. Please contact administration.", "danger")
            return redirect(url_for('auth.login_page'))

        if user.status == "PENDING" and not user.is_password_set:
            return redirect(url_for('auth.set_password_page'))

    # Register blueprints
    from app.blueprints.auth.routes import auth_bp
    from app.blueprints.main.routes import main_bp
    from app.blueprints.admin.routes import admin_bp
    from app.blueprints.chat.routes import chat_bp
    from app.blueprints.support.routes import support_bp
    from app.blueprints.feed import feed_bp
    from app.blueprints.events import events_bp
    from app.blueprints.connections import connections_bp
    from app.blueprints.notifications import notifications_bp
    from app.blueprints.health import health_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(support_bp)
    app.register_blueprint(feed_bp, url_prefix="/api")
    app.register_blueprint(events_bp, url_prefix="/api")
    app.register_blueprint(connections_bp, url_prefix="/api")
    app.register_blueprint(notifications_bp, url_prefix="/api")
    app.register_blueprint(health_bp)

    # Initialize socket events
    from app.blueprints.chat.socket import init_socket_events
    init_socket_events(socketio)

    # Initialize comment queue service
    from app.services.comment_queue import comment_queue_service
    comment_queue_service.init_app(app)

    # Seed admin CLI command
    from app.services.seeder import seed_admin
    @app.cli.command("seed-admin")
    def seed_admin_command():
        """Seeds/Updates the admin user via CLI using .env credentials."""
        seed_admin()

    return app

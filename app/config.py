import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Flask application configuration"""

    # ==================================
    # CORE & SECURITY CONFIGURATION
    # ==================================
    SECRET_KEY = os.environ.get("SECRET_KEY")
    SECURITY_PASSWORD_SALT = os.environ.get("SECURITY_PASSWORD_SALT")
    FRONTEND_URL = os.environ.get("FRONTEND_URL")
    IS_PRODUCTION = os.environ.get('FLASK_ENV') == 'production'

    # Session Security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = IS_PRODUCTION

    # ==================================
    # DATABASE & CACHE CONFIGURATION
    # ==================================
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # For rate limiting in production, use a persistent storage backend like Redis.
    REDIS_URL = os.environ.get("REDIS_URL")

    # ==================================
    # FILE UPLOAD CONFIGURATION
    # ==================================
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB max file size
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    ALLOWED_DOC_EXTENSIONS = {'pdf', 'doc', 'docx'}

    # ==================================
    # EMAIL CONFIGURATION
    # ==================================
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', MAIL_USERNAME)

    # ==================================
    # STARTUP VALIDATION
    # ==================================
    # In production, we want to fail fast if critical configs are missing.
    if IS_PRODUCTION and not all([MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD]):
        raise RuntimeError("Production environment requires MAIL_SERVER, MAIL_USERNAME, and MAIL_PASSWORD to be set.")

    if not SQLALCHEMY_DATABASE_URI:
        raise RuntimeError("DATABASE_URL is not set in the environment.")
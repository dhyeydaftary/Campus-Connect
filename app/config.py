import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Flask application configuration"""

    # ==================================
    # CORE & SECURITY
    # ==================================
    SECRET_KEY = os.environ.get("SECRET_KEY")
    SECURITY_PASSWORD_SALT = os.environ.get("SECURITY_PASSWORD_SALT")
    FRONTEND_URL = os.environ.get("FRONTEND_URL")
    DEBUG = os.environ.get('FLASK_DEBUG', '0') in ('1', 'true', 'yes')
    IS_PRODUCTION = os.environ.get('FLASK_ENV', 'production') == 'production'

    # Session Security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = IS_PRODUCTION

    # ==================================
    # DATABASE
    # ==================================
    _db_url = os.environ.get("DATABASE_URL", "")
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url or None
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ==================================
    # CACHE / RATE LIMITING
    # ==================================
    REDIS_URL = os.environ.get("REDIS_URL")

    # ==================================
    # FILE UPLOADS
    # ==================================
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    ALLOWED_DOC_EXTENSIONS = {'pdf', 'doc', 'docx'}

    # ==================================
    # EMAIL
    # ==================================
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ('true', 'on', '1')
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or MAIL_USERNAME

    # ==================================
    # STARTUP VALIDATION
    # ==================================
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not set in the environment.")

    if not SECURITY_PASSWORD_SALT:
        raise RuntimeError("SECURITY_PASSWORD_SALT is not set in the environment.")

    if not SQLALCHEMY_DATABASE_URI:
        raise RuntimeError("DATABASE_URL is not set in the environment.")

    if IS_PRODUCTION and not all([MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD]):
        raise RuntimeError(
            "Production requires MAIL_SERVER, MAIL_USERNAME, and MAIL_PASSWORD."
        )
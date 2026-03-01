from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_mail import Mail
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
bcrypt = Bcrypt()
mail = Mail()
socketio = SocketIO(cors_allowed_origins=[], manage_session=False)
limiter = Limiter(
    get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

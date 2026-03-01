from flask import Blueprint

feed_bp = Blueprint('feed', __name__)

from . import routes

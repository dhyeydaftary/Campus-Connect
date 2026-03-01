from flask import Blueprint

events_bp = Blueprint('events', __name__)

from . import routes

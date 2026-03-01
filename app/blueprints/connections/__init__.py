from flask import Blueprint

connections_bp = Blueprint('connections', __name__)

from . import routes

from flask import Blueprint

trust = Blueprint('trust', __name__)

from . import routes

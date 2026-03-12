# Troubleshooting Guide

Common issues and their solutions when developing or operating Campus Connect.

## Table of Contents

- [Installation & Setup](#installation--setup)
- [Runtime Errors](#runtime-errors)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [WebSocket Issues](#websocket-issues)
- [Deployment Issues](#deployment-issues)
- [Email Issues](#email-issues)
- [Debugging Tips](#debugging-tips)

---

## Installation & Setup

### Python version incompatibility

**Error:** `Python version 3.7 is not supported`

**Solution:**
```bash
# Check your Python version
python --version

# Install Python 3.8+ from https://www.python.org/downloads/
# On some systems, use python3 instead of python
python3 --version
```

---

### PostgreSQL connection error

**Error:** `could not connect to server: Connection refused`

**Solution:**
1. Ensure PostgreSQL is running:
   ```bash
   # Mac
   brew services start postgresql

   # Linux
   sudo systemctl start postgresql

   # Windows
   net start postgresql-x64-14
   ```
2. Verify `DATABASE_URL` in `.env` is correct
3. Ensure `psycopg2-binary` is installed: `pip install psycopg2-binary`
4. Test connection: `psql $DATABASE_URL`

---

### Redis connection error

**Error:** `ConnectionError: Error connecting to localhost:6379`

**Solution:**
1. Ensure Redis is running:
   ```bash
   # Mac
   brew services start redis

   # Linux
   sudo systemctl start redis-server
   ```
2. Check `REDIS_URL` in `.env`

> **Note:** Campus Connect will fall back to in-memory storage if Redis is unavailable. The app will still start, but WebSocket message queuing won't be distributed.

---

### Missing dependencies

**Error:** `ModuleNotFoundError: No module named 'flask'`

**Solution:**
```bash
# Ensure you're in the virtual environment
# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

### Port already in use

**Error:** `Address already in use (port 5000)`

**Solution:**
```bash
# Linux/Mac — find and kill the process
lsof -i :5000
kill <PID>

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

---

### Missing environment variables

**Error:** `RuntimeError: SECRET_KEY not set. Check .env file.`

**Solution:**
1. Copy the example file: `cp .env.example .env`
2. Fill in all required values (see `.env.example` for the full list)
3. Ensure `.env` is in the project root directory
4. Restart the application

---

## Runtime Errors

### ImportError on startup

**Error:** `ImportError: cannot import name 'x' from 'y'`

**Solution:**
- Check for circular imports between modules
- Verify all `__init__.py` files are present in package directories
- Ensure all blueprint modules are properly imported in `app/__init__.py`

---

### Database tables don't exist

**Error:** `sqlalchemy.exc.ProgrammingError: relation "users" does not exist`

**Solution:**
```bash
# Apply database migrations
flask db upgrade

# If migrations don't exist yet
flask db stamp head
flask db migrate -m "initial_schema"
flask db upgrade
```

---

### Target database is not up to date

**Error:** `alembic.util.exc.CommandError: Target database is not up to date`

**Solution:**
```bash
# Stamp the database to the current state
flask db stamp head

# Then generate new migration
flask db migrate -m "description"
```

---

## Database Issues

### Migration fails to apply

**Error:** Various errors during `flask db upgrade`

**Solution:**
1. Check the migration file for syntax errors
2. Verify `DATABASE_URL` is correct
3. Try rolling back and re-applying:
   ```bash
   flask db downgrade
   flask db upgrade
   ```
4. If severely broken, stamp to skip:
   ```bash
   flask db stamp head
   ```

---

### Data loss during migration

**Prevention:**
```bash
# Always backup before major migrations
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**Recovery:**
```bash
# Restore from backup
psql $DATABASE_URL < backup.sql
```

---

### Foreign key constraint errors

**Error:** `IntegrityError: violates foreign key constraint`

**Solution:**
- Ensure referenced records exist before inserting
- Check `ondelete` behavior in model definitions (`CASCADE`, `SET NULL`)
- Use `db.session.rollback()` to recover from the error

---

## Performance Issues

### Slow queries

**Diagnosis:**
```python
# Enable SQL query logging temporarily
import logging
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

**Common fixes:**
- Add indexes on frequently queried columns
- Use eager loading to prevent N+1 queries:
  ```python
  from sqlalchemy.orm import joinedload
  posts = Post.query.options(joinedload(Post.user)).all()
  ```
- Add pagination to list queries
- Check query plans: `EXPLAIN ANALYZE <query>` in PostgreSQL

---

### High memory usage

**Common causes:**
- Loading too many ORM objects at once (use pagination)
- Circular references in relationships
- File uploads stored in memory

**Solutions:**
- Use `.paginate()` for all list queries
- Use generators where possible
- Set file upload size limits in configuration

---

## WebSocket Issues

### Connection fails

**Error:** `WebSocket connection to 'ws://...' failed`

**Solution:**
1. Verify Flask-SocketIO is installed: `pip list | grep flask-socketio`
2. Ensure Redis is running (required for multi-worker WebSocket support)
3. Check browser console for specific error messages
4. Verify CORS settings in `socketio.init_app(app, cors_allowed_origins=[...])`

---

### Messages not arriving

**Diagnosis:**
1. Check server logs for WebSocket errors
2. Verify client is connecting to the correct namespace
3. Ensure the user has joined the correct room (`join_chat` event)
4. Check the browser's Network tab → WS filter for frame inspection

**Solution:**
- Ensure both `join_chat` and `send_message` use the same `conversation_id`
- Verify the user is authenticated (has a valid session cookie)
- Check that the user is a participant in the conversation

---

## Deployment Issues

### App fails to start

**Common causes:**
1. Missing environment variables — check all required vars are set
2. Database not accessible — verify `DATABASE_URL`
3. Redis not accessible — app falls back to memory, but check logs
4. Port misconfiguration — ensure `PORT` env var matches your host

**Debugging:**
```bash
# Check application logs
tail -f logs/app.log

# On Render: Dashboard → Service → Logs
```

---

### Static files not loading (404)

**Solution:**
1. Verify `static_folder` is correctly configured in the app factory
2. Check that static files exist in the `static/` directory
3. Ensure your deployment platform serves the static directory

---

### Database connection fails in production

**Error:** `FATAL: password authentication failed`

**Solution:**
1. Verify `DATABASE_URL` is correct and includes the right credentials
2. Check that the database user has proper permissions
3. Ensure the database server allows connections from your app's IP
4. Test the connection string locally: `psql $DATABASE_URL`

---

## Email Issues

### OTP email not sending

**Error:** `SMTPAuthenticationError`

**Solution:**
1. Verify `MAIL_SERVER` is correct (e.g., `smtp.gmail.com`)
2. For Gmail, use an **App Password** (not your regular password):
   - Go to Google Account → Security → 2-Step Verification → App Passwords
   - Generate a password for "Mail" and use it as `MAIL_PASSWORD`
3. Check that `MAIL_USERNAME` matches the sender email
4. Verify `MAIL_PORT=587` and `MAIL_USE_TLS=true`

---

### OTP not received

**Possible causes:**
1. Email landed in spam — check Spam/Junk folder
2. Email address is incorrect — verify in the database
3. SMTP server is rate-limiting — wait and retry
4. App password expired — regenerate it

---

## Debugging Tips

### Enable Debug Mode

```bash
# Set in .env
FLASK_ENV=development
FLASK_DEBUG=True

# Then run
python run.py
```

This enables the Werkzeug debugger and auto-reload on code changes.

---

### View Application Logs

```bash
# Development (file logging is disabled in debug mode — logs go to console)
python run.py

# Production (file logging enabled)
tail -f logs/app.log

# On hosted platforms
# Check platform dashboard for log viewer
```

---

### Use Flask Shell

```bash
flask shell
```

```python
# Inside the shell
from app.models import User, Post

# Query users
users = User.query.all()
print(f"Total users: {len(users)}")

# Find a specific user
user = User.query.filter_by(email="john@university.edu").first()
print(user.full_name, user.status)

# Check database state
from app.extensions import db
db.session.execute(db.text("SELECT count(*) FROM users")).scalar()
```

---

### Database Query Logging

Add this to your configuration temporarily to see all SQL queries:

```python
import logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

---

### Browser Developer Tools

1. **F12** — Open developer tools
2. **Network tab** — Inspect API requests, response codes, and payloads
3. **Console tab** — Check for JavaScript errors
4. **WS filter** (in Network) — Inspect WebSocket frames for chat debugging
5. **Application tab** — View cookies and session data

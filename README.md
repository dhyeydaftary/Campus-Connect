<p align="center">
  <h1 align="center">🎓 Campus Connect</h1>
  <p align="center">
    <strong>A full-stack, real-time social networking platform built for university communities</strong>
  </p>
  <p align="center">
    Modern Flask architecture · WebSocket messaging · Production-grade infrastructure
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/flask-3.x-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask">
  <img src="https://img.shields.io/badge/postgresql-13+-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/socket.io-real%20time-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.IO">
  <img src="https://img.shields.io/badge/redis-queue-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/pytest-333%20tests-0A9EDC?style=flat-square&logo=pytest&logoColor=white" alt="Tests">
  <img src="https://img.shields.io/badge/coverage-83%25+-brightgreen?style=flat-square" alt="Coverage">
  <img src="https://img.shields.io/badge/deployed%20on-render-46E3B7?style=flat-square&logo=render&logoColor=white" alt="Render">
  <img src="https://img.shields.io/badge/gunicorn-eventlet-499848?style=flat-square&logo=gunicorn&logoColor=white" alt="Gunicorn">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
</p>

<p align="center">
  <a href="https://github.com/dhyeydaftary/Campus-Connect">
    <img src="https://img.shields.io/github/last-commit/dhyeydaftary/Campus-Connect?style=flat-square&label=last%20commit" alt="Last Commit">
  </a>
  <a href="https://github.com/dhyeydaftary/Campus-Connect">
    <img src="https://img.shields.io/github/repo-size/dhyeydaftary/Campus-Connect?style=flat-square&label=repo%20size" alt="Repo Size">
  </a>
  <a href="https://github.com/dhyeydaftary/Campus-Connect/stargazers">
    <img src="https://img.shields.io/github/stars/dhyeydaftary/Campus-Connect?style=flat-square" alt="Stars">
  </a>
  <a href="https://github.com/dhyeydaftary/Campus-Connect/network/members">
    <img src="https://img.shields.io/github/forks/dhyeydaftary/Campus-Connect?style=flat-square" alt="Forks">
  </a>
  <a href="https://github.com/dhyeydaftary/Campus-Connect/issues">
    <img src="https://img.shields.io/github/issues/dhyeydaftary/Campus-Connect?style=flat-square" alt="Issues">
  </a>
  <a href="https://github.com/dhyeydaftary/Campus-Connect/pulls">
    <img src="https://img.shields.io/github/issues-pr/dhyeydaftary/Campus-Connect?style=flat-square" alt="Pull Requests">
  </a>
</p>

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Overview](#project-overview)
- [Core Features](#core-features)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Installation Guide](#installation-guide)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)
- [Running Tests](#running-tests)
- [API Overview](#api-overview)
- [Real-Time Features](#real-time-features)
- [Deployment](#deployment)
- [Security Features](#security-features)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [License](#license)
- [Authors](#authors)
- [Acknowledgments](#acknowledgments)

---

## Quick Start

Get up and running in under 5 minutes:

```bash
# Clone & setup
git clone https://github.com/dhyeydaftary/Campus-Connect.git
cd Campus-Connect
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure
cp .env.example .env   # Edit with your database/email credentials

# Database
flask db upgrade
flask seed-admin

# Run
python run.py          # → http://localhost:5000
```

> **Prerequisites**: Python 3.9+, PostgreSQL 13+, Redis 6+ (optional, falls back to memory)
>
> See the [Installation Guide](#-installation-guide) for detailed setup instructions.

---

## Project Overview

### What is Campus Connect?

Campus Connect is a **production-ready social networking platform** purpose-built for university communities. It combines the social engagement of Instagram-style feeds with LinkedIn-style professional profiles, real-time messaging, campus event management, and robust admin governance — all within a single, unified application.

### Problem Statement

University students lack a **dedicated, private platform** that serves both their social and professional networking needs within their campus ecosystem. Generic social media is too broad, LinkedIn is too corporate, and WhatsApp groups lack structure. Campus Connect fills this gap by providing a campus-scoped platform with features tailored to student life.

### Key Capabilities

| Capability | Description |
|-----------|-------------|
| 🔐 **Secure OTP Authentication** | Email-based one-time passwords using cryptographically secure generation |
| 📰 **Social Feed** | Create, like, and comment on posts with image/document attachments |
| 💬 **Real-Time Chat** | WebSocket-powered private messaging with typing indicators and read receipts |
| 🤝 **Connection Network** | LinkedIn-style connection requests, suggestions, and relationship management |
| 🎉 **Event Management** | Discover events, RSVP as "going" or "interested," with live seat tracking |
| 👤 **Professional Profiles** | Skills, experiences, education, bio, and profile completeness scoring |
| 🔔 **Smart Notifications** | Real-time alerts for likes, comments, connections, and system announcements |
| ⚙️ **Admin Dashboard** | Full user management, analytics, event creation, announcements, and audit logs |
| 📡 **REST API** | 90+ documented endpoints across 10 domain-specific blueprints |
| 🏥 **Health Monitoring** | Load balancer health check with database connectivity verification |

### Why This Architecture?

Campus Connect uses a **monolithic MVC architecture** with Flask's blueprint system — the sweet spot between simplicity and modularity for a project of this scale.

- **Blueprint-per-domain** keeps each feature isolated and testable
- **Service layer** separates business logic from route handlers
- **WebSocket layer** enables instant messaging without polling overhead
- **PostgreSQL** provides reliable ACID-compliant data persistence
- **Application factory pattern** enables clean configuration and testing

---

## Core Features

### 🔐 Authentication & Security

- **OTP-based login** — Cryptographically secure 6-digit OTPs via `secrets` module
- **Password authentication** — Bcrypt hashing with strength enforcement
- **Password reset** — Time-sensitive, signed token-based flow via email
- **Session management** — Secure cookies with `HttpOnly`, `SameSite` flags
- **CSRF protection** — All forms and state-changing requests protected via Flask-WTF
- **Rate limiting** — Login endpoint throttling to prevent brute-force attacks
- **Role-based access** — Separate student and admin authorization paths

### 👤 User Profiles & Discovery

- Comprehensive profiles with bio, skills, experience, and education (full CRUD)
- Profile photo uploads with server-side validation and sanitization
- Profile completeness scoring with actionable improvement suggestions
- Global search across users and announcements
- Connection-aware profile views (shows relationship status)

### 💬 Real-Time Chat System

- **WebSocket-powered** via Flask-SocketIO with eventlet worker
- Direct messaging between connected users
- Typing indicators broadcast to conversation participants
- Read receipts with `messages_read` events
- File/document sharing within conversations
- Unread message count tracking
- Automatic room management (`join_chat`, `leave_chat`)

### 🎉 Event Management

- Browse upcoming events sorted by date
- RSVP system with "going" and "interested" statuses (toggleable)
- Real-time seat availability tracking with row-level locking (race-condition safe)
- Past event protection — cannot register for expired events
- Admin event creation with delegated organizer support
- Event participant PDF export

### 🔔 Notification System

- Real-time in-app notifications for likes, comments, connections, and system events
- Unread count endpoint (rate-limit exempt for frequent polling)
- Mark individual or all notifications as read
- Bulk clear functionality
- Actor metadata with profile pictures

### 🤝 Connection System

- Send, accept, and reject connection requests
- Intelligent connection suggestions based on mutual connections and activity
- View pending received/sent requests
- Remove existing connections
- Re-send previously rejected requests

### 📰 Feed System

- Algorithmically ranked post feed with pagination
- Post creation with photo/document uploads
- Like system with toggle behavior and notification triggers
- Asynchronous comment processing via background queue
- Post attachment downloads
- User-specific post feeds on profile pages

### ⚙️ Admin Dashboard

- Dashboard analytics (user counts, growth trends, activity metrics)
- User management (view details, block/unblock accounts)
- Event creation, editing, and participant management
- Announcement CRUD with soft-delete and restore
- Audit log viewer with full-history download (text export)
- Event participant PDF report generation

### 🔄 Background Processing

- **Comment queue service** — Asynchronous comment processing to keep API responses fast
- **Email service** — OTP delivery, welcome emails, and password reset links
- **Database seeder** — Admin user initialization via CLI command (`flask seed-admin`)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (Jinja2 + Tailwind CSS + JS)       │
│    Templates: auth, main, admin, chat, support, emails   │
│    Static: CSS pages/admin, JS core/features/pages       │
├─────────────────────────────────────────────────────────┤
│              Flask Application Server                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Blueprints (10 Domain Modules)                    │  │
│  │                                                     │  │
│  │  auth · main · feed · events · connections          │  │
│  │  notifications · chat · admin · support · health    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Service Layer                                     │  │
│  │  email_service · comment_queue · seeder            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Utilities                                         │  │
│  │  decorators (login_required, admin_required)       │  │
│  │  helpers (formatting, file handling, avatars)       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Extensions                                        │  │
│  │  SQLAlchemy · Bcrypt · Mail · SocketIO · Limiter   │  │
│  │  CSRF · Migrate                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Models (18 Tables via SQLAlchemy ORM)             │  │
│  │  User · Post · Comment · Like · Event · Message    │  │
│  │  Conversation · Connection · Notification · ...     │  │
│  └────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Flask-SocketIO (WebSocket)     │  Redis (Queue/Cache)  │
├─────────────────────────────────────────────────────────┤
│              PostgreSQL Database                         │
└─────────────────────────────────────────────────────────┘
```

### Blueprint Architecture

Each blueprint encapsulates a single domain, with its own routes, and shares models and services via the application context:

| Blueprint | URL Prefix | Routes | Responsibility |
|-----------|-----------|--------|---------------|
| `auth` | `/` | 13 | Registration, OTP login, password management |
| `main` | `/` | 17 | Landing, home, profiles, search, skills/experience CRUD |
| `feed` | `/api` | 7 | Post CRUD, likes, comments, downloads |
| `events` | `/api` | 2 | Event listing, registration with seat tracking |
| `connections` | `/api` | 8 | Requests, suggestions, connection management |
| `notifications` | `/api` | 5 | Fetch, mark read, clear notifications |
| `chat` | `/` | 10 | Conversations, messages, file uploads |
| `admin` | `/` | 22 | Dashboard, user/event/announcement management |
| `support` | `/` | 8 | Legal, privacy, help center, trust pages |
| `health` | `/` | 1 | Load balancer health check |

### Database Schema

18 tables with full referential integrity:

```
users ─────────┬──── posts ──────── likes
               │         └──────── comments
               ├──── connections
               ├──── connection_requests
               ├──── conversations ── messages
               ├──── notifications
               ├──── event_registrations ── events
               ├──── skills
               ├──── experiences
               ├──── educations
               ├──── otp_verifications
               └──── user_blocks

announcements (standalone)
admin_logs (standalone)
```

### Test Architecture

333 tests organized across 31 test files:

| Category | Files | Focus |
|----------|-------|-------|
| API Integration | `test_api_*.py` (11) | Endpoint behavior, auth, CRUD |
| Unit Tests | `test_models.py`, `test_helpers.py`, `test_decorators.py` | Model logic, utilities |
| Security | `test_security.py`, `test_security_edges.py`, `test_abuse_cases.py` | Injection, XSS, edge cases |
| Services | `test_services_*.py` (5) | Email, queue, seeder |
| Feature | `test_feed.py`, `test_events.py`, `test_connections.py`, etc. | End-to-end feature flows |
| Fuzz | `test_api_fuzz_inputs.py` | Malformed input resilience |

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| [Python](https://python.org) | 3.9+ | Core programming language |
| [Flask](https://flask.palletsprojects.com) | 3.1 | Web framework |
| [SQLAlchemy](https://sqlalchemy.org) | 2.0 | ORM &amp; database toolkit |
| [Flask-Migrate](https://flask-migrate.readthedocs.io) | 4.1 | Database migration management (Alembic) |
| [Flask-SocketIO](https://flask-socketio.readthedocs.io) | 5.3 | WebSocket real-time communication |
| [Flask-Bcrypt](https://flask-bcrypt.readthedocs.io) | 1.0 | Password hashing |
| [Flask-Mail](https://pythonhosted.org/Flask-Mail/) | 0.9 | Email delivery (SMTP) |
| [Flask-Limiter](https://flask-limiter.readthedocs.io) | 4.1 | API rate limiting |
| [Flask-WTF](https://flask-wtf.readthedocs.io) | 1.2 | CSRF protection |
| [Gunicorn](https://gunicorn.org) | 25.1 | Production WSGI server |
| [Eventlet](https://eventlet.net) | 0.33 | Async worker for WebSocket support |
| [Redis](https://redis.io) | 7.2 | Message queue, rate limit storage |
| [ReportLab](https://reportlab.com) | 4.4 | PDF generation |
| [Pillow](https://pillow.readthedocs.io) | 12.1 | Image processing |

### Frontend

| Technology | Purpose |
|-----------|---------|
| [Jinja2](https://jinja.palletsprojects.com) 3.1 | Server-side templating |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first CSS framework |
| Vanilla JavaScript | Client-side interactivity |

### Database

| Technology | Purpose |
|-----------|---------|
| [PostgreSQL](https://postgresql.org) 13+ | Production relational database |
| SQLite | In-memory test database |

### Testing & Quality

| Tool | Purpose |
|------|---------|
| [pytest](https://pytest.org) 8.3 | Test framework |
| [pytest-cov](https://pytest-cov.readthedocs.io) 7.0 | Coverage reporting |
| [pytest-flask](https://pytest-flask.readthedocs.io) 1.3 | Flask test utilities |
| [pytest-timeout](https://pypi.org/project/pytest-timeout/) 2.4 | Test timeout enforcement |
| [pytest-xdist](https://pypi.org/project/pytest-xdist/) 3.8 | Parallel test execution |

---

## Repository Structure

```
Campus-Connect/
├── app/                            # Application package
│   ├── blueprints/                 # Domain-specific route modules
│   │   ├── admin/                  #   Admin dashboard & management
│   │   ├── auth/                   #   Authentication & authorization
│   │   ├── chat/                   #   Messaging (HTTP + WebSocket)
│   │   ├── connections/            #   Connection request management
│   │   ├── events/                 #   Event listing & registration
│   │   ├── feed/                   #   Post CRUD, likes, comments
│   │   ├── main/                   #   Pages, profiles, search
│   │   ├── notifications/          #   Notification management
│   │   ├── support/                #   Legal & help pages
│   │   └── health.py               #   Load balancer health check
│   ├── services/                   # Business logic layer
│   │   ├── comment_queue.py        #   Async comment processing
│   │   ├── email_service.py        #   OTP, welcome, reset emails
│   │   └── seeder.py               #   Admin user seeding
│   ├── utils/                      # Shared utilities
│   │   ├── decorators.py           #   @login_required, @admin_required
│   │   └── helpers.py              #   Formatting, file handling
│   ├── __init__.py                 # Application factory (create_app)
│   ├── config.py                   # Configuration from environment
│   ├── extensions.py               # Flask extension instances
│   ├── logging_config.py           # RotatingFileHandler setup
│   └── models.py                   # SQLAlchemy models (18 tables)
├── docs/                           # Documentation
│   ├── API.md                      #   Complete API reference
│   ├── MIGRATIONS.md               #   Database migration guide
│   └── TROUBLESHOOTING.md          #   Common issues & solutions
├── migrations/                     # Alembic migration versions
├── scripts/                        # Utility scripts
│   ├── reset_db.py                 #   Database reset
│   ├── seed_admin.py               #   Admin seeding
│   └── seed_users.py               #   Sample user generation
├── static/                         # Frontend assets
│   ├── css/                        #   Stylesheets (base, components, layout, navbar)
│   ├── js/                         #   JavaScript (admin, core, features, pages)
│   ├── images/                     #   Static images
│   └── uploads/                    #   User-uploaded content
├── templates/                      # Jinja2 templates
│   ├── admin/                      #   Admin dashboard pages
│   ├── auth/                       #   Login, register, password pages
│   ├── emails/                     #   Email templates (OTP, welcome, reset)
│   ├── landing/                    #   Landing page
│   ├── layouts/                    #   Base layout templates
│   ├── legal/                      #   Legal policy pages
│   ├── main/                       #   Home, profile, messages, post
│   ├── partials/                   #   Reusable template fragments
│   ├── support/                    #   Help center, report issue
│   └── trust/                      #   Data protection, security
├── tests/                          # Test suite (31 files, 333 tests)
├── .env.example                    # Environment variable template
├── Procfile                        # Gunicorn + eventlet config
├── pytest.ini                      # Pytest configuration
├── requirements.txt                # Python dependencies (60+ packages)
├── run.py                          # Development server entry point
└── wsgi.py                         # Production WSGI entry point
```

---

## Installation Guide

### Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| Python | 3.9+ | `python --version` |
| PostgreSQL | 13+ | `psql --version` |
| Redis | 6+ (optional) | `redis-cli ping` |
| pip | Latest | `pip --version` |
| Git | Any | `git --version` |

### Step 1: Clone Repository

```bash
git clone https://github.com/dhyeydaftary/Campus-Connect.git
cd Campus-Connect
```

### Step 2: Create Virtual Environment

```bash
# macOS / Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your specific values. See [Environment Variables](#-environment-variables) for the full reference.

### Step 5: Initialize Database

```bash
# Create the database (PostgreSQL)
createdb campus_connect

# Apply migrations
flask db upgrade

# Seed initial admin user
flask seed-admin
```

### Step 6: Start the Application

```bash
python run.py
```

Visit **http://localhost:5000** — you're ready to go! 🎉

### Step 7: Verify Installation

```bash
# Run test suite
pytest

# Check health endpoint
curl http://localhost:5000/health
```

---

## Environment Variables

Create a `.env` file from the provided template. All variables are documented in `.env.example`.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Flask session encryption key | Random 32+ char string |
| `SECURITY_PASSWORD_SALT` | Password hashing salt | Random 32+ char string |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://user:pass@localhost:5432/campus_connect` |
| `FRONTEND_URL` | Application base URL | `http://localhost:5000` |
| `MAIL_SERVER` | SMTP server | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USE_TLS` | Enable TLS | `true` |
| `MAIL_USERNAME` | Sender email | `your-email@gmail.com` |
| `MAIL_PASSWORD` | App-specific password | Gmail App Password |
| `MAIL_DEFAULT_SENDER` | Default from address | `your-email@gmail.com` |
| `ADMIN_EMAIL` | Initial admin email | `admin@campus.edu` |
| `ADMIN_PASSWORD` | Initial admin password | Strong password |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_ENV` | Environment mode | `production` |
| `FLASK_DEBUG` | Debug mode | `False` |
| `REDIS_URL` | Redis connection URI | Falls back to memory |

> **⚠️ Security**: Never commit `.env` to version control. Always use strong, unique values in production. Rotate secrets regularly.

---

## Running the Application

### Development Mode

```bash
source venv/bin/activate    # Activate virtual environment
python run.py               # Start with auto-reload and debug pages
```

Features: Auto-reload on code changes, detailed error pages, console logging.

### Production Mode

```bash
gunicorn -k eventlet -w 4 --bind 0.0.0.0:8000 wsgi:app
```

Or use the included Procfile (used by Render/Heroku):

```
web: gunicorn -k eventlet -w 4 wsgi:app
```

### Verify Application

| Endpoint | Expected |
|----------|----------|
| `http://localhost:5000` | Landing page |
| `http://localhost:5000/health` | `{"status": "ok", "database": "ok"}` |
| `http://localhost:5000/login` | Login page |

---

## Database Setup

### Creating the Database

```bash
# Option 1: CLI
createdb campus_connect

# Option 2: psql
psql -U postgres -c "CREATE DATABASE campus_connect;"
```

### Running Migrations

```bash
flask db upgrade              # Apply all pending migrations
flask db current              # Check current revision
flask db history              # View migration history
```

### Migration Workflow

```bash
# 1. Edit app/models.py
# 2. Generate migration
flask db migrate -m "add headline to users"
# 3. Review the generated file in migrations/versions/
# 4. Apply
flask db upgrade
# 5. Test rollback
flask db downgrade && flask db upgrade
```

### Database Seeding

```bash
flask seed-admin              # Create initial admin user from .env credentials
```

### Backups

```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup.sql
```

> 📖 See [docs/MIGRATIONS.md](docs/MIGRATIONS.md) for the complete migration guide.

---

## Running Tests

### Full Test Suite

```bash
pytest                        # Run all 333 tests
pytest -v                     # Verbose output
pytest --tb=short             # Shorter tracebacks
```

### Selective Testing

```bash
pytest tests/test_api_auth.py                  # Single file
pytest tests/test_api_auth.py::test_login      # Single test
pytest -k "test_post"                          # Pattern match
pytest tests/test_security.py tests/test_abuse_cases.py  # Multiple files
```

### Coverage Analysis

```bash
pytest --cov=app --cov-report=term-missing     # Terminal report
pytest --cov=app --cov-report=html             # HTML report → htmlcov/index.html
```

### Test Metrics

| Metric | Value |
|--------|-------|
| **Total Tests** | 333 |
| **Coverage** | 83%+ |
| **Test Files** | 31 |
| **Database** | SQLite in-memory |
| **Minimum Threshold** | 72% (enforced in `pytest.ini`) |

### Test Categories

| Category | Count | Focus |
|----------|-------|-------|
| API Integration | 149 | Endpoint request/response validation |
| Security | 38 | Injection, XSS, abuse, edge cases |
| Unit | 38 | Models, helpers, decorators, integrity |
| Services | 41 | Email, queue, seeder services |
| Feature | 67 | Auth, feed, events, connections, chat, profiles |

---

## API Overview

Campus Connect exposes **90+ REST API endpoints** across 10 blueprints. Full documentation is available in [docs/API.md](docs/API.md).

### Endpoint Summary

| Domain | Prefix | Key Endpoints |
|--------|--------|--------------|
| **Auth** | `/api/auth/` | `register`, `request-otp`, `verify-otp`, `login`, `forgot-password` |
| **Profile** | `/api/profile/` | `me`, `<user_id>`, `photo`, `skills`, `experiences`, `educations`, `bio` |
| **Feed** | `/api/posts` | `GET` (feed), `POST /create`, `POST /<id>/like`, `GET/POST /<id>/comments` |
| **Events** | `/api/events` | `GET` (list), `POST /<id>/register` |
| **Connections** | `/api/connections/` | `request`, `accept/<id>`, `reject/<id>`, `pending`, `sent`, `list` |
| **Notifications** | `/api/notifications` | `GET`, `unread-count`, `mark-read/<id>`, `mark-all-read`, `clear` |
| **Chat** | `/api/chats/` | `GET`, `start`, `<id>/messages`, `message`, `upload`, `search-users` |
| **Search** | `/api/search` | `GET ?q=query` |
| **Health** | `/health` | `GET` (no auth required) |

### Error Format

```json
{
  "error": "Description of the error"
}
```

### Rate Limiting

| Scope | Limit |
|-------|-------|
| Login endpoints | 5 per 15 minutes |
| General API | 200/day, 50/hour |
| Notification polling | Exempt |

> 📖 Full API reference with request/response examples: [docs/API.md](docs/API.md)

---

## Real-Time Features

Campus Connect uses **Flask-SocketIO** with the **eventlet** async worker for WebSocket communication.

### Connection

```javascript
const socket = io('http://localhost:5000');
// Authentication is handled via session cookie
```

### Socket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_chat` | `{ conversation_id }` | Join a chat room |
| `leave_chat` | `{ conversation_id }` | Leave a chat room |
| `send_message` | `{ conversation_id, content, recipient_id }` | Send a message |
| `mark_read` | `{ conversation_id }` | Mark messages as read |
| `typing` | `{ conversation_id }` | Broadcast typing indicator |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `joined` | `{ status, room }` | Room join confirmation |
| `new_message` | `{ id, sender_id, sender_name, content, created_at }` | Incoming message |
| `messages_read` | `{ conversation_id, read_by }` | Read receipt |
| `user_typing` | `{ conversation_id, user_id }` | Typing indicator |
| `error` | `{ message }` | Error notification |

### Architecture Details

- **Room-based messaging** — Each conversation gets a dedicated room (`chat_<id>`)
- **Access control** — Users can only join rooms for conversations they participate in
- **Fallback** — Long-polling fallback when WebSocket is unavailable
- **Redis queue** — Message queue for multi-worker deployments

---

## Deployment

Campus Connect is production-ready with Gunicorn + eventlet workers.

### Render Deployment

1. **Connect GitHub** — Link your repository to Render
2. **Configure service**:
   - **Build Command**: `pip install -r requirements.txt && flask db upgrade`
   - **Start Command**: `gunicorn -k eventlet -w 4 wsgi:app`
3. **Set environment variables** — Add all required `.env` values
4. **Create PostgreSQL** — Use Render's managed PostgreSQL add-on
5. **Deploy** — Push to your connected branch

### Procfile

```
web: gunicorn -k eventlet -w 4 wsgi:app
```

### Production Checklist

- [ ] `SECRET_KEY` is a strong random string (not the default)
- [ ] `SECURITY_PASSWORD_SALT` is unique for the deployment
- [ ] `FLASK_DEBUG=False` and `FLASK_ENV=production`
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] HTTPS is enforced (Render provides free SSL)
- [ ] Email credentials are set and tested
- [ ] `flask db upgrade` runs successfully
- [ ] `/health` endpoint returns `200 OK`
- [ ] Logs are being written to `logs/app.log`
- [ ] Redis is configured (or memory fallback is acceptable)

### Production Logging

In production mode (`FLASK_DEBUG=False`), Campus Connect automatically:
- Writes logs to `logs/app.log` via `RotatingFileHandler`
- Rotates at **10MB** with **10 backups**
- Format: `[timestamp] LEVEL in filepath:line: message`

---

## Security Features

| Layer | Implementation |
|-------|---------------|
| **Authentication** | OTP via `secrets.choice()`, Bcrypt password hashing |
| **Authorization** | `@login_required`, `@admin_required` decorators |
| **CSRF** | Flask-WTF CSRF tokens on all state-changing requests |
| **SQL Injection** | Prevented via SQLAlchemy ORM parameterized queries |
| **XSS** | Jinja2 auto-escaping enabled by default |
| **Rate Limiting** | Flask-Limiter on login endpoints (5/15min) |
| **Session Security** | `HttpOnly`, `SameSite=Lax`, `Secure` in production |
| **Input Validation** | Server-side validation on all API endpoints |
| **File Upload** | `werkzeug.utils.secure_filename` + size limits |
| **Password Strength** | Minimum length and complexity enforcement |
| **Row-Level Locking** | `with_for_update()` on event seat allocation |
| **Audit Logging** | Admin actions recorded with timestamp and actor |

---

## Performance Considerations

- **N+1 Prevention** — `joinedload()` used for eager loading on feed and event queries
- **Pagination** — All list endpoints paginated to prevent large result sets
- **In-Memory Calculations** — Event registration counts computed in-memory after batch query
- **Async Comments** — Comments processed via background queue to keep API responses fast
- **Connection Pooling** — SQLAlchemy manages database connection pools
- **Log Rotation** — `RotatingFileHandler` prevents unbounded disk usage
- **Redis Fallback** — Graceful degradation to memory when Redis is unavailable

---

## Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| `SECRET_KEY not set` | Copy `.env.example` to `.env` and fill in values |
| `relation "users" does not exist` | Run `flask db upgrade` |
| `Redis connection refused` | App falls back to memory — this is normal for dev |
| `SMTPAuthenticationError` | Use a Gmail App Password, not your regular password |
| `Address already in use (5000)` | Kill existing process on port 5000 |
| `ModuleNotFoundError` | Activate virtual environment and run `pip install -r requirements.txt` |
| WebSocket won't connect | Ensure eventlet is installed and Redis is running |
| Tests failing | Run `pytest -v --tb=long` for detailed output |

> 📖 Full troubleshooting guide: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## Future Improvements

### Planned

- [ ] Docker containerization and `docker-compose` setup
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Sentry error tracking integration
- [ ] Elasticsearch for advanced search
- [ ] CDN for static assets
- [ ] WebRTC video/audio calling

### Under Consideration

- [ ] GraphQL API layer
- [ ] Mobile app (React Native / Flutter)
- [ ] Push notifications (FCM)
- [ ] Dark mode
- [ ] Celery task queue for email and heavy operations
- [ ] Kubernetes deployment manifests

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### Workflow

1. **Fork** the repository
2. **Branch** from `dev`: `git checkout -b feat/your-feature`
3. **Implement** your changes with tests
4. **Verify**: `pytest` (all tests pass, coverage maintained)
5. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add user search autocomplete
   fix: prevent duplicate connection requests
   docs: update API documentation
   ```
6. **Push** and open a **Pull Request** against `dev`

### Requirements

- All tests must pass
- Maintain or improve 83%+ coverage
- Follow PEP 8 code style
- Add docstrings to new functions and routes
- No breaking changes without prior discussion

### Code Style

```python
# ✅ Good
@feed_bp.route("/posts/<int:post_id>/like", methods=["POST"])
@login_required
def toggle_like(post_id):
    """Toggles a user's 'like' on a post and creates/removes notifications."""
    ...

# ❌ Bad
@feed_bp.route("/posts/<int:post_id>/like", methods=["POST"])
def like(post_id):
    ...
```

---

## License

This project is licensed under the **MIT License**.

```
MIT License — Permissions: ✅ Commercial use, ✅ Modification, ✅ Distribution
Conditions: Include copyright notice · No warranty
```

---

## Authors

**Dhyey Daftary** — Creator, Lead Developer & Project Architect

[![GitHub](https://img.shields.io/badge/GitHub-dhyeydaftary-181717?style=flat-square&logo=github)](https://github.com/dhyeydaftary)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Dhyey%20Daftary-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/dhyey-daftary/)

**Urva Shah** — Co-Creator & Design Lead

[![GitHub](https://img.shields.io/badge/GitHub-urvashah05-181717?style=flat-square&logo=github)](https://github.com/urvashah05)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Urva%20Shah-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/urva-shah-2b289a30b/)

**Twisha Agrawal** — Co-Creator

---

## Acknowledgments

### Testing & Valuable Feedback

Special thanks to everyone who tested the application and helped shape it into what it is today:

- **Tanish Shah** — Comprehensive testing, bug reports, and UX feedback
- **Saumya Prajapati** — Collaborative feedback and feature suggestions

### Design & UI/UX

- **Urva Shah** — UI/UX design consultation and interface optimization

### Project Collaboration

- **Urva Shah** — Project partner providing continuous collaboration and support throughout development

### Community & Support

- Family and friends for their unwavering encouragement and support
- The incredible open-source communities behind Flask, SQLAlchemy, Tailwind CSS, and every tool that made Campus Connect possible

### Built With

[Flask](https://flask.palletsprojects.com) · [SQLAlchemy](https://sqlalchemy.org) · [Flask-SocketIO](https://flask-socketio.readthedocs.io) · [PostgreSQL](https://postgresql.org) · [Redis](https://redis.io) · [Tailwind CSS](https://tailwindcss.com) · [pytest](https://pytest.org) · [Gunicorn](https://gunicorn.org) · [Render](https://render.com)

---

<p align="center">
  <strong>⭐ If you found this project useful, please consider giving it a star!</strong>
</p>

<p align="center">
  <a href="https://github.com/dhyeydaftary/Campus-Connect/issues">Report Bug</a>
  ·
  <a href="https://github.com/dhyeydaftary/Campus-Connect/issues">Request Feature</a>
  ·
  <a href="docs/API.md">API Docs</a>
  ·
  <a href="docs/TROUBLESHOOTING.md">Troubleshooting</a>
</p>
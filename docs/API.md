# API Reference

Campus Connect API documentation. All API endpoints use **session-based authentication** — clients must include a valid session cookie obtained after login.

## Table of Contents

- [Authentication](#authentication)
- [Profile & Users](#profile--users)
- [Feed & Posts](#feed--posts)
- [Events](#events)
- [Connections](#connections)
- [Notifications](#notifications)
- [Chat & Messaging](#chat--messaging)
- [Health Check](#health-check)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

---

## Authentication

All authentication endpoints are under the `auth` blueprint.

### `POST /api/auth/register`

Register a new student account.

**Request Body:**
```json
{
  "email": "student@university.edu",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "enrollment_no": "20BEIT001",
  "university": "Silver Oak University",
  "major": "Computer Science",
  "batch": "2020-2024"
}
```

**Response (201):**
```json
{
  "message": "Registration successful",
  "user_id": 42
}
```

---

### `POST /api/auth/request-otp`

Request a one-time password for email-based login.

**Request Body:**
```json
{
  "enrollment_no": "20BEIT001"
}
```

**Response (200):**
```json
{
  "message": "OTP sent to your email",
  "email_hint": "s***@university.edu"
}
```

---

### `POST /api/auth/verify-otp`

Verify OTP and create a session.

**Request Body:**
```json
{
  "enrollment_no": "20BEIT001",
  "otp": "482917"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user_id": 42,
  "redirect": "/home"
}
```

---

### `POST /api/auth/login`

Password-based login for students and administrators.

**Request Body:**
```json
{
  "enrollment_no": "20BEIT001",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user_id": 42,
  "account_type": "student",
  "redirect": "/home"
}
```

---

### `POST /api/auth/update-password`

Update password for a logged-in user.

**Request Body:**
```json
{
  "password": "NewSecurePass456!",
  "confirm_password": "NewSecurePass456!"
}
```

**Response (200):**
```json
{
  "message": "Password updated successfully"
}
```

---

### `POST /api/auth/forgot-password`

Request a password reset link via email.

**Request Body:**
```json
{
  "email": "student@university.edu"
}
```

**Response (200):**
```json
{
  "message": "Password reset link sent"
}
```

---

### `POST /api/auth/reset-password/<token>`

Reset password using a time-sensitive token.

**Request Body:**
```json
{
  "password": "NewSecurePass789!",
  "confirm_password": "NewSecurePass789!"
}
```

**Response (200):**
```json
{
  "message": "Password has been reset successfully"
}
```

---

### `GET /logout`

Clears the user session and redirects to the login page.

---

## Profile & Users

### `GET /api/profile/me`

Get the current user's profile summary (used for navbar display).

**Response (200):**
```json
{
  "id": 42,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@university.edu",
  "profile_picture": "/static/uploads/profile_photos/42.jpg",
  "account_type": "student"
}
```

---

### `GET /api/profile/<user_id>`

Get a comprehensive profile for a specific user, including skills, experience, education, and connection status.

**Response (200):**
```json
{
  "id": 42,
  "first_name": "John",
  "last_name": "Doe",
  "bio": "CS student passionate about web development",
  "university": "Silver Oak University",
  "major": "Computer Science",
  "batch": "2020-2024",
  "profile_picture": "...",
  "connection_count": 25,
  "post_count": 12,
  "skills": [...],
  "experiences": [...],
  "educations": [...],
  "connection_status": "connected"
}
```

---

### `GET /api/profile/<user_id>/posts?page=1`

Get a paginated list of posts by a specific user.

**Response (200):**
```json
{
  "posts": [...],
  "total": 12,
  "page": 1,
  "has_more": true
}
```

---

### `POST /api/profile/photo`

Upload or update the current user's profile photo. Uses `multipart/form-data`.

**Response (200):**
```json
{
  "message": "Profile photo updated",
  "profile_picture": "/static/uploads/profile_photos/42.jpg"
}
```

---

### `GET|POST|PUT|DELETE /api/profile/skills`

Full CRUD for the current user's skills.

**POST Body:**
```json
{
  "skill_name": "Python",
  "skill_level": "advanced"
}
```

---

### `GET|POST|PUT|DELETE /api/profile/experiences`

Full CRUD for the current user's work experiences.

**POST Body:**
```json
{
  "title": "Software Intern",
  "company": "TechCorp",
  "location": "Remote",
  "start_date": "Jan 2024",
  "end_date": "Present",
  "description": "Full-stack development",
  "is_current": true
}
```

---

### `GET|POST|PUT|DELETE /api/profile/educations`

Full CRUD for the current user's education history.

**POST Body:**
```json
{
  "degree": "Bachelor of Technology",
  "field": "Computer Science",
  "institution": "Silver Oak University",
  "year": "2020-2024"
}
```

---

### `PUT /api/profile/bio`

Update the current user's bio.

**Request Body:**
```json
{
  "bio": "CS student passionate about web development"
}
```

---

### `GET /api/profile/completion`

Get the current user's profile completion score and suggestions.

**Response (200):**
```json
{
  "completion_percentage": 75,
  "suggestions": [
    "Add a profile photo",
    "Add your skills"
  ]
}
```

---

### `GET /api/search?q=john&limit=10`

Search across users and announcements.

**Response (200):**
```json
{
  "users": [...],
  "announcements": [...]
}
```

---

## Feed & Posts

All feed endpoints are under `/api` (via the `feed` blueprint with `/api` prefix).

### `GET /api/posts?page=1`

Get the personalized feed of posts, ranked by a scoring algorithm.

**Response (200):**
```json
{
  "posts": [
    {
      "id": 101,
      "user_id": 42,
      "author_name": "John Doe",
      "caption": "Hello Campus Connect!",
      "image_url": "/static/uploads/post/post_images/101.jpg",
      "like_count": 5,
      "comment_count": 2,
      "user_has_liked": false,
      "created_at": "2026-03-05T10:30:00"
    }
  ],
  "total": 50,
  "page": 1,
  "has_more": true
}
```

---

### `GET /api/posts/<post_id>`

Get details for a single post.

---

### `POST /api/posts/create`

Create a new post. Supports `multipart/form-data` for image/document uploads.

**Form Fields:**
- `caption` (string, optional)
- `file` (file, optional — image or document)
- `visibility` (`public`, `connections`, or `private`)

**Response (201):**
```json
{
  "message": "Post created successfully",
  "post_id": 102
}
```

---

### `POST /api/posts/<post_id>/like`

Toggle like on a post (like if not liked, unlike if already liked).

**Response (200):**
```json
{
  "liked": true,
  "like_count": 6
}
```

---

### `GET /api/posts/<post_id>/comments`

Get all comments on a post.

**Response (200):**
```json
{
  "comments": [
    {
      "id": 201,
      "user_id": 43,
      "author_name": "Jane Smith",
      "text": "Great post!",
      "created_at": "2026-03-05T11:00:00"
    }
  ]
}
```

---

### `POST /api/posts/<post_id>/comments`

Add a comment to a post. Comments are processed asynchronously via a background queue.

**Request Body:**
```json
{
  "text": "Great post!",
  "parent_comment_id": null
}
```

**Response (201):**
```json
{
  "message": "Comment submitted"
}
```

---

### `GET /api/posts/<post_id>/download`

Download a document attachment from a post.

---

## Events

All event endpoints are under `/api` (via the `events` blueprint with `/api` prefix).

### `GET /api/events`

Get all upcoming events with registration counts and the current user's status.

**Response (200):**
```json
[
  {
    "id": 1,
    "title": "Tech Symposium 2026",
    "description": "Annual technology showcase",
    "location": "Main Auditorium",
    "eventDate": "2026-04-15T10:00:00+00:00",
    "totalSeats": 200,
    "availableSeats": 150,
    "goingCount": 50,
    "interestedCount": 30,
    "userStatus": "going",
    "month": "APR",
    "day": 15,
    "time": "10:00 AM"
  }
]
```

---

### `POST /api/events/<event_id>/register`

Register, unregister, or update status for an event. Toggling the same status cancels the registration.

**Request Body:**
```json
{
  "status": "going"
}
```

**Response (200/201):**
```json
{
  "message": "Registered as going",
  "userStatus": "going",
  "availableSeats": 149,
  "goingCount": 51,
  "interestedCount": 30
}
```

---

## Connections

All connection endpoints are under `/api` (via the `connections` blueprint with `/api` prefix).

### `GET /api/suggestions`

Get connection suggestions for the current user.

---

### `POST /api/connections/request`

Send a connection request.

**Request Body:**
```json
{
  "receiver_id": 43
}
```

---

### `POST /api/connections/accept/<request_id>`

Accept a pending connection request.

---

### `POST /api/connections/reject/<request_id>`

Reject a pending connection request.

---

### `GET /api/connections/pending`

Get all pending connection requests received by the current user.

---

### `GET /api/connections/sent`

Get all pending connection requests sent by the current user.

---

### `GET /api/connections/list`

Get all of the current user's connections.

---

### `DELETE /api/connections/<user_id>`

Remove a connection with another user.

---

## Notifications

All notification endpoints are under `/api` (via the `notifications` blueprint with `/api` prefix).

### `GET /api/notifications`

Get the latest 20 notifications for the current user.

**Response (200):**
```json
{
  "notifications": [
    {
      "id": 301,
      "type": "post_like",
      "message": "Jane Smith liked your post",
      "reference_id": 101,
      "actor": {
        "id": 43,
        "name": "Jane Smith",
        "profile_picture": "..."
      },
      "is_read": false,
      "created_at": "2026-03-05 12:00:00"
    }
  ],
  "unread_count": 3
}
```

---

### `GET /api/notifications/unread-count`

Get the count of unread notifications (for badge updates). Rate-limit exempt.

**Response (200):**
```json
{
  "count": 3
}
```

---

### `POST /api/notifications/mark-read/<notification_id>`

Mark a single notification as read.

---

### `POST /api/notifications/mark-all-read`

Mark all notifications as read.

---

### `POST /api/notifications/clear`

Delete all notifications for the current user.

---

## Chat & Messaging

### HTTP Endpoints

#### `GET /api/chats`

Get all conversations for the current user, sorted by last activity.

#### `POST /api/chats/start`

Start a new conversation or get an existing one.

**Request Body:**
```json
{
  "recipient_id": 43
}
```

#### `GET /api/chats/<conversation_id>`

Get details for a specific conversation.

#### `GET /api/chats/<conversation_id>/messages?page=1`

Get paginated messages for a conversation.

#### `POST /api/chats/<conversation_id>/read`

Mark all messages in a conversation as read.

#### `POST /api/chats/message`

Send a message via HTTP (alternative to WebSocket).

**Request Body:**
```json
{
  "conversation_id": 1,
  "content": "Hello!"
}
```

#### `DELETE /api/chats/message/<message_id>`

Delete a message.

#### `GET /api/chats/unread-count`

Get total unread message count across all conversations.

#### `GET /api/chats/search-users?q=john`

Search for users to start a new conversation with.

#### `POST /api/chats/upload`

Upload a file attachment for chat. Uses `multipart/form-data`.

---

### WebSocket Events

Connect to the Socket.IO server at the root URL with a valid session cookie.

```javascript
const socket = io('http://localhost:5000');
```

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join_chat` | `{ conversation_id }` | Join a chat room |
| `leave_chat` | `{ conversation_id }` | Leave a chat room |
| `send_message` | `{ conversation_id, content, recipient_id }` | Send a message |
| `mark_read` | `{ conversation_id }` | Mark messages as read |
| `typing` | `{ conversation_id }` | Notify typing status |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `joined` | `{ status, room }` | Confirmation of room join |
| `new_message` | `{ id, conversation_id, sender_id, sender_name, content, created_at, is_read }` | New message received |
| `messages_read` | `{ conversation_id, read_by }` | Messages marked as read |
| `user_typing` | `{ conversation_id, user_id }` | User is typing |
| `error` | `{ message }` | Error notification |

---

## Health Check

### `GET /health`

Application health check for load balancers. **No authentication required.**

**Response (200) — Healthy:**
```json
{
  "status": "ok",
  "service": "Campus Connect",
  "database": "ok"
}
```

**Response (503) — Database Down:**
```json
{
  "status": "error",
  "service": "Campus Connect",
  "database": "down",
  "message": "Database connection failed"
}
```

---

## Error Responses

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request / validation error |
| `401` | Authentication required |
| `403` | Permission denied |
| `404` | Resource not found |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `503` | Service unavailable |

### Error Response Format

```json
{
  "error": "Description of the error"
}
```

### Rate Limit Exceeded (429)

```json
{
  "error": "ratelimit exceeded",
  "description": "5 per 15 minutes"
}
```

---

## Rate Limiting

Rate limits are enforced via Flask-Limiter.

| Scope | Limit |
|-------|-------|
| Login endpoints | 5 requests per 15 minutes |
| General API | 200 requests per day, 50 per hour |
| Notification unread count | Exempt (polled frequently) |

When rate limited, the API returns `429 Too Many Requests`. The rate limit storage backend is Redis in production and in-memory for development.

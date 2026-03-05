# Database Migrations Guide

Campus Connect uses **Flask-Migrate** (Alembic) for database schema management. Migrations let you version-control your database schema alongside your application code.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `flask db migrate -m "description"` | Generate migration from model changes |
| `flask db upgrade` | Apply pending migrations |
| `flask db downgrade` | Revert the last migration |
| `flask db history` | Show migration history |
| `flask db current` | Show current revision |
| `flask db stamp head` | Mark DB as up-to-date without running migrations |

---

## Making Schema Changes

### Step-by-Step Workflow

```bash
# 1. Edit your models in app/models.py
# Example: Add a headline column to the User model

# 2. Generate a migration file
flask db migrate -m "add_headline_to_users"
# Creates: migrations/versions/<hash>_add_headline_to_users.py

# 3. REVIEW the generated migration file
# Open it and verify:
#   - The upgrade() function does what you expect
#   - The downgrade() function correctly reverses it
#   - No unexpected changes (e.g., reordered columns)

# 4. Apply the migration locally
flask db upgrade

# 5. Test the application
python run.py
pytest

# 6. Test the rollback
flask db downgrade
flask db upgrade

# 7. Commit both the model changes and migration file
git add app/models.py migrations/versions/
git commit -m "feat: add headline to user profiles"
```

---

## Applying Migrations

### Development

```bash
# Apply all pending migrations
flask db upgrade

# Check what revision the database is at
flask db current

# View full migration history
flask db history
```

### Production

Migrations should be applied as part of your deployment process. On platforms like Render, you can add this to your build command:

```bash
flask db upgrade && gunicorn wsgi:app
```

Or run it manually via SSH/shell access before restarting the service.

---

## Rolling Back Migrations

```bash
# Rollback the last migration
flask db downgrade

# Rollback multiple steps
flask db downgrade -2

# Rollback to a specific revision
flask db downgrade <revision_hash>

# View revision hashes
flask db history --verbose
```

---

## Common Commands

```bash
# Initialize migration repository (one-time, already done)
flask db init

# Auto-detect model changes and generate migration
flask db migrate -m "Description of change"

# Create an empty migration for manual editing
flask db revision -m "Custom migration"

# Apply all pending migrations
flask db upgrade

# Rollback last migration
flask db downgrade

# Show current database version
flask db current

# Show migration history
flask db history

# Preview SQL that would be generated (dry run)
flask db upgrade --sql

# Merge two migration heads (after branch conflicts)
flask db merge <revision1> <revision2>
```

---

## Best Practices

### 1. Always Review Auto-Generated Migrations

Alembic auto-generation is powerful but imperfect. It may:
- Interpret a column rename as a drop + create (causes data loss)
- Miss certain constraint changes
- Generate unnecessary operations

Always open the file and read it before applying.

### 2. Write Descriptive Messages

```bash
# ✅ Good
flask db migrate -m "add_headline_column_to_users"
flask db migrate -m "create_user_preferences_table"

# ❌ Bad
flask db migrate -m "update"
flask db migrate -m "fix"
```

### 3. One Logical Change Per Migration

Don't mix unrelated schema changes in a single migration. This makes it easier to debug, review, and roll back individual changes.

### 4. Test Both Directions

Before committing a migration, always test:
```bash
flask db upgrade    # Apply
flask db downgrade  # Rollback
flask db upgrade    # Re-apply
```

### 5. Use `server_default` for New Non-Nullable Columns

When adding a new `NOT NULL` column to a table that already has data:
```python
# In your migration file
op.add_column('users', sa.Column('headline', sa.String(200), 
              nullable=False, server_default=''))
```

### 6. Back Up Before Major Migrations

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore if needed
psql $DATABASE_URL < backup_20260305.sql
```

### 7. Never Edit Already-Applied Migrations

If a migration has been applied to any environment (dev, staging, or production), create a new migration to fix issues instead of editing the old one.

### 8. Document Complex Migrations

Add comments at the top of migration files explaining non-obvious changes:
```python
"""
This migration adds full-text search support to the posts table.

Changes:
- Adds search_vector column (tsvector type)
- Creates GIN index for fast text search
- Requires PostgreSQL with pg_trgm extension
"""
```

---

## Team Development

### Handling Migration Conflicts

When two developers create migrations from the same base revision:

```bash
# 1. Pull and merge the other branch
git merge other-branch

# 2. You'll see two migration heads
flask db heads

# 3. Create a merge migration
flask db merge <rev1> <rev2> -m "merge_migration_heads"

# 4. Apply and test
flask db upgrade
```

### Code Review Checklist for Migrations

- [ ] Does `upgrade()` correctly implement the intended change?
- [ ] Does `downgrade()` fully reverse the change?
- [ ] Are there any data loss risks?
- [ ] Are new columns nullable or have a `server_default`?
- [ ] Have indexes been added for frequently queried columns?
- [ ] Has the migration been tested locally (upgrade + downgrade)?

### Deployment Workflow

```bash
# 1. Develop and test locally
flask db migrate -m "add_feature_x"
flask db upgrade
pytest

# 2. Commit migration + model changes together
git add app/models.py migrations/versions/
git commit -m "feat: add feature X schema"

# 3. Push and open PR
git push origin feat/feature-x

# 4. After PR merge, deploy
# Migrations run automatically during deploy (or manually via flask db upgrade)
```

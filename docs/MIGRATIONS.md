# Database Migrations Guide

Campus Connect uses **Flask-Migrate** (Alembic) for database schema management.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `flask db migrate -m "description"` | Generate migration from model changes |
| `flask db upgrade` | Apply pending migrations |
| `flask db downgrade` | Revert the last migration |
| `flask db history` | Show migration history |
| `flask db current` | Show current revision |

## Making Schema Changes

### Step 1: Edit models
Make your changes in `app/models.py`.

### Step 2: Generate migration
```bash
flask db migrate -m "add_profile_headline"
```

### Step 3: Review the generated file
Open `migrations/versions/<hash>_add_profile_headline.py` and verify:
- All intended changes are present
- `downgrade()` correctly reverses the changes
- No unexpected diffs (e.g., reordered columns)

### Step 4: Apply locally
```bash
flask db upgrade
```

### Step 5: Test
```bash
pytest
```

### Step 6: Commit
Commit both the model changes and the migration file together.

## Production Deployment

On first deploy or after pulling new migrations:
```bash
flask db upgrade
```

This is safe — Alembic tracks which migrations have already been applied.

## Best Practices

1. **Always review auto-generated migrations** — Alembic can miss some changes (e.g., renaming vs drop+create)
2. **Test downgrade** before committing: `flask db downgrade` then `flask db upgrade`
3. **One migration per feature** — keep migrations focused and reversible
4. **Never edit applied migrations** — create a new one instead
5. **Use `server_default`** for new non-nullable columns on existing tables

## Troubleshooting

**"Target database is not up to date"**
```bash
flask db stamp head  # Mark DB as current, then regenerate
```

**Migration detects no changes**
This happens when the DB already matches models. Verify with `flask db current`.

**Need to start fresh (dev only)**
```bash
flask db downgrade base   # Rolls back all migrations
flask db upgrade          # Re-applies everything
```

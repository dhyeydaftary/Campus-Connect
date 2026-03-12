"""
Tests for app.services.seeder
"""
import pytest
from app.services import seeder
from app.models import User

def test_admin_created_if_not_exists(app, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@admin.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass")
    assert User.query.filter_by(account_type="admin").count() == 0
    seeder.seed_admin()
    assert User.query.filter_by(account_type="admin").count() == 1

def test_idempotency(app, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@admin.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass")
    seeder.seed_admin()
    seeder.seed_admin()
    assert User.query.filter_by(account_type="admin").count() == 1

def test_password_hashed(app, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@admin.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass")
    seeder.seed_admin()
    admin = User.query.filter_by(account_type="admin").first()
    assert admin.password_hash != "adminpass"
    assert admin.password_hash.startswith("$2b$") or admin.password_hash.startswith("pbkdf2")

def test_role_assigned(app, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@admin.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass")
    seeder.seed_admin()
    admin = User.query.filter_by(account_type="admin").first()
    assert admin.account_type == "admin"

def test_db_commit(app, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@admin.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "adminpass")
    seeder.seed_admin()
    admin = User.query.filter_by(account_type="admin").first()
    assert admin is not None

def test_invalid_env(app, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "")
    monkeypatch.setenv("ADMIN_PASSWORD", "")
    seeder.seed_admin()
    assert User.query.filter_by(account_type="admin").count() == 0
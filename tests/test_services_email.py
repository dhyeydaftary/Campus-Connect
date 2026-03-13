# --- Additional hardening tests ---
def test_send_email_invalid_recipient(app, sample_email_data):
    bad_data = dict(sample_email_data)
    bad_data["recipients"] = [None]
    with app.app_context():
        with patch("app.services.email_service.SendGridAPIClient") as mock_sg:
            result = email_service.send_email(**bad_data)
            assert result is False
            mock_sg.return_value.send.assert_not_called()

def test_send_email_html_and_plaintext_parts(app, sample_email_data):
    with app.app_context():
        with patch("app.services.email_service.SendGridAPIClient") as mock_sg:
            data = dict(sample_email_data)
            data["html_body"] = "<b>Hello</b>"
            result = email_service.send_email(**data)
            mock_sg.return_value.send.assert_called_once()
            msg = mock_sg.return_value.send.call_args[0][0]
            msg_dict = msg.get()
            assert any(c.get("value") == data["html_body"] for c in msg_dict.get("content", []))

def test_send_email_send_exception_logs_error(app, sample_email_data):
    with app.app_context():
        with patch("app.services.email_service.SendGridAPIClient") as mock_sg:
            mock_sg.return_value.send.side_effect = Exception("SMTP error")
            result = email_service.send_email(**sample_email_data)
            mock_sg.return_value.send.assert_called_once()
            assert result is False
"""
Tests for app.services.email_service
"""
import pytest
from unittest.mock import patch
from app.services import email_service

@pytest.fixture
def sample_email_data():
    return {
        "subject": "Test Subject",
        "recipients": ["testuser@example.com"],
        "html_body": "<b>Hello</b>"
    }

def test_send_email_success(app, sample_email_data):
    with app.app_context():
        with patch("app.services.email_service.SendGridAPIClient") as mock_sg:
            result = email_service.send_email(**sample_email_data)
            mock_sg.return_value.send.assert_called_once()
            msg = mock_sg.return_value.send.call_args[0][0]
            assert sample_email_data["recipients"][0] == msg.personalizations[0].tos[0]["email"]
            assert sample_email_data["subject"] == msg.subject.subject
            assert result is True

def test_send_email_send_failure(app, sample_email_data):
    with app.app_context():
        with patch("app.services.email_service.SendGridAPIClient") as mock_sg:
            mock_sg.return_value.send.side_effect = Exception("SMTP error")
            result = email_service.send_email(**sample_email_data)
            mock_sg.return_value.send.assert_called_once()
            assert result is False

def test_send_email_missing_fields():
    with patch("app.services.email_service.SendGridAPIClient") as mock_sg:
        with pytest.raises(TypeError):
            email_service.send_email(subject="No body")
        mock_sg.return_value.send.assert_not_called()
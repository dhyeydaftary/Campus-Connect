import pytest
from unittest.mock import MagicMock, patch
from app.services.email_service import send_email, send_otp_email, send_welcome_email, send_password_reset_email, generate_otp
from flask import Flask

class TestEmailServiceDeep:
    def test_send_email_invalid_recipients(self, app):
        """Verify send_email returns False for invalid recipient formats."""
        with app.app_context():
            # Not a list
            assert send_email("Sub", "not-a-list@ex.com", "html") is False
            # Invalid email format
            assert send_email("Sub", ["invalid-email"], "html") is False
            # Empty list
            assert send_email("Sub", [], "html") is False

    @patch('app.services.email_service.SendGridAPIClient')
    def test_send_email_smtp_exception(self, mock_sg_class, app):
        """Verify send_email returns False and logs error on SMTP exception."""
        mock_sg_class.return_value.send.side_effect = Exception("SMTP Connection Failed")
        with app.app_context():
            with patch('app.services.email_service.current_app.logger.error') as mock_log:
                result = send_email("Subject", ["test@example.com"], "<h1>Body</h1>")
                assert result is False
                mock_log.assert_called()

    @patch('app.services.email_service.send_email')
    def test_send_otp_email(self, mock_send_email, app):
        """Verify send_otp_email calls send_email with correct data."""
        with app.app_context():
            mock_send_email.return_value = True
            result = send_otp_email("user@example.com", "123456")
            assert result is True
            mock_send_email.assert_called_once()
            args = mock_send_email.call_args[0]
            assert args[0] == "Your Campus Connect OTP"
            assert args[1] == ["user@example.com"]
            assert "1" in args[2]
            assert "6" in args[2]

    @patch('app.services.email_service.send_email')
    def test_send_welcome_email(self, mock_send_email, app):
        """Verify send_welcome_email calls send_email with user name."""
        with app.app_context():
            mock_send_email.return_value = True
            user = MagicMock()
            user.full_name = "John Doe"
            user.first_name = "John"
            user.email = "john@example.com"
            
            result = send_welcome_email(user)
            assert result is True
            mock_send_email.assert_called_once()
            args = mock_send_email.call_args[0]
            assert "John" in args[0]
            assert args[1] == ["john@example.com"]
            assert "John Doe" in args[2]

    @patch('app.services.email_service.send_email')
    def test_send_password_reset_email(self, mock_send_email, app):
        """Verify send_password_reset_email calls send_email with reset link."""
        with app.app_context():
            mock_send_email.return_value = True
            user = MagicMock()
            user.email = "user@example.com"
            link = "http://localhost/reset/token"
            
            result = send_password_reset_email(user, link)
            assert result is True
            mock_send_email.assert_called_once()
            args = mock_send_email.call_args[0]
            assert args[1] == ["user@example.com"]
            assert link in args[2]

    def test_generate_otp(self):
        """Verify generate_otp returns 6-digit number."""
        otp = generate_otp()
        assert len(otp) == 6
        assert otp.isdigit()
        
        # Test randomness (mostly)
        otp2 = generate_otp()
        assert otp != otp2

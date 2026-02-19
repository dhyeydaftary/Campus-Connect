document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('reset-password-form');
    if (resetForm) {
        resetForm.addEventListener('submit', handleResetPassword);
    }
});

function getTokenFromUrl() {
    // Extracts the token from a URL like: /reset-password?token=THE_TOKEN_VALUE
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
}

async function handleResetPassword(event) {
    event.preventDefault();
    const statusElement = document.getElementById('reset-status');
    const submitButton = document.getElementById('reset-submit-btn');
    const token = getTokenFromUrl();

    if (!token) {
        statusElement.textContent = 'Error: No reset token found in the URL.';
        statusElement.className = 'text-sm text-red-600';
        return;
    }

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword.length < 6) {
        statusElement.textContent = 'Password must be at least 6 characters long.';
        statusElement.className = 'text-sm text-red-600';
        return;
    }

    if (newPassword !== confirmPassword) {
        statusElement.textContent = 'Passwords do not match.';
        statusElement.className = 'text-sm text-red-600';
        return;
    }

    // Set loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Resetting...';
    statusElement.textContent = '';

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                new_password: newPassword
            }),
        });

        const data = await response.json();

        if (response.ok) {
            statusElement.textContent = data.message + ' Redirecting to login...';
            statusElement.className = 'text-sm text-green-600';
            setTimeout(() => { window.location.href = '/login'; }, 3000);
        } else {
            statusElement.textContent = data.error || 'An unknown error occurred.';
            statusElement.className = 'text-sm text-red-600';
            submitButton.disabled = false;
            submitButton.textContent = 'Reset Password';
        }
    } catch (error) {
        console.error('Password reset failed:', error);
        statusElement.textContent = 'A network error occurred. Please try again.';
        statusElement.className = 'text-sm text-red-600';
        submitButton.disabled = false;
        submitButton.textContent = 'Reset Password';
    }
}

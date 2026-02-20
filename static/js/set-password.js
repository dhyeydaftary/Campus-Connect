document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('set-password-form');
    const btn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');

    // --- Prevent Logout ---
    // Find the logout link in the navbar and disable it.
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        // Prevent navigation
        logoutLink.href = '#';
        // Add a click listener to show a toast message
        logoutLink.onclick = (e) => {
            e.preventDefault();
            if (typeof showToast === 'function') {
                showToast('Action Required', 'Please set your password before logging out.', 'warning');
            }
        };
        // Visually indicate that it's disabled
        logoutLink.style.opacity = '0.5';
        logoutLink.style.cursor = 'not-allowed';
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword.length < 6) {
                showToast('Weak Password', 'Password must be at least 6 characters long.', 'warning');
                return;
            }

            if (newPassword !== confirmPassword) {
                showToast('Password Mismatch', 'The passwords you entered do not match.', 'error');
                return;
            }

            btn.disabled = true;
            btnText.textContent = 'Saving...';

            try {
                const response = await fetch('/api/profile/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        new_password: newPassword,
                        confirm_password: confirmPassword
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    showToast('Success!', result.message, 'success');
                    // Redirect to the home page after a short delay
                    setTimeout(() => {
                        window.location.href = result.redirect_url || '/home';
                    }, 1000);
                } else {
                    showToast('Error', result.error || 'Failed to set password.', 'error');
                    btn.disabled = false;
                    btnText.textContent = 'Set Password & Continue';
                }
            } catch (error) {
                showToast('Network Error', 'Could not connect to the server. Please try again.', 'error');
                btn.disabled = false;
                btnText.textContent = 'Set Password & Continue';
            }
        });
    }
});
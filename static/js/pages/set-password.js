document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('set-password-form');
    const btn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // === Prevent Logout ===
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.href = '#';
        logoutLink.onclick = (e) => {
            e.preventDefault();
            if (typeof showToast === 'function') {
                showToast('Action Required', 'Please set your password before logging out.', 'warning');
            }
        };
        logoutLink.style.opacity = '0.5';
        logoutLink.style.cursor = 'not-allowed';
    }

    // === Real-time Match Feedback ===
    // Inject a status element after confirm-password if not present
    let matchStatus = document.getElementById('match-status');
    if (!matchStatus && confirmPasswordInput) {
        matchStatus = document.createElement('p');
        matchStatus.id = 'match-status';
        matchStatus.className = 'text-xs mt-1.5 h-4 transition-all duration-200';
        confirmPasswordInput.closest('div').parentElement.appendChild(matchStatus);
    }

    function checkMatch() {
        if (!matchStatus) return;
        const pw = newPasswordInput.value;
        const confirm = confirmPasswordInput.value;
        if (!confirm) {
            matchStatus.textContent = '';
            matchStatus.className = 'text-xs mt-1.5 h-4 transition-all duration-200';
            return;
        }
        if (pw === confirm) {
            matchStatus.textContent = '✓ Passwords match';
            matchStatus.className = 'text-xs mt-1.5 h-4 transition-all duration-200 text-green-600 font-medium';
        } else {
            matchStatus.textContent = '✗ Passwords do not match';
            matchStatus.className = 'text-xs mt-1.5 h-4 transition-all duration-200 text-red-500 font-medium';
        }
    }

    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            if (confirmPasswordInput.value) checkMatch();
        });
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkMatch);
    }

    // === Form Submission ===
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword.length < 6) {
                showToast('Weak Password', 'Password must be at least 6 characters long.', 'warning');
                shakeInput(newPasswordInput);
                return;
            }

            if (newPassword !== confirmPassword) {
                showToast('Password Mismatch', 'The passwords you entered do not match.', 'error');
                shakeInput(confirmPasswordInput);
                return;
            }

            // Loading state
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
                    showToast('Success!', result.message || 'Password set successfully.', 'success');
                    setTimeout(() => {
                        window.location.href = result.redirect_url || '/home';
                    }, 1500);
                } else {
                    showToast('Error', result.error || 'Failed to set password.', 'error');
                    resetButton();
                }
            } catch (error) {
                showToast('Network Error', 'Could not connect to the server. Please try again.', 'error');
                resetButton();
            }
        });
    }

    function resetButton() {
        btn.disabled = false;
        btnText.textContent = 'Set Password & Continue';
    }

    function shakeInput(input) {
        const wrapper = input.closest('.relative');
        if (!wrapper) return;
        wrapper.style.animation = 'none';
        wrapper.offsetHeight;
        wrapper.style.animation = 'shake 0.4s ease-in-out';
    }

    // Inject shake keyframe if missing
    if (!document.getElementById('shake-style')) {
        const style = document.createElement('style');
        style.id = 'shake-style';
        style.textContent = '@keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }';
        document.head.appendChild(style);
    }
});

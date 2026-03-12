document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const submitBtn = document.getElementById('reset-submit-btn');
    const btnIcon = document.getElementById('btn-icon');
    const btnText = document.getElementById('btn-text');
    const statusEl = document.getElementById('reset-status');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // === Token Extraction ===
    function getTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('token');
    }

    // === Real-time Validation Feedback ===
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            clearStatus();
            if (confirmPasswordInput.value) validateMatch();
        });
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', () => {
            clearStatus();
            validateMatch();
        });
    }

    function validateMatch() {
        const pw = newPasswordInput.value;
        const confirm = confirmPasswordInput.value;
        if (!confirm) { clearStatus(); return; }
        if (pw === confirm) {
            statusEl.textContent = '✓ Passwords match';
            statusEl.className = 'text-sm text-center pt-1 text-green-600 font-medium';
        } else {
            statusEl.textContent = '✗ Passwords do not match';
            statusEl.className = 'text-sm text-center pt-1 text-red-500 font-medium';
        }
    }

    function clearStatus() {
        statusEl.textContent = '';
        statusEl.className = 'text-sm text-center pt-1';
    }

    // === Form Submission ===
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearStatus();

            const token = getTokenFromUrl();
            if (!token) {
                setStatus('Error: No reset token found in the URL.', 'error');
                showToast('Error', 'No reset token found. Please use the link from your email.', 'error');
                return;
            }

            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (newPassword.length < 6) {
                setStatus('Password must be at least 6 characters long.', 'error');
                shakeInput(newPasswordInput);
                return;
            }

            if (newPassword !== confirmPassword) {
                setStatus('Passwords do not match.', 'error');
                shakeInput(confirmPasswordInput);
                return;
            }

            // Loading state
            setLoading(true);

            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, new_password: newPassword }),
                });

                const data = await response.json();

                if (response.ok) {
                    setStatus((data.message || 'Password reset successfully!') + ' Redirecting to login...', 'success');
                    showToast('Success!', data.message || 'Your password has been reset.', 'success');
                    form.reset();
                    submitBtn.disabled = true;
                    setTimeout(() => { window.location.href = '/login'; }, 2500);
                } else {
                    setStatus(data.error || 'An unknown error occurred.', 'error');
                    showToast('Error', data.error || 'Failed to reset password.', 'error');
                    setLoading(false);
                }
            } catch (error) {
                console.error('Password reset failed:', error);
                setStatus('A network error occurred. Please try again.', 'error');
                showToast('Network Error', 'Could not connect to server.', 'error');
                setLoading(false);
            }
        });
    }

    // === Helpers ===
    function setStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = 'text-sm text-center pt-1 font-medium ' +
            (type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : 'text-slate-500');
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        if (loading) {
            btnIcon.className = 'fa-solid fa-spinner fa-spin text-sm';
            btnText.textContent = 'Resetting...';
        } else {
            btnIcon.className = 'fa-solid fa-check text-sm';
            btnText.textContent = 'Reset Password';
        }
    }

    function shakeInput(input) {
        const wrapper = input.closest('.relative');
        if (!wrapper) return;
        wrapper.style.animation = 'none';
        wrapper.offsetHeight; // reflow
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

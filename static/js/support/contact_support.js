document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-support-form');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    const fileInput = document.getElementById('file');
    const dropzone = document.getElementById('file-dropzone');
    const fileLabel = document.getElementById('file-label');
    const filePreview = document.getElementById('file-preview');
    const fileNameDisplay = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');

    const messageInput = document.getElementById('message');
    const charCountDisplay = document.getElementById('char-count');

    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitIcon = document.getElementById('submit-icon');

    if (messageInput && charCountDisplay) {
        messageInput.addEventListener('input', () => {
            const len = messageInput.value.length;
            charCountDisplay.textContent = `${len} / 1000`;
            if (len > 900) {
                charCountDisplay.classList.add('text-amber-600', 'bg-amber-50');
                charCountDisplay.classList.remove('text-slate-400', 'bg-slate-100');
            } else {
                charCountDisplay.classList.remove('text-amber-600', 'bg-amber-50');
                charCountDisplay.classList.add('text-slate-400', 'bg-slate-100');
            }
        });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'doc', 'docx'];

    function handleFileSelection(file) {
        if (!file) { resetFileInput(); return; }
        if (file.size > MAX_FILE_SIZE) {
            if (window.showToast) showToast('File exceeds 5MB limit.', 'error');
            else alert('File exceeds 5MB limit.');
            resetFileInput(); return;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            if (window.showToast) showToast(`Invalid file type: .${ext}`, 'error');
            else alert(`Invalid file type: .${ext}`);
            resetFileInput(); return;
        }
        fileLabel.classList.add('hidden');
        filePreview.classList.remove('hidden');
        filePreview.classList.add('flex');
        fileNameDisplay.textContent = file.name;
    }

    function resetFileInput() {
        fileInput.value = '';
        fileLabel.classList.remove('hidden');
        filePreview.classList.add('hidden');
        filePreview.classList.remove('flex');
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
        });
        removeFileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetFileInput();
        });
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dropzone-active'); });
        dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('dropzone-active'); });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dropzone-active');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed', 'btn-loading');
            submitText.textContent = 'Submitting...';
            submitIcon.classList.remove('fa-paper-plane');
            submitIcon.classList.add('fa-spinner', 'fa-spin');
            const formData = new FormData(form);
            try {
                const response = await fetch('/contact-support', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrfToken },
                    body: formData
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    window.location.href = `/ticket-success?id=${result.ticket_id}&email=${encodeURIComponent(result.email)}`;
                } else {
                    if (window.showToast) showToast(result.error || 'Failed to submit ticket.', 'error');
                    else alert(result.error || 'Failed to submit ticket.');
                    resetSubmitButton();
                }
            } catch (error) {
                console.error('Submission error:', error);
                if (window.showToast) showToast('Network error. Please try again.', 'error');
                resetSubmitButton();
            }
        });
    }

    function resetSubmitButton() {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed', 'btn-loading');
        submitText.textContent = 'Submit Support Ticket';
        submitIcon.classList.add('fa-paper-plane');
        submitIcon.classList.remove('fa-spinner', 'fa-spin');
    }
});

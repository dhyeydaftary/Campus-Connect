document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('report-issue-form');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

    // Type Selection
    const typeButtons = document.querySelectorAll('.type-btn');
    const hiddenTypeInput = document.getElementById('report_type');
    const formDetails = document.getElementById('form-details');

    // Conditional
    const stepsContainer = document.getElementById('steps-container');
    const severityContainer = document.getElementById('severity-container');
    const severitySelect = document.getElementById('severity');
    const stepsTextarea = document.getElementById('steps_to_reproduce');

    // === Step 1: Type Selection ===
    typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selected state from all
            typeButtons.forEach(b => b.classList.remove('selected'));

            // Set selected
            btn.classList.add('selected');
            const type = btn.getAttribute('data-type');
            hiddenTypeInput.value = type;

            // Show form details
            formDetails.classList.add('open');

            // Conditional fields
            if (type === 'bug') {
                stepsContainer.classList.add('open');
                severityContainer.classList.add('open');
                severitySelect.required = true;
            } else if (type === 'security') {
                stepsContainer.classList.remove('open');
                severityContainer.classList.add('open');
                severitySelect.required = true;
                if (stepsTextarea) stepsTextarea.value = '';
            } else {
                stepsContainer.classList.remove('open');
                severityContainer.classList.remove('open');
                severitySelect.required = false;
                severitySelect.value = '';
                if (stepsTextarea) stepsTextarea.value = '';
            }
        
            // Mobile scroll
            if (window.innerWidth < 768) {
                setTimeout(() => {
                    formDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        });
    });

    // === Multi File Upload ===
    const fileInput = document.getElementById('files');
    const dropzone = document.getElementById('multi-dropzone');
    const previewsContainer = document.getElementById('file-previews');
    let selectedFiles = [];
    const MAX_FILES = 3;
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt'];

    function renderPreviews() {
        previewsContainer.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm file-row-enter';
            row.style.animationDelay = `${index * 0.05}s`;
            const isImage = file.type.startsWith('image/');
            const iconClass = isImage ? 'fa-image text-blue-500' : 'fa-file-lines text-slate-500';
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            row.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i class="fa-solid ${iconClass} text-lg"></i>
                    </div>
                    <div class="truncate">
                        <p class="text-sm font-semibold text-slate-700 truncate">${file.name}</p>
                        <p class="text-xs text-slate-400">${sizeMB} MB</p>
                    </div>
                </div>
                <button type="button" data-index="${index}" class="remove-file-btn w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            `;
            previewsContainer.appendChild(row);
        });

        // Attach remove listeners
        document.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                selectedFiles.splice(idx, 1);
                renderPreviews();
                syncInputFiles();
            });
        });
    }

    function syncInputFiles() {
        const dt = new DataTransfer();
        selectedFiles.forEach(f => dt.items.add(f));
        fileInput.files = dt.files;
    }

    function handleFiles(filesArray) {
        for (const file of filesArray) {
            if (selectedFiles.length >= MAX_FILES) {
                if (window.showToast) showToast(`Maximum ${MAX_FILES} files allowed.`, 'warning');
                break;
            }
            if (file.size > MAX_FILE_SIZE) {
                if (window.showToast) showToast(`File "${file.name}" is too large (> 5MB).`, 'error');
                continue;
            }
            const ext = file.name.split('.').pop().toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                if (window.showToast) showToast(`Invalid type: ${file.name}`, 'error');
                continue;
            }
            selectedFiles.push(file);
        }
        renderPreviews();
        syncInputFiles();
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFiles(Array.from(e.target.files));
                fileInput.value = '';
                syncInputFiles();
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dropzone-active');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dropzone-active');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dropzone-active');
            if (e.dataTransfer.files.length > 0) {
                handleFiles(Array.from(e.dataTransfer.files));
            }
        });
    }

    // === Form Submission ===
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitIcon = document.getElementById('submit-icon');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!hiddenTypeInput.value) {
                if (window.showToast) showToast('Please select the type of issue.', 'error');
                // Shake the type buttons grid
                const grid = document.querySelector('.type-btn')?.parentElement;
                if (grid) {
                    grid.style.animation = 'none';
                    grid.offsetHeight; // trigger reflow
                    grid.style.animation = 'shake 0.4s ease-in-out';
                }
                return;
            }

            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
            submitText.textContent = 'Submitting...';
            submitIcon.className = 'fa-solid fa-spinner fa-spin text-sm';
            const formData = new FormData(form);

            try {
                const response = await fetch('/support/report-issue', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrfToken },
                    body: formData
                });

                const result = await response.json();
                if (response.ok && result.success) {
                    window.location.href = `/support/ticket-success?id=${result.ticket_id}&email=${encodeURIComponent(result.email)}`;
                } else {
                    if (window.showToast) showToast(result.error || 'Failed to submit report.', 'error');
                    else alert(result.error);
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
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        submitText.textContent = 'Submit Report';
        submitIcon.className = 'fa-solid fa-flag text-sm';
    }

    // Shake keyframe (injected once)
    if (!document.getElementById('shake-style')) {
        const style = document.createElement('style');
        style.id = 'shake-style';
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-4px); }
                40%, 80% { transform: translateX(4px); }
            }
            .dropzone-active {
                border-color: #818cf8 !important;
                background-color: #eef2ff !important;
            }
        `;
        document.head.appendChild(style);
    }
});

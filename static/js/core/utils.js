/**
 * ═══════════════════════════════════════════════════════════════
 * GLOBAL UTILITIES
 * Campus Connect - Reusable Components
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Displays a professional, animated toast notification.
 * @param {string} title The title of the toast.
 * @param {string} message The main message content.
 * @param {'success'|'error'|'warning'|'info'} type The type of toast for styling and icon.
 * @param {number} duration The duration in milliseconds before auto-dismissing.
 */
function getCSRFToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

/**
 * Intercept all fetch requests to automatically inject the CSRF token
 * into the headers for state-changing requests (POST, PUT, PATCH, DELETE).
 */
const originalFetch = window.fetch;
window.fetch = async function (resource, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        options.headers = options.headers || {};
        const token = getCSRFToken();

        if (token) {
            if (options.headers instanceof Headers) {
                if (!options.headers.has('X-CSRFToken')) {
                    options.headers.append('X-CSRFToken', token);
                }
            } else {
                options.headers['X-CSRFToken'] = token;
            }
        }
    }

    return originalFetch(resource, options);
};

function showToast(title, message, type = 'info', duration = 5000) {
    try {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-[200] w-full max-w-md space-y-3';
            document.body.appendChild(container);
        }

        const icons = {
            success: `<svg class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            error: `<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            warning: `<svg class="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
            info: `<svg class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
        };

        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.className = 'w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transition-all duration-500 ease-out transform opacity-0 translate-x-full';

        toast.innerHTML = `
            <div class="p-4 relative">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        ${icons[type] || icons.info}
                    </div>
                    <div class="ml-3 w-0 flex-1 pt-0.5">
                        <p class="text-sm font-medium text-gray-900">${title}</p>
                        <p class="mt-1 text-sm text-gray-500">${message}</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button class="close-toast-btn bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <span class="sr-only">Close</span>
                            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
                <!-- Progress Bar Container -->
                <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
                    <div class="toast-progress w-full h-full ${type === 'success' ? 'bg-green-400' : type === 'error' ? 'bg-red-400' : type === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'}" style="width: 100%;"></div>
                </div>
            </div>
        `;

        container.appendChild(toast);

        const progressBar = toast.querySelector('.toast-progress');

        // Animate in using double requestAnimationFrame for reliable CSS transition trigger
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.remove('opacity-0', 'translate-x-full');
                toast.classList.add('opacity-100', 'translate-x-0');

                if (progressBar) {
                    progressBar.style.transition = `width ${duration}ms linear`;
                    progressBar.style.width = '0%';
                }
            });
        });

        const dismiss = () => {
            toast.classList.remove('opacity-100', 'translate-x-0');
            toast.classList.add('opacity-0', 'translate-x-full');

            // Remove toast safely after exit transition matches Tailwind's duration-500
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 500);
        };

        const autoDismissTimer = setTimeout(dismiss, duration);

        toast.querySelector('.close-toast-btn').addEventListener('click', () => {
            clearTimeout(autoDismissTimer);
            dismiss();
        });

    } catch (error) {
        console.error("Toast Notification Error:", error);
    }
}
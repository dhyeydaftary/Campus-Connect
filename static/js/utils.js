/**
 * ═══════════════════════════════════════════════════════════════
 * GLOBAL UTILITIES
 * Campus Connect - Reusable Component
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Displays a toast notification at the bottom-right of the screen.
 * @param {string} message The message to display.
 * @param {'success'|'error'|'info'} type The type of toast, for styling.
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const typeClasses = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-indigo-500'
    };
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50 transition-all duration-300 ${typeClasses[type] || 'bg-gray-800'}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; }, 2700);
    setTimeout(() => toast.remove(), 3000);
}
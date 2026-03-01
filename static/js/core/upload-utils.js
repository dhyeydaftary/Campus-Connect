/**
 * Shared Profile Photo Upload Utilities
 * Handles validation, API upload, and global UI updates
 */

window.ProfileUpload = {
    async upload(file) {
        if (!file) throw new Error('No file selected');
        
        // Validate size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File size too large. Max 5MB allowed.');
        }

        // Validate type
        if (!file.type.startsWith('image/')) {
            throw new Error('Please upload an image file.');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/profile/photo', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }

        return data.url;
    },

    updateGlobalAvatars(url) {
        // Update all avatar images on the page with specific IDs or classes
        const selectors = ['#home-profile-img', '#navbar-avatar', '.nav-avatar', '#user-menu-button img', '.profile-avatar-img'];
        const images = document.querySelectorAll(selectors.join(','));
        images.forEach(img => img.src = url);
    }
};
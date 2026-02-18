/**
 * Campus Connect Admin Panel - API Module
 * This module centralizes all API calls for the admin dashboard.
 */
const API_BASE = '';

/**
 * An object that encapsulates all API calls for the admin dashboard.
 * Each method corresponds to a specific backend endpoint.
 */
const API = {
    /**
     * Fetches the main overview data for the dashboard KPIs and charts.
     */
    async getDashboardOverview() {
        try {
            const response = await fetch(`${API_BASE}/admin/api/dashboard/overview`);
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.error('Failed to get dashboard overview:', error);
            throw error; // Re-throw the error to be handled by the caller
        }
    },
    /**
     * Fetches a list of all users for the user management table.
     */
    async getUsers() {
        const response = await fetch(`${API_BASE}/admin/api/users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return await response.json();
    },
    /**
     * Toggles the active/blocked status of a specific user.
     * @param {number} userId - The ID of the user to toggle.
     */
    async toggleUser(userId) {
        const response = await fetch(`${API_BASE}/admin/api/users/${userId}/toggle`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to toggle user status');
        return await response.json();
    },
    /**
     * Fetches metadata required for the event creation form, such as eligible creators.
     */
    async getEventsMeta() {
        const response = await fetch(`${API_BASE}/admin/api/events/meta`);
        if (!response.ok) throw new Error('Failed to fetch events metadata');
        return await response.json();
    },
    /**
     * Creates a new event via the admin panel.
     * @param {object} eventData - The data for the new event.
     */
    async createEvent(eventData) {
        const response = await fetch(`${API_BASE}/admin/api/events/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });
        if (!response.ok) throw new Error('Failed to create event');
        return await response.json();
    },
    /**
     * Fetches a list of all announcements.
     */
    async getAnnouncements() {
        const response = await fetch(`${API_BASE}/admin/api/announcements`);
        if (!response.ok) throw new Error('Failed to fetch announcements');
        return await response.json();
    },
    /**
     * Creates a new global announcement.
     * @param {string} text - The content of the announcement.
     */
    async createAnnouncement(text) {
        const response = await fetch(`${API_BASE}/admin/api/announcements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!response.ok) throw new Error('Failed to create announcement');
        return await response.json();
    },
    /**
     * Fetches the latest admin action logs.
     */
    async getLogs() {
        const response = await fetch(`${API_BASE}/admin/api/logs`);
        if (!response.ok) throw new Error('Failed to fetch logs');
        return await response.json();
    }
};
// Export for use in other scripts
window.API = API;
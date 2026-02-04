// Campus Connect Admin Panel - API Module
// This module handles all API calls with mock data fallback
const API_BASE = '';
// Mock data for development/demo
const mockData = {
    dashboard: {
        totalUsers: 12847,
        activeUsers: 9234,
        blockedUsers: 156,
        totalPosts: 45892,
        totalEvents: 324,
        userGrowth: [
            { month: 'Jan', users: 8500 },
            { month: 'Feb', users: 9200 },
            { month: 'Mar', users: 9800 },
            { month: 'Apr', users: 10500 },
            { month: 'May', users: 11200 },
            { month: 'Jun', users: 12847 }
        ],
        roleDistribution: {
            students: 10234,
            official: 1845,
            admin: 1,
            clubs: 312
        },
        contentActivity: {
            posts: [3200, 4100, 3800, 4500, 5200, 4800],
            events: [45, 52, 48, 61, 58, 72]
        },
        topAccounts: [
            { name: 'student Council', type: 'Official', followers: 8542 },
            { name: 'Tech club', type: 'club', followers: 5234 },
            { name: 'Sports Association', type: 'Official', followers: 4892 },
            { name: 'Art Society', type: 'club', followers: 3654 },
            { name: 'Drama club', type: 'club', followers: 2987 }
        ],
        systemHealth: {
            api: { status: 'online', latency: 45 },
            database: { status: 'online', latency: 12 },
            storage: { status: 'online', usage: 67 },
            cache: { status: 'online', hitRate: 94 }
        }
    },
    users: [
        { id: 1, username: 'john.doe', email: 'john.doe@campus.edu', role: 'student', status: 'active', joinDate: '2024-01-15' },
        { id: 2, username: 'jane.smith', email: 'jane.smith@campus.edu', role: 'official', status: 'active', joinDate: '2023-09-01' },
        { id: 3, username: 'mike.wilson', email: 'mike.wilson@campus.edu', role: 'student', status: 'blocked', joinDate: '2024-02-20' },
        { id: 4, username: 'sarah.johnson', email: 'sarah.johnson@campus.edu', role: 'official', status: 'active', joinDate: '2023-11-10' },
        { id: 5, username: 'techclub', email: 'tech.club@campus.edu', role: 'club', status: 'active', joinDate: '2023-08-15' },
        { id: 6, username: 'alex.brown', email: 'alex.brown@campus.edu', role: 'student', status: 'active', joinDate: '2024-03-05' },
        { id: 7, username: 'emma.davis', email: 'emma.davis@campus.edu', role: 'official', status: 'active', joinDate: '2022-08-20' },
        { id: 8, username: 'chris.lee', email: 'chris.lee@campus.edu', role: 'Student', status: 'inactive', joinDate: '2023-12-01' },
        { id: 9, username: 'artclub', email: 'art.club@campus.edu', role: 'club', status: 'active', joinDate: '2023-07-10' },
        { id: 10, username: 'lisa.wang', email: 'lisa.wang@campus.edu', role: 'official', status: 'active', joinDate: '2024-01-08' }
    ],
    eventsMeta: {
        eventTypes: ['official', 'club'],
        targetEntities: [
            { id: 1, name: 'All Students', type: 'group' },
            { id: 2, name: 'Computer Science Dept', type: 'department' },
            { id: 3, name: 'Tech club', type: 'club' },
            { id: 4, name: 'Sports Association', type: 'club' },
            { id: 5, name: 'Art Society', type: 'club' },
            { id: 6, name: 'Engineering official', type: 'department' },
            { id: 7, name: 'Business School', type: 'department' }
        ]
    },
    announcements: [
        { id: 1, text: 'Campus will be closed on December 25th for the holiday. All classes resume January 3rd.', date: '2024-12-20', author: 'Admin' },
        { id: 2, text: 'New library hours: Monday-Friday 7AM-11PM, Saturday-Sunday 9AM-9PM starting next semester.', date: '2024-12-18', author: 'Admin' },
        { id: 3, text: 'Registration for Spring 2025 courses opens on January 5th. Priority registration for seniors begins January 3rd.', date: '2024-12-15', author: 'Registrar' },
        { id: 4, text: 'Important: All students must complete their health and safety training by December 30th.', date: '2024-12-10', author: 'Admin' }
    ],
    logs: [
        { id: 1, action: 'User Blocked', target: 'mike.wilson', admin: 'admin@campus.edu', timestamp: '2024-12-20 14:32:15', ip: '192.168.1.45' },
        { id: 2, action: 'Announcement Created', target: 'Holiday Notice', admin: 'admin@campus.edu', timestamp: '2024-12-20 10:15:00', ip: '192.168.1.45' },
        { id: 3, action: 'Event Created', target: 'Spring Festival 2025', admin: 'events@campus.edu', timestamp: '2024-12-19 16:45:30', ip: '192.168.1.52' },
        { id: 4, action: 'User Activated', target: 'new.student', admin: 'admin@campus.edu', timestamp: '2024-12-19 11:20:00', ip: '192.168.1.45' },
        { id: 5, action: 'Settings Updated', target: 'Email Notifications', admin: 'system@campus.edu', timestamp: '2024-12-18 09:30:00', ip: '192.168.1.1' },
        { id: 6, action: 'Role Changed', target: 'jane.smith', admin: 'admin@campus.edu', timestamp: '2024-12-17 14:00:00', ip: '192.168.1.45' },
        { id: 7, action: 'Content Removed', target: 'Post #4521', admin: 'mod@campus.edu', timestamp: '2024-12-17 11:45:00', ip: '192.168.1.60' },
        { id: 8, action: 'club Approved', target: 'Chess club', admin: 'admin@campus.edu', timestamp: '2024-12-16 15:20:00', ip: '192.168.1.45' }
    ],
    systemStatus: {
        api: { name: 'API Server', status: 'online', uptime: '99.98%', responseTime: '45ms' },
        database: { name: 'Primary Database', status: 'online', uptime: '99.99%', connections: 234 },
        cache: { name: 'Redis Cache', status: 'online', uptime: '99.95%', hitRate: '94.2%' },
        storage: { name: 'File Storage', status: 'online', uptime: '99.97%', usage: '67.3%' },
        email: { name: 'Email Service', status: 'online', uptime: '99.90%', queue: 12 },
        search: { name: 'Search Engine', status: 'warning', uptime: '98.50%', indexing: 'rebuilding' }
    }
};
// Simulated API delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// API Functions
const API = {
    // Dashboard
    async getDashboardOverview() {
        try {
            const response = await fetch(`${API_BASE}/admin/api/dashboard/overview`);
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Using mock data for dashboard');
            await delay(500);
            return mockData.dashboard;
        }
    },
    // Users
    async getUsers() {
        try {
            const response = await fetch(`${API_BASE}/admin/api/users`);
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Using mock data for users');
            await delay(400);
            return mockData.users;
        }
    },
    async toggleUser(userId) {
        try {
            const response = await fetch(`${API_BASE}/admin/api/users/${userId}/toggle`, {
                method: 'POST'
            });
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Mock toggle user:', userId);
            await delay(300);
            const user = mockData.users.find(u => u.id === userId);
            if (user) {
                user.status = user.status === 'active' ? 'blocked' : 'active';
            }
            return { success: true, user };
        }
    },
    // Events
    async getEventsMeta() {
        try {
            const response = await fetch(`${API_BASE}/admin/api/events/meta`);
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Using mock data for events meta');
            await delay(300);
            return mockData.eventsMeta;
        }
    },
    async createEvent(eventData) {
        try {
            const response = await fetch(`${API_BASE}/admin/api/events/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            });
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Mock create event:', eventData);
            await delay(400);
            return { success: true, event: { id: Date.now(), ...eventData } };
        }
    },
    // Announcements
    async getAnnouncements() {
        try {
            const response = await fetch(`${API_BASE}/admin/api/announcements`);
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Using mock data for announcements');
            await delay(300);
            return mockData.announcements;
        }
    },
    async createAnnouncement(text) {
        try {
            const response = await fetch(`${API_BASE}/admin/api/announcements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Mock create announcement:', text);
            await delay(300);
            const newAnnouncement = {
                id: Date.now(),
                text,
                date: new Date().toISOString().split('T')[0],
                author: 'Admin'
            };
            mockData.announcements.unshift(newAnnouncement);
            return { success: true, announcement: newAnnouncement };
        }
    },
    // Logs
    async getLogs() {
        try {
            const response = await fetch(`${API_BASE}/admin/api/logs`);
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.log('Using mock data for logs');
            await delay(400);
            return mockData.logs;
        }
    }
};
// Export for use in other scripts
window.API = API;
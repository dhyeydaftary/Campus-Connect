document.addEventListener("DOMContentLoaded", () => {
    // Feature Data
    const features = [
        {
            icon: 'users',
            title: 'Campus-Only Network',
            description: 'Connect exclusively with verified students from your college. Build genuine, meaningful relationships.',
        },
        {
            icon: 'trophy',
            title: 'Events & Hackathons',
            description: 'Discover hackathons, clubs, tournaments, and campus events. Never miss an opportunity again.',
        },
        {
            icon: 'zap',
            title: 'Smart Feed',
            description: 'A personalized feed that keeps you updated with what matters most in your campus community.',
        },
    ];

    // Render Features
    const grid = document.getElementById('feature-grid');
    features.forEach((feature, index) => {
        const card = `
        <div class="animate-fade-in" style="animation-delay: ${index * 0.1}s">
            <div class="border border-gray-100 shadow-sm hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 h-full rounded-xl bg-white overflow-hidden">
                <div class="p-6 text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 mb-4">
                        <i data-lucide="${feature.icon}" class="h-7 w-7 text-indigo-600"></i>
                    </div>
                    <h3 class="font-semibold text-lg text-gray-900 mb-2">${feature.title}</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">${feature.description}</p>
                </div>
            </div>
        </div>
    `;
        grid.innerHTML += card;
    });

    // Initialize Lucide Icons
    lucide.createIcons();
});
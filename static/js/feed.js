function feedApp() {
    return {
        newPost: '',
        posts: [
            {
                id: 1,
                user: 'Sarah Chen',
                content: '🚀 Just finished my AI/ML project!',
                likes: 42,
                liked: false,
                time: new Date(Date.now() - 1800000)
            },
            {
                id: 2,
                user: 'Marcus Williams',
                content: 'Anyone joining the campus hackathon?',
                likes: 28,
                liked: true,
                time: new Date(Date.now() - 7200000)
            }
        ],

        init() {
            lucide.createIcons();
        },

        addPost() {
            if (!this.newPost.trim()) return;

            this.posts.unshift({
                id: Date.now(),
                user: 'Alex Johnson',
                content: this.newPost,
                likes: 0,
                liked: false,
                time: new Date()
            });

            this.newPost = '';
            this.$nextTick(() => lucide.createIcons());
        },

        toggleLike(post) {
            post.liked = !post.liked;
            post.likes += post.liked ? 1 : -1;
        },

        timeAgo(date) {
            const mins = Math.floor((Date.now() - new Date(date)) / 60000);
            if (mins < 1) return 'Just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            return `${Math.floor(hrs / 24)}d ago`;
        },

        initials(name) {
            return name.split(' ').map(n => n[0]).join('');
        }
    }
}

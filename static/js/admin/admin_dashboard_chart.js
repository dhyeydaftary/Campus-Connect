/**
 * Main entry point for the admin dashboard. Fetches overview data and renders all charts and KPIs.
 */
 document.addEventListener("DOMContentLoaded", () => {
    if (typeof Chart === "undefined") {
        console.error("Chart.js not loaded");
        return;
    }

    fetch("/admin/api/dashboard/overview")
        .then(res => {
            if (!res.ok) throw new Error("Dashboard API failed");
            return res.json();
        })
        .then(data => {
            /* ===============================
                KPIs
            =============================== */
            /**
             * Safely sets the text content of an element by its ID.
             * @param {string} id - The ID of the DOM element.
             * @param {string|number} val - The value to set as text content.
             */
            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val?.toLocaleString?.() ?? "0";
            };

            setText("active-users", data.activeUsers);
            setText("pending-users", data.pendingUsers);
            setText("blocked-users", data.blockedUsers);
            setText("total-posts", data.totalPosts);
            setText("active-events", data.activeEvents);

            /* ===============================
                CONTENT ACTIVITY (WORKING)
            =============================== */
            if (data.contentActivity) {
                const canvas = document.getElementById("contentActivityChart");
                if (canvas) {
                    if (window.contentActivityChartInstance) {
                        window.contentActivityChartInstance.destroy();
                    }

                    window.contentActivityChartInstance = new Chart(
                        canvas.getContext("2d"),
                        {
                            type: "line",
                            data: {
                                labels: data.contentActivity.labels,
                                datasets: [
                                    {
                                        label: "Posts",
                                        data: data.contentActivity.posts,
                                        borderColor: "#4F46E5",
                                        backgroundColor: "rgba(79,70,229,0.15)",
                                        fill: true,
                                        tension: 0.3
                                    },
                                    {
                                        label: "Events",
                                        data: data.contentActivity.events,
                                        borderColor: "#10B981",
                                        backgroundColor: "rgba(16,185,129,0.15)",
                                        fill: true,
                                        tension: 0.3
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    y: { beginAtZero: true }
                                }
                            }
                        }
                    );
                }
            }

            /* ===============================
                USER GROWTH
            =============================== */
            if (Array.isArray(data.userGrowth) && data.userGrowth.length) {
                const canvas = document.getElementById("userGrowthChart");
                if (canvas) {
                    new Chart(canvas.getContext("2d"), {
                        type: "line",
                        data: {
                            labels: data.userGrowth.map(d => d.month),
                            datasets: [{
                                label: "Users",
                                data: data.userGrowth.map(d => d.users),
                                borderColor: "#3b82f6",
                                backgroundColor: "#3b82f6",
                                pointRadius: 6,
                                pointHoverRadius: 8,
                                showLine: false,
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { beginAtZero: true }
                            }
                        }
                    });
                }
            }

            /* ===============================
                ROLE DISTRIBUTION
            =============================== */
            // Always show these roles in legend
            const ALL_ROLES = ["admin", "student", "official", "club"];

            // Normalize backend data (fill missing roles with 0)
            const roleCounts = {
                admin: 0,
                student: 0,
                official: 0,
                club: 0,
                ...(data.roleDistribution || {})
            };

            const canvas = document.getElementById("roleDistributionChart");

            if (canvas) {
                new Chart(canvas.getContext("2d"), {
                    type: "doughnut",
                    data: {
                        labels: ALL_ROLES.map(
                            role => role.charAt(0).toUpperCase() + role.slice(1)
                        ),
                        datasets: [{
                            data: ALL_ROLES.map(role => roleCounts[role]),
                            backgroundColor: [
                                "#3b82f6", // Admin
                                "#10b981", // Student
                                "#f59e0b", // Official
                                "#8b5cf6"  // Club
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: "right" }
                        }
                    }
                });
            }
        })
        .catch(err => {
            console.error("Dashboard failed:", err);
        });
});

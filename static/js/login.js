document.addEventListener("DOMContentLoaded", () => {

    // Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Mock login (frontend only)
    async function mockLogin(email, password) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(email && password.length >= 6);
            }, 500);
        });
    }

    // Toast
    function showToast(title, description, destructive = false) {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");

        toast.className = `toast ${destructive ? "destructive" : ""}`;
        toast.innerHTML = `
            <div class="font-semibold text-sm">${title}</div>
            <div class="text-xs text-slate-500 mt-1">${description}</div>
        `;

        container.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 10);

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Form
    const form = document.getElementById("login-form");
    const btn = document.getElementById("login-btn");
    const btnText = document.getElementById("btn-text");
    const btnIcon = document.getElementById("btn-icon");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        btn.disabled = true;
        btnText.textContent = "Logging in...";
        btnIcon.classList.add("hidden");

        const success = await mockLogin(email, password);

        if (success) {
            showToast("Welcome back!", "Login successful.");
            setTimeout(() => {
                window.location.href = "/home";
            }, 1000);
        } else {
            showToast("Login failed", "Invalid email or password.", true);
            btn.disabled = false;
            btnText.textContent = "Login";
            btnIcon.classList.remove("hidden");
        }
    });
});

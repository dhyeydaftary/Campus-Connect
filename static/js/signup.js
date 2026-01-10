document.addEventListener("DOMContentLoaded", () => {

    // Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Mock register
    async function mockRegister(name, email, password) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(name && email && password.length >= 6);
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

    const form = document.getElementById("register-form");
    const btn = document.getElementById("register-btn");
    const btnText = document.getElementById("btn-text");
    const btnIcon = document.getElementById("btn-icon");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirm = document.getElementById("confirm-password").value;

        if (password !== confirm) {
            showToast("Passwords do not match", "Please check again.", true);
            return;
        }

        if (!email.endsWith(".edu") && !email.endsWith(".ac.in")) {
            showToast("Invalid email", "Use a college email (.edu or .ac.in).", true);
            return;
        }

        btn.disabled = true;
        btnText.textContent = "Creating account...";
        btnIcon.classList.add("hidden");

        const success = await mockRegister(name, email, password);

        if (success) {
            showToast("Account created!", "Welcome to CampusConnect.");
            setTimeout(() => {
                window.location.href = "/home";
            }, 1000);
        } else {
            showToast("Registration failed", "Please try again.", true);
            btn.disabled = false;
            btnText.textContent = "Create Account";
            btnIcon.classList.remove("hidden");
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {

    // Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Toast utility
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

    // Form handling
    const form = document.getElementById("login-form");
    const btn = document.getElementById("login-btn");
    const btnText = document.getElementById("btn-text");
    const btnIcon = document.getElementById("btn-icon");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            showToast("Missing fields", "Email and password are required.", true);
            return;
        }

        // Button loading state
        btn.disabled = true;
        btnText.textContent = "Logging in...";
        btnIcon.classList.add("hidden");

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (response.ok) {
                showToast(`Welcome back, ${result.user_name}!`, "Login successful.");
                setTimeout(() => {
                    window.location.href = "/home";
                }, 800);
            } else {
                showToast("Login failed", result.error || "Invalid credentials.", true);
                btn.disabled = false;
                btnText.textContent = "Login";
                btnIcon.classList.remove("hidden");
            }

        } catch (error) {
            showToast("Error", "Server not reachable. Try again.", true);
            btn.disabled = false;
            btnText.textContent = "Login";
            btnIcon.classList.remove("hidden");
        }
    });
});

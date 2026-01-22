document.addEventListener("DOMContentLoaded", () => {

    // Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Toast Notification System
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

    // FORM HANDLING
    const form = document.getElementById("signupForm"); // Matches updated HTML ID
    const btn = document.getElementById("register-btn");
    const btnText = document.getElementById("btn-text");
    const btnIcon = document.getElementById("btn-icon");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // 1. DATA EXTRACTION
        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const branch = document.getElementById("branch").value.trim();
        const batch = document.getElementById("batch").value.trim();
        const password = document.getElementById("password").value;
        const confirm = document.getElementById("confirm-password").value;

        // 2. FRONTEND VALIDATION
        if (password !== confirm) {
            showToast("Passwords do not match", "Please check again.", true);
            return;
        }

        if (!email.endsWith(".edu") && !email.endsWith(".ac.in")) {
            showToast("Invalid email", "Use a college email (.edu or .ac.in).", true);
            return;
        }

        // 3. UI STATE: LOADING
        btn.disabled = true;
        btnText.textContent = "Creating account...";
        btnIcon.style.display = "none";

        // 4. REAL API CALL (Replaces mockRegister)
        try {
            const response = await fetch("/api/signup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    branch: branch,
                    batch: batch,
                    password: password
                })
            });

            const result = await response.json();

            if (response.ok) {
                showToast("Account created!", "Welcome to CampusConnect.");
                setTimeout(() => {
                    window.location.href = "/login"; // Redirect to login
                }, 1500);
            } else {
                showToast("Registration failed", result.error || "Please try again.", true);
                resetButton();
            }
        } catch (error) {
            showToast("Server Error", "Could not connect to the database.", true);
            resetButton();
        }
    });

    function resetButton() {
        btn.disabled = false;
        btnText.textContent = "Create Account";
        btnIcon.style.display = "inline-block";
    }
});
document.addEventListener("DOMContentLoaded", () => {

    // Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Mock profile update
    async function mockUpdateProfile(name, email, password) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(name && email);
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

    const form = document.getElementById("profile-form");
    const btn = document.getElementById("profile-btn");
    const btnText = document.getElementById("btn-text");
    const btnIcon = document.getElementById("btn-icon");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email.endsWith(".edu") && !email.endsWith(".ac.in")) {
            showToast("Invalid email", "Use a college email (.edu or .ac.in).", true);
            return;
        }

        btn.disabled = true;
        btnText.textContent = "Saving...";
        btnIcon.classList.add("hidden");

        const success = await mockUpdateProfile(name, email, password);

        if (success) {
            showToast("Profile updated", "Your changes were saved.");
        } else {
            showToast("Update failed", "Please try again.", true);
        }

        btn.disabled = false;
        btnText.textContent = "Save Changes";
        btnIcon.classList.remove("hidden");
    });
});

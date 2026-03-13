document.addEventListener("DOMContentLoaded", () => {

    // Icons
    if (window.lucide) lucide.createIcons();

    // DOM refs
    const form = document.getElementById("login-form");
    const btn = document.getElementById("login-btn");
    const btnText = document.getElementById("btn-text");
    const btnIcon = document.getElementById("btn-icon");

    const majorSelect = document.getElementById("major");
    const enrollmentInput = document.getElementById("enrollment");
    const suggestionsBox = document.getElementById("suggestions-box");
    const nameInput = document.getElementById("student-name");
    const emailInput = document.getElementById("college-email");

    const studentFlow = document.getElementById("student-flow");
    const otpFlow = document.getElementById("otp-flow");

    const studentPassContainer = document.getElementById("student-password-container");
    const studentPassInput = document.getElementById("student-password");

    const pEmailContainer = document.getElementById("personal-email-container");
    const pEmailInput = document.getElementById("personal-gmail");
    const pEmailError = document.getElementById("personal-email-error");

    const maskedEmailSpan = document.getElementById("masked-email");
    const loginFooter = document.getElementById("login-footer");
    const resendBtn = document.getElementById("resend-btn");
    const otpTimer = document.getElementById("otp-timer");

    let currentStep = "credentials";
    let studentHasPassword = false;
    let studentHasPersonalEmail = false;
    let debounceTimer;


    let lastCheckedEnrollment = null;

    // ========== 1. BRANCH SELECTION ==========
    majorSelect.addEventListener("change", () => {
        if (majorSelect.value) {
            enrollmentInput.disabled = false;
            enrollmentInput.placeholder = "Start typing enrollment no...";
            enrollmentInput.focus();
            enrollmentInput.value = "";
            nameInput.value = "";
            emailInput.value = "";
            studentPassContainer.classList.remove("open");
            studentPassInput.value = "";
            pEmailContainer.classList.add("hidden");
            pEmailInput.value = "";
            pEmailError.classList.add("hidden");
            btn.disabled = true;
            lastCheckedEnrollment = null;
        }
    });

    // ========== 2. ENROLLMENT SUGGESTIONS (debounced) ==========
    enrollmentInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        const major = majorSelect.value;

        nameInput.value = "";
        emailInput.value = "";
        studentPassContainer.classList.remove("open");
        studentPassInput.value = "";
        pEmailContainer.classList.add("hidden");
        pEmailInput.value = "";
        pEmailError.classList.add("hidden");
        btn.disabled = true;
        lastCheckedEnrollment = null;

        clearTimeout(debounceTimer);
        suggestionsBox.classList.add("hidden");

        if (query.length < 3) return;

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch("/api/auth/enrollment-suggestions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ major, query })
                });
                const data = await response.json();
                showSuggestions(data.suggestions);
            } catch (error) {
                console.error("Error fetching suggestions:", error);
            }
        }, 300);
    });

    // ========== 3. SHOW SUGGESTIONS ==========
    function showSuggestions(suggestions) {
        suggestionsBox.innerHTML = "";
        if (!suggestions || suggestions.length === 0) {
            suggestionsBox.classList.add("hidden");
            return;
        }

        suggestions.forEach(enrollment => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "suggestion-item w-full text-left px-4 py-2.5 cursor-pointer text-sm text-slate-700";
            button.textContent = enrollment;
            // Prevent input from losing focus immediately on click/touch
            button.addEventListener("mousedown", (e) => e.preventDefault());
            button.addEventListener("touchstart", (e) => {
                e.preventDefault();
                // On mobile, immediately select on touchstart for better responsiveness
                selectEnrollment(enrollment);
            }, { passive: false });
            button.addEventListener("click", () => selectEnrollment(enrollment));
            suggestionsBox.appendChild(button);
        });

        suggestionsBox.classList.remove("hidden");
    }

    // ========== 4. SELECT ENROLLMENT ==========
    function selectEnrollment(enrollment) {
        enrollmentInput.value = enrollment;
        suggestionsBox.classList.add("hidden");
        enrollmentInput.blur(); // Dismiss mobile keyboard
        checkStudentDetails(enrollment);
    }

    async function checkStudentDetails(enrollment) {
        if (!enrollment || enrollment === lastCheckedEnrollment) return;
        lastCheckedEnrollment = enrollment;

        try {
            const response = await fetch("/api/auth/student_details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enrollment_no: enrollment })
            });

            if (response.ok) {
                const data = await response.json();
                nameInput.value = data.full_name;
                emailInput.value = data.email;
                studentHasPassword = data.has_password;
                studentHasPersonalEmail = data.has_personal_email;

                if (studentHasPassword) {
                    studentPassContainer.classList.add("open");
                    pEmailContainer.classList.add("hidden");
                    btnText.textContent = "Login";
                    currentStep = "password";
                    setTimeout(() => studentPassInput.focus(), 150);
                } else {
                    studentPassContainer.classList.remove("open");
                    if (!studentHasPersonalEmail) {
                        pEmailContainer.classList.remove("hidden");
                        currentStep = "set_personal_email";
                        btnText.textContent = "Save & Continue";
                    } else {
                        pEmailContainer.classList.add("hidden");
                        btnText.textContent = "Send OTP";
                        currentStep = "credentials";
                    }
                }
                btn.disabled = false;
            } else {
                lastCheckedEnrollment = null; // allow retrying
                const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
                showToast("Error", errorData.error || "Student details not found.", "error");
                btn.disabled = true;
            }
        } catch (error) {
            lastCheckedEnrollment = null; // allow retrying
            showToast("Network Error", "Failed to fetch student details.", "error");
        }
    }

    enrollmentInput.addEventListener("change", () => {
        const val = enrollmentInput.value.trim();
        if (val) checkStudentDetails(val);
    });

    document.addEventListener("click", (e) => {
        if (!enrollmentInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add("hidden");
        }
    });

    // ========== 5. OTP TIMER ==========
    let otpInterval;

    function startOtpTimer(expiryIso) {
        if (otpInterval) clearInterval(otpInterval);

        const expiryTime = new Date(expiryIso).getTime();
        otpTimer.classList.remove("hidden");
        if (resendBtn) {
            resendBtn.disabled = true;
            resendBtn.textContent = "Resend OTP";
        }

        function updateTimer() {
            const distance = expiryTime - Date.now();
            if (distance < 0) {
                clearInterval(otpInterval);
                otpTimer.textContent = "OTP Expired";
                otpTimer.classList.add("text-red-500");
                if (resendBtn) resendBtn.disabled = false;
                return;
            }
            const minutes = Math.floor((distance % 3600000) / 60000);
            const seconds = Math.floor((distance % 60000) / 1000);
            otpTimer.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            otpTimer.classList.remove("text-red-500");
        }

        updateTimer();
        otpInterval = setInterval(updateTimer, 1000);
    }

    // ========== 6. SEND OTP ==========
    async function sendOtp() {
        const enrollment = enrollmentInput.value.trim();
        const major = majorSelect.value;
        if (!enrollment || !major) return;

        btn.disabled = true;
        if (currentStep === "credentials") btnText.textContent = "Sending OTP...";
        resendBtn.disabled = true;

        try {
            const response = await fetch("/api/auth/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enrollment_no: enrollment, major: major })
            });
            const result = await response.json();

            if (response.ok) {
                currentStep = "otp";
                studentFlow.classList.add("hidden");
                otpFlow.classList.remove("hidden");
                maskedEmailSpan.textContent = result.email;
                btnText.textContent = "Verify & Login";
                showToast("OTP Sent", `Check your email at ${result.email}`, "info");
                startOtpTimer(result.expiry_time);
                setTimeout(() => document.getElementById("otp")?.focus(), 200);
            } else {
                showToast("Error", result.error || "Failed to send OTP", "error");
                resendBtn.disabled = false;
            }
        } catch (error) {
            showToast("Network Error", "Please try again.", "error");
            resendBtn.disabled = false;
        } finally {
            btn.disabled = false;
            if (currentStep === "otp") btnText.textContent = "Verify & Login";
        }
    }

    if (resendBtn) {
        resendBtn.addEventListener("click", (e) => {
            e.preventDefault();
            sendOtp();
        });
    }

    // ========== 7. FORM SUBMIT ==========
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        btn.disabled = true;
        btn.classList.add("btn-loading");
        btnIcon.classList.add("hidden");

        try {
            // --- PASSWORD LOGIN ---
            if (studentHasPassword && currentStep === "password") {
                const enrollment = enrollmentInput.value.trim();
                const password = studentPassInput.value;

                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "student", enrollment_no: enrollment, password })
                });
                const result = await response.json();

                if (response.ok) {
                    showToast("Success", "Login successful, redirecting...", "success");
                    window.location.replace(result.redirect_url);
                    return;
                } else {
                    showToast("Login Failed", result.error, "error");
                    studentPassInput.parentElement.classList.add("animate-shake");
                    setTimeout(() => studentPassInput.parentElement.classList.remove("animate-shake"), 400);
                }
            }
            // --- SET PERSONAL EMAIL ---
            else if (currentStep === "set_personal_email") {
                const enrollment = enrollmentInput.value.trim();
                const personalEmail = pEmailInput.value.trim();

                if (!personalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
                    pEmailError.textContent = "Please enter a valid email address.";
                    pEmailError.classList.remove("hidden");
                    throw new Error("Validation failed");
                }
                pEmailError.classList.add("hidden");

                btnText.textContent = "Saving...";
                const response = await fetch("/api/auth/set-personal-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enrollment_no: enrollment, personal_email: personalEmail })
                });
                const result = await response.json();

                if (response.ok) {
                    studentHasPersonalEmail = true;
                    pEmailContainer.classList.add("hidden");
                    currentStep = "credentials";
                    await sendOtp();
                } else {
                    pEmailError.textContent = result.message || "Failed to save email.";
                    pEmailError.classList.remove("hidden");
                    throw new Error("API failed");
                }
            }
            // --- OTP REQUEST ---
            else if (currentStep === "credentials") {
                if (!enrollmentInput.value || !majorSelect.value || !nameInput.value) {
                    showToast("Incomplete", "Please select a valid student from the suggestions.", "warning");
                    throw new Error("Validation failed");
                }
                await sendOtp();
            }
            // --- OTP VERIFY ---
            else if (currentStep === "otp") {
                const enrollment = enrollmentInput.value.trim();
                const otp = document.getElementById("otp").value.trim();

                if (!otp || otp.length !== 6) {
                    showToast("Invalid OTP", "Please enter a valid 6-digit OTP.", "warning");
                    throw new Error("Validation failed");
                }

                btnText.textContent = "Verifying...";
                const response = await fetch("/api/auth/verify-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enrollment_no: enrollment, otp })
                });
                const result = await response.json();

                if (response.ok) {
                    showToast("Success", "Login successful! Redirecting...", "success");
                    setTimeout(() => window.location.replace(result.redirect_url || "/home"), 800);
                    return;
                } else {
                    showToast("Verification Failed", result.error || "Invalid OTP.", "error");
                }
            }
        } catch (error) {
            if (error.message !== "Validation failed") {
                showToast("System Error", "Something went wrong. Please try again.", "error");
            }
        } finally {
            btn.disabled = false;
            btn.classList.remove("btn-loading");
            btnIcon.classList.remove("hidden");

            if (currentStep === "password") btnText.textContent = "Login";
            else if (currentStep === "credentials") btnText.textContent = "Send OTP";
            else if (currentStep === "set_personal_email") btnText.textContent = "Save & Continue";
            else if (currentStep === "otp") btnText.textContent = "Verify & Login";
        }
    });

    // ========== 8. FORGOT PASSWORD MODAL ==========
    const forgotLink = document.getElementById("forgot-password-link");
    const forgotModal = document.getElementById("forgot-password-modal");
    const closeForgotModal = document.getElementById("close-forgot-modal");
    const forgotForm = document.getElementById("forgot-password-form");
    const fpBtn = document.getElementById("fp-btn");
    const fpBtnText = document.getElementById("fp-btn-text");
    const fpBtnSpinner = document.getElementById("fp-btn-spinner");
    const fpStatus = document.getElementById("fp-status");
    const fpIdentifier = document.getElementById("fp-identifier");

    const openModal = () => {
        forgotModal.classList.remove("hidden");
        forgotModal.classList.add("flex");
        requestAnimationFrame(() => forgotModal.classList.add("active"));
        fpIdentifier.value = "";
        fpStatus.textContent = "A link to reset your password will be sent to your email.";
        fpStatus.className = "text-xs text-slate-500 mt-2";
        fpBtn.disabled = false;
        fpBtnSpinner.style.display = "none";
        fpBtnText.textContent = "Send Reset Link";
        setTimeout(() => fpIdentifier.focus(), 200);
    };

    const closeModal = () => {
        forgotModal.classList.remove("active");
        setTimeout(() => {
            forgotModal.classList.add("hidden");
            forgotModal.classList.remove("flex");
        }, 300);
    };

    forgotLink?.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
    closeForgotModal?.addEventListener("click", closeModal);
    forgotModal?.addEventListener("click", (e) => {
        if (e.target === forgotModal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !forgotModal.classList.contains("hidden")) closeModal();
    });

    forgotForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identifier = fpIdentifier.value.trim();

        if (!identifier) {
            fpStatus.textContent = "Please enter your email or enrollment number.";
            fpStatus.className = "text-xs text-red-600 mt-2";
            return;
        }

        fpBtn.disabled = true;
        fpBtnText.textContent = "Sending...";
        fpBtnSpinner.style.display = "inline-block";
        fpStatus.textContent = "Sending request...";
        fpStatus.className = "text-xs text-slate-500 mt-2";

        try {
            const response = await fetch("/api/auth/forgot-password/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier })
            });
            const data = await response.json();
            fpStatus.textContent = data.message;
            fpStatus.className = "text-xs text-green-600 mt-2";
        } catch (err) {
            fpStatus.textContent = "If an account exists, an email has been sent.";
            fpStatus.className = "text-xs text-green-600 mt-2";
        } finally {
            fpBtnSpinner.style.display = "none";
            fpBtnText.textContent = "Link Sent ✓";
        }
    });
});
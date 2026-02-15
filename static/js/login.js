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
    
    const branchSelect = document.getElementById("branch");
    const enrollmentInput = document.getElementById("enrollment");
    const suggestionsBox = document.getElementById("suggestions-box");
    const nameInput = document.getElementById("student-name");
    const emailInput = document.getElementById("college-email");
    
    const studentFlow = document.getElementById("student-flow");
    const adminFlow = document.getElementById("admin-flow");
    const otpFlow = document.getElementById("otp-flow");
    
    const studentPassContainer = document.getElementById("student-password-container");
    const studentPassInput = document.getElementById("student-password");
    const adminEmailInput = document.getElementById("admin-email");
    const adminPassInput = document.getElementById("admin-password");
    
    const maskedEmailSpan = document.getElementById("masked-email");
    const loginFooter = document.getElementById("login-footer");
    const resendBtn = document.getElementById("resend-btn");
    const otpTimer = document.getElementById("otp-timer");
    
    let currentRole = "student"; // 'student' or 'admin'
    let currentStep = "credentials"; // 'credentials', 'password', 'otp'
    let studentHasPassword = false;
    let debounceTimer;

    // 0. Role Switching
    document.querySelectorAll(".role-btn").forEach(roleBtn => {
        roleBtn.addEventListener("click", () => {
            currentRole = roleBtn.dataset.role;
            
            // Update UI Buttons
            document.querySelectorAll(".role-btn").forEach(b => {
                b.classList.remove("bg-white", "shadow-sm", "text-indigo-600");
                b.classList.add("text-slate-500");
            });
            roleBtn.classList.add("bg-white", "shadow-sm", "text-indigo-600");
            roleBtn.classList.remove("text-slate-500");

            // Toggle Forms
            if (currentRole === "admin") {
                studentFlow.classList.add("hidden");
                adminFlow.classList.remove("hidden");
                otpFlow.classList.add("hidden");
                loginFooter.classList.add("hidden");
                btn.disabled = false;
                btnText.textContent = "Login";
                document.getElementById("login-subtitle").textContent = "Admin Login";
                
                // Disable Student Inputs (Prevents validation error on hidden fields)
                branchSelect.disabled = true;
                enrollmentInput.disabled = true;
                
                // Enable Admin Inputs
                adminEmailInput.disabled = false;
                adminPassInput.disabled = false;
            } else {
                studentFlow.classList.remove("hidden");
                adminFlow.classList.add("hidden");
                otpFlow.classList.add("hidden");
                loginFooter.classList.remove("hidden");
                document.getElementById("login-subtitle").textContent = "Student Login";
                
                // Reset student state
                currentStep = "credentials";
                studentHasPassword = false;
                btnText.textContent = "Continue";
                
                // Reset UI elements
                studentPassContainer.classList.add("hidden");
                enrollmentInput.value = "";
                nameInput.value = "";
                emailInput.value = "";
                studentPassInput.value = "";
                
                // Re-evaluate button state based on inputs
                btn.disabled = true;
                
                // Enable Student Inputs
                branchSelect.disabled = false;
                enrollmentInput.disabled = !branchSelect.value; // Only enable if branch is selected
                
                // Disable Admin Inputs
                adminEmailInput.disabled = true;
                adminPassInput.disabled = true;
            }
        });
    });

    // 1. Enable Enrollment Input only after Branch Selection
    branchSelect.addEventListener("change", () => {
        if (branchSelect.value) {
            enrollmentInput.disabled = false;
            enrollmentInput.placeholder = "Start typing enrollment no...";
            enrollmentInput.focus();
            // Reset fields if branch changes
            enrollmentInput.value = "";
            nameInput.value = "";
            emailInput.value = "";
            studentPassContainer.classList.add("hidden");
            studentPassInput.value = "";
            btn.disabled = true;
        }
    });

    // 2. Handle Enrollment Input with Debounce
    enrollmentInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        const branch = branchSelect.value;

        // Reset auto-filled fields on change
        nameInput.value = "";
        emailInput.value = "";
        studentPassContainer.classList.add("hidden");
        studentPassInput.value = "";
        btn.disabled = true;

        clearTimeout(debounceTimer);
        suggestionsBox.classList.add("hidden");

        if (query.length < 3) return;

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch("/api/auth/enrollment-suggestions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ branch, query })
                });
                const data = await response.json();
                
                showSuggestions(data.suggestions);
            } catch (error) {
                console.error("Error fetching suggestions:", error);
            }
        }, 300); // 300ms debounce
    });

    // 3. Show Suggestions
    function showSuggestions(suggestions) {
        suggestionsBox.innerHTML = "";
        if (suggestions.length === 0) {
            suggestionsBox.classList.add("hidden");
            return;
        }

        suggestions.forEach(enrollment => {
            const div = document.createElement("div");
            div.className = "px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700 transition-colors";
            div.textContent = enrollment;
            div.onclick = () => selectEnrollment(enrollment);
            suggestionsBox.appendChild(div);
        });

        suggestionsBox.classList.remove("hidden");
    }

    // 4. Select Enrollment & Fetch Details
    function selectEnrollment(enrollment) {
        enrollmentInput.value = enrollment;
        suggestionsBox.classList.add("hidden");
        checkStudentDetails(enrollment);
    }

    // Helper: Check student details for password/OTP flow
    async function checkStudentDetails(enrollment) {
        try {
            const response = await fetch("/api/auth/student-details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enrollment_no: enrollment })
            });
            
            if (response.ok) {
                const data = await response.json();
                nameInput.value = data.full_name;
                emailInput.value = data.email;
                studentHasPassword = data.has_password;

                if (studentHasPassword) {
                    studentPassContainer.classList.remove("hidden");
                    btnText.textContent = "Login";
                    currentStep = "password";
                    setTimeout(() => studentPassInput.focus(), 100);
                } else {
                    studentPassContainer.classList.add("hidden");
                    btnText.textContent = "Send OTP";
                    currentStep = "credentials";
                }

                btn.disabled = false;
            } else {
                showToast("Error", "Student details not found.", true);
                btn.disabled = true;
            }
        } catch (error) {
            showToast("Error", "Failed to fetch student details.", true);
        }
    }

    // Handle manual entry (Blur/Enter)
    enrollmentInput.addEventListener("change", () => {
        const val = enrollmentInput.value.trim();
        if (val) checkStudentDetails(val);
    });

    // Hide suggestions when clicking outside
    document.addEventListener("click", (e) => {
        if (!enrollmentInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
            suggestionsBox.classList.add("hidden");
        }
    });

    // 5. OTP Timer Logic
    let otpInterval;

    function startOtpTimer(expiryIso, timerId = "otp-timer", resendId = "resend-btn") {
        // Clear any existing timer
        if (otpInterval) clearInterval(otpInterval);
        
        const timerEl = document.getElementById(timerId);
        const resendEl = document.getElementById(resendId);
        
        if (!timerEl) return;
        
        const expiryTime = new Date(expiryIso).getTime();
        timerEl.classList.remove("hidden");
        if (resendEl) {
            resendEl.disabled = true;
            resendEl.textContent = "Resend OTP";
        }

        function updateTimer() {
            const now = new Date().getTime();
            const distance = expiryTime - now;

            if (distance < 0) {
                clearInterval(otpInterval);
                timerEl.textContent = "OTP Expired";
                timerEl.classList.add("text-red-500");
                if (resendEl) resendEl.disabled = false;
                return;
            }

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            timerEl.classList.remove("text-red-500");
        }

        updateTimer(); // Run immediately
        otpInterval = setInterval(updateTimer, 1000);
    }

    // 6. Reusable Send OTP Function
    async function sendOtp() {
        const enrollment = enrollmentInput.value.trim();
        const branch = branchSelect.value;

        if (!enrollment || !branch) return;

        // UI Loading State
        btn.disabled = true;
        if (currentStep === "credentials") btnText.textContent = "Sending OTP...";
        resendBtn.disabled = true;

        try {
            const response = await fetch("/api/auth/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enrollment_no: enrollment, branch: branch })
            });

            const result = await response.json();

            if (response.ok) {
                currentStep = "otp";
                studentFlow.classList.add("hidden");
                otpFlow.classList.remove("hidden");
                maskedEmailSpan.textContent = result.email;
                btnText.textContent = "Verify & Login";
                showToast("OTP Sent", `Check your email`);
                startOtpTimer(result.expiry_time);
            } else {
                showToast("Error", result.error || "Failed to send OTP", true);
                resendBtn.disabled = false; // Re-enable if failed
            }
        } catch (error) {
            showToast("Error", "Network error. Please try again.", true);
            resendBtn.disabled = false;
        } finally {
            btn.disabled = false;
            if (currentStep === "otp") btnText.textContent = "Verify & Login";
        }
    }

    // Attach Resend Handler
    if (resendBtn) {
        resendBtn.addEventListener("click", (e) => {
            e.preventDefault();
            sendOtp();
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Common loading state
        btn.disabled = true;
        btnIcon.classList.add("hidden");

        try {
            // --- ADMIN LOGIN ---
            if (currentRole === "admin") {
                const email = adminEmailInput.value.trim();
                const password = adminPassInput.value;

                if (!email || !password) throw new Error("Missing credentials");

                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "admin", email, password })
                });
                const result = await response.json();
                
                if (response.ok) {
                    showToast("Success", "Login successful");
                    window.location.replace(result.redirect_url);
                } else {
                    showToast("Login Failed", result.error, true);
                }
            }
            // --- STUDENT PASSWORD LOGIN ---
            else if (currentRole === "student" && studentHasPassword) {
                const enrollment = enrollmentInput.value.trim();
                const password = studentPassInput.value;

                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "student", enrollment_no: enrollment, password })
                });
                const result = await response.json();

                if (response.ok) {
                    showToast("Success", "Login successful");
                    window.location.replace(result.redirect_url);
                } else {
                    showToast("Login Failed", result.error, true);
                }
            }
            // --- STUDENT OTP REQUEST ---
            else if (currentRole === "student" && currentStep === "credentials") {
                // STEP 1: Request OTP
                if (!enrollmentInput.value || !branchSelect.value || !nameInput.value) {
                    showToast("Incomplete", "Please select a valid student from the suggestions.", true);
                    throw new Error("Validation failed");
                }
                
                // Use the shared function
                await sendOtp();
            } 
            // --- STUDENT OTP VERIFY ---
            else if (currentRole === "student" && currentStep === "otp") {
                // STEP 2: Verify OTP
                const enrollment = enrollmentInput.value.trim();
                const otp = document.getElementById("otp").value.trim();

                if (!otp || otp.length !== 6) {
                    showToast("Invalid OTP", "Please enter a valid 6-digit OTP.", true);
                    throw new Error("Validation failed");
                }

                btnText.textContent = "Verifying...";

                const response = await fetch("/api/auth/verify-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enrollment_no: enrollment, otp: otp })
                });

                const result = await response.json();

                if (response.ok) {
                    showToast("Success", "Login successful! Redirecting...");
                    setTimeout(() => {
                        window.location.replace(result.redirect_url || "/home");
                    }, 800);
                } else {
                    showToast("Verification Failed", result.error || "Invalid OTP.", true);
                }
            }
        } catch (error) {
            if (error.message !== "Validation failed" && error.message !== "Missing credentials") {
                showToast("Error", "Something went wrong. Please try again.", true);
            }
        } finally {
            // Reset button state (unless redirecting)
            btn.disabled = false;
            btnIcon.classList.remove("hidden");
            
            if (currentRole === "admin") {
                btnText.textContent = "Login";
            } else if (currentStep === "password") {
                btnText.textContent = "Login";
            } else if (currentStep === "credentials") {
                btnText.textContent = "Send OTP";
            } else if (currentStep === "otp") {
                btnText.textContent = "Verify & Login";
            }
        }
    });

    // ==========================================
    // FORGOT PASSWORD LOGIC
    // ==========================================
    const forgotLink = document.getElementById("forgot-password-link");
    const forgotModal = document.getElementById("forgot-password-modal");
    const closeForgotModal = document.getElementById("close-forgot-modal");
    const forgotForm = document.getElementById("forgot-password-form");
    const fpBtn = document.getElementById("fp-btn");
    
    let fpStep = 1;

    if (forgotLink) {
        forgotLink.addEventListener("click", (e) => {
            e.preventDefault();
            forgotModal.classList.remove("hidden");
            forgotModal.classList.add("flex");
            resetForgotForm();
        });
    }

    if (closeForgotModal) {
        closeForgotModal.addEventListener("click", () => {
            forgotModal.classList.add("hidden");
            forgotModal.classList.remove("flex");
        });
    }

    function resetForgotForm() {
        fpStep = 1;
        document.getElementById("fp-step-1").classList.remove("hidden");
        document.getElementById("fp-step-2").classList.add("hidden");
        document.getElementById("fp-step-3").classList.add("hidden");
        document.getElementById("fp-identifier").value = "";
        document.getElementById("fp-otp").value = "";
        document.getElementById("fp-new-pass").value = "";
        document.getElementById("fp-confirm-pass").value = "";
        fpBtn.textContent = "Send OTP";
    }

    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identifier = document.getElementById("fp-identifier").value.trim();
        fpBtn.disabled = true;

        try {
            if (fpStep === 1) {
                if (!identifier) throw new Error("Please enter your Enrollment No. or Email");
                fpBtn.textContent = "Sending...";
                
                const res = await fetch("/api/auth/forgot-password/request-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier })
                });
                
                const data = await res.json();
                showToast("Info", "If account exists, OTP sent.");
                fpStep = 2;
                document.getElementById("fp-step-1").classList.add("hidden");
                document.getElementById("fp-step-2").classList.remove("hidden");
                fpBtn.textContent = "Verify OTP";
                
                if (data.expiry_time) {
                    startOtpTimer(data.expiry_time, "fp-otp-timer", null);
                }

            } else if (fpStep === 2) {
                const otp = document.getElementById("fp-otp").value.trim();
                if (otp.length !== 6) throw new Error("Invalid OTP");
                fpBtn.textContent = "Verifying...";

                const res = await fetch("/api/auth/forgot-password/verify-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier, otp })
                });
                
                if (!res.ok) throw new Error((await res.json()).error || "Invalid OTP");

                fpStep = 3;
                document.getElementById("fp-step-2").classList.add("hidden");
                document.getElementById("fp-step-3").classList.remove("hidden");
                fpBtn.textContent = "Reset Password";

            } else if (fpStep === 3) {
                const otp = document.getElementById("fp-otp").value.trim();
                const newPass = document.getElementById("fp-new-pass").value;
                const confirmPass = document.getElementById("fp-confirm-pass").value;

                if (newPass.length < 6) throw new Error("Password too short (min 6 chars)");
                if (newPass !== confirmPass) throw new Error("Passwords do not match");
                
                fpBtn.textContent = "Updating...";

                const res = await fetch("/api/auth/forgot-password/reset-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier, otp, new_password: newPass })
                });

                if (!res.ok) throw new Error((await res.json()).error || "Failed to reset");

                showToast("Success", "Password reset successfully!");
                forgotModal.classList.add("hidden");
                forgotModal.classList.remove("flex");
            }
        } catch (err) {
            showToast("Error", err.message, true);
        } finally {
            fpBtn.disabled = false;
            if (fpStep === 1) fpBtn.textContent = "Send OTP";
            else if (fpStep === 2) fpBtn.textContent = "Verify OTP";
            else if (fpStep === 3) fpBtn.textContent = "Reset Password";
        }
    });
});

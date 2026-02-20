document.addEventListener("DOMContentLoaded", () => {

    // Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Form handling
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
                majorSelect.disabled = true;
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
                majorSelect.disabled = false;
                enrollmentInput.disabled = !majorSelect.value; // Only enable if major is selected
                
                // Disable Admin Inputs
                adminEmailInput.disabled = true;
                adminPassInput.disabled = true;
            }
        });
    });

    // 1. Enable Enrollment Input only after Branch Selection
    majorSelect.addEventListener("change", () => {
        if (majorSelect.value) {
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
        const major = majorSelect.value;

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
                    body: JSON.stringify({ major, query })
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
            // Use a <button> with type="button" to prevent unintended form submissions.
            // This is the standard, robust way to create clickable actions inside a form.
            const button = document.createElement("button");
            button.type = "button";
            button.className = "w-full text-left px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700 transition-colors";
            button.textContent = enrollment;
            button.addEventListener('mousedown', (e) => {
                // Prevents the input from blurring when a suggestion is clicked.
                // This stops the 'change' event from firing with partial data, which was causing the 404.
                e.preventDefault();
            });
            button.addEventListener('click', () => {
                selectEnrollment(enrollment);
            });
            suggestionsBox.appendChild(button);
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
                // Improve error handling: Show the actual error from the backend.
                const errorData = await response.json().catch(() => ({ error: "An unknown error occurred." }));
                showToast("Error", errorData.error || "Student details not found.", "error");
                btn.disabled = true;
            }
        } catch (error) {
            showToast("Network Error", "Failed to fetch student details.", "error");
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
        const major = majorSelect.value;

        if (!enrollment || !major) return;

        // UI Loading State
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
                showToast("OTP Sent", `Check your email at ${result.email}`, 'info');
                startOtpTimer(result.expiry_time);
            } else {
                showToast("Error", result.error || "Failed to send OTP", "error");
                resendBtn.disabled = false; // Re-enable if failed
            }
        } catch (error) {
            showToast("Network Error", "Please try again.", "error");
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
                    showToast("Success", "Login successful, redirecting...", 'success');
                    window.location.replace(result.redirect_url);
                } else {
                    showToast("Login Failed", result.error, "error");
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
                    showToast("Success", "Login successful, redirecting...", 'success');
                    window.location.replace(result.redirect_url);
                } else {
                    showToast("Login Failed", result.error, "error");
                }
            }
            // --- STUDENT OTP REQUEST ---
            else if (currentRole === "student" && currentStep === "credentials") {
                // STEP 1: Request OTP
                if (!enrollmentInput.value || !majorSelect.value || !nameInput.value) {
                    showToast("Incomplete", "Please select a valid student from the suggestions.", "warning");
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
                    showToast("Invalid OTP", "Please enter a valid 6-digit OTP.", "warning");
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
                    showToast("Success", "Login successful! Redirecting...", 'success');
                    setTimeout(() => {
                        window.location.replace(result.redirect_url || "/home");
                    }, 800);
                } else {
                    showToast("Verification Failed", result.error || "Invalid OTP.", "error");
                }
            }
        } catch (error) {
            if (error.message !== "Validation failed" && error.message !== "Missing credentials") {
                showToast("System Error", "Something went wrong. Please try again.", "error");
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
    // FORGOT PASSWORD MODAL LOGIC
    // ==========================================
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
        fpIdentifier.value = "";
        fpStatus.textContent = "A link to reset your password will be sent to your email.";
        fpStatus.className = "text-xs text-gray-500 mt-2";
        fpBtn.disabled = false;
        fpBtnText.classList.remove("hidden");
        fpBtnSpinner.classList.add("hidden");
        fpBtnText.textContent = "Send Reset Link";
    };

    const closeModal = () => {
        forgotModal.classList.add("hidden");
        forgotModal.classList.remove("flex");
    };

    forgotLink?.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
    closeForgotModal?.addEventListener("click", closeModal);

    forgotForm?.addEventListener("submit", async(e) => {
        e.preventDefault();
        const identifier = fpIdentifier.value.trim();

        if (!identifier) {
            fpStatus.textContent = "Please enter your email or enrollment number.";
            fpStatus.className = "text-xs text-red-600 mt-2";
            return;
        }

        // Set loading state
        fpBtn.disabled = true;
        fpBtnText.classList.add("hidden");
        fpBtnSpinner.classList.remove("hidden");
        fpStatus.textContent = "Sending request...";
        fpStatus.className = "text-xs text-gray-500 mt-2";

        try {
            const response = await fetch("/api/auth/forgot-password/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier })
            });
            const data = await response.json();
            // Always show a generic success message for security (prevents user enumeration)
            fpStatus.textContent = data.message;
            fpStatus.className = "text-xs text-green-600 mt-2";
        } catch (err) {
            // On network error, still show a generic message
            fpStatus.textContent = "If an account exists, an email has been sent.";
            fpStatus.className = "text-xs text-green-600 mt-2";
        } finally {
            // Keep button disabled and message shown. User should check their email.
            fpBtnText.textContent = "Link Sent";
            fpBtnText.classList.remove("hidden");
            fpBtnSpinner.classList.add("hidden");
        }
    });
});

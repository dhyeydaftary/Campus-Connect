/**
 * Campus Connect - Profile Page JavaScript
 * Vanilla JS implementation for Flask integration
 */

// ============================================================
// PROFILE DATA - FETCHED FROM API
// ============================================================

let profileData = {};

// ============================================================
// STATE MANAGEMENT
// ============================================================

let state = {
  activeTab: 'posts',
  activeConnectionTab: 'my-connections',
  currentModal: null,
  connectionToRemove: null,
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function renderExperience() {
  const container = document.getElementById('experienceContainer');
  const experiences = profileData.experiences || [];

  if (experiences.length === 0) {
    container.innerHTML = `
      <div class="pf-empty">
        <div class="pf-empty-icon"><i class="fas fa-briefcase"></i></div>
        <span>No experience added yet.</span>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="pf-timeline">${experiences.map(exp => `
    <div class="pf-tl-item">
      <div class="pf-tl-dot"></div>
      <p class="pf-tl-role">${exp.title}</p>
      <p class="pf-tl-company">${exp.company}</p>
      <p class="pf-tl-meta">${exp.start_date} – ${exp.end_date || 'Present'}${exp.location ? ' · ' + exp.location : ''}</p>
      ${exp.description ? `<p class="pf-tl-desc">${exp.description}</p>` : ''}
    </div>
  `).join('')}</div>`;
}

function renderEducation() {
  const container = document.getElementById('educationContainer');
  const educations = profileData.educations || [];

  if (educations.length === 0) {
    container.innerHTML = `
      <div class="pf-empty">
        <div class="pf-empty-icon"><i class="fas fa-graduation-cap"></i></div>
        <span>No education added yet.</span>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="space-y-4">${educations.map(edu => `
    <div class="pf-edu-item">
      <div class="pf-edu-icon"><i class="fas fa-graduation-cap"></i></div>
      <div class="min-w-0">
        <p class="pf-edu-degree">${edu.degree}</p>
        <p class="pf-edu-field">${edu.field}</p>
        <p class="pf-edu-institution">${edu.institution}</p>
        <p class="pf-edu-year">${edu.year}</p>
      </div>
    </div>
  `).join('')}</div>`;
}

async function renderConnections() {
  const container = document.getElementById('connectionsContainer');
  if (!container) return;

  container.innerHTML = '<div class="py-8 flex justify-center"><div class="animate-spin rounded-full h-6 w-6 border-2 border-gray-200" style="border-top-color:#4f46e5;"></div></div>';

  try {
    let data = [];
    let emptyMessage = "No connections found.";

    if (state.activeConnectionTab === 'my-connections') {
      // Use data already fetched in profileData if available, or fetch fresh
      // For simplicity and consistency with other tabs, we'll use the list API or profileData
      // profileData.connections is populated by get_profile_data
      data = profileData.connections || [];
      const isOwnProfile = profileData.is_own_profile;

      // Update count
      const countEl = document.getElementById('count-my-connections');
      if (countEl) countEl.textContent = data.length || 0;

      if (data.length === 0) {
        container.innerHTML = `<div class="py-8 text-center text-sm text-gray-400">No connections yet.</div>`;
        return;
      }

      container.innerHTML = data.map(conn => `
        <div class="conn-card">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <a href="/profile/${conn.id}" class="flex-shrink-0">
              <img src="${conn.profile_picture}" class="conn-card-avatar" alt="${conn.full_name}">
            </a>
            <div class="min-w-0">
              <a href="/profile/${conn.id}" class="conn-card-name block truncate">${conn.full_name}</a>
              <p class="conn-card-meta truncate">${conn.email}</p>
              <p class="conn-card-meta">Since ${conn.connected_since || '—'}</p>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button onclick="startMessage(${conn.id}, this)" class="message-btn btn-cc-secondary" data-user-id="${conn.id}">
              <i class="fas fa-paper-plane" style="font-size:0.7rem;"></i>
            </button>
            ${isOwnProfile ? `
            <button onclick="removeConnection(${conn.id})"
              class="btn-cc-secondary" style="color:#ef4444; border-color:#fecaca;">
              <i class="fas fa-user-minus" style="font-size:0.7rem;"></i>
            </button>` : ''}
          </div>
        </div>
      `).join('');

    } else if (state.activeConnectionTab === 'received') {
      const res = await fetch('/api/connections/pending');
      const json = await res.json();
      data = json.requests || [];

      const countEl = document.getElementById('count-received');
      if (countEl) countEl.textContent = json.count !== undefined ? json.count : 0;

      if (data.length === 0) {
        container.innerHTML = `<div class="py-8 text-center text-sm text-gray-400">No pending received requests.</div>`;
        return;
      }

      container.innerHTML = data.map(req => `
        <div class="conn-card">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <a href="/profile/${req.sender.id}" class="flex-shrink-0">
              <img src="${req.sender.profile_picture}" class="conn-card-avatar" alt="${req.sender.name}">
            </a>
            <div class="min-w-0">
              <a href="/profile/${req.sender.id}" class="conn-card-name block truncate">${req.sender.name}</a>
              <p class="conn-card-meta truncate">${req.sender.email}</p>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button onclick="startMessage(${req.sender.id}, this)" class="message-btn btn-cc-secondary" data-user-id="${req.sender.id}">
              <i class="fas fa-paper-plane" style="font-size:0.7rem;"></i>
            </button>
            <button onclick="acceptConnectionRequest(${req.request_id})" class="btn-cc-primary">Accept</button>
            <button onclick="rejectConnectionRequest(${req.request_id})" class="btn-cc-secondary">Reject</button>
          </div>
        </div>
      `).join('');

    } else if (state.activeConnectionTab === 'sent') {
      const res = await fetch('/api/connections/sent');
      const json = await res.json();
      data = json.requests || [];

      const countEl = document.getElementById('count-sent');
      if (countEl) countEl.textContent = json.count !== undefined ? json.count : 0;

      if (data.length === 0) {
        container.innerHTML = `<div class="py-8 text-center text-sm text-gray-400">No pending sent requests.</div>`;
        return;
      }

      container.innerHTML = data.map(req => `
        <div class="conn-card">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <a href="/profile/${req.receiver.id}" class="flex-shrink-0">
              <img src="${req.receiver.profile_picture}" class="conn-card-avatar" alt="${req.receiver.name}">
            </a>
            <div class="min-w-0">
              <a href="/profile/${req.receiver.id}" class="conn-card-name block truncate">${req.receiver.name}</a>
              <p class="conn-card-meta truncate">${req.receiver.email}</p>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button onclick="startMessage(${req.receiver.id}, this)" class="message-btn btn-cc-secondary" data-user-id="${req.receiver.id}">
              <i class="fas fa-paper-plane" style="font-size:0.7rem;"></i>
            </button>
            <button class="btn-cc-secondary" style="opacity:0.55; cursor:not-allowed;">
              <i class="fas fa-check" style="font-size:0.7rem;"></i> Sent
            </button>
          </div>
        </div>
      `).join('');

    } else if (state.activeConnectionTab === 'suggestions') {
      const res = await fetch('/api/suggestions');
      const json = await res.json();
      data = json.suggestions || [];

      if (data.length === 0) {
        container.innerHTML = `<div class="py-8 text-center text-sm text-gray-400">No suggestions available right now.</div>`;
        return;
      }

      container.innerHTML = data.map(user => `
        <div class="conn-card">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <a href="/profile/${user.id}" class="flex-shrink-0">
              <img src="${user.profile_picture}" class="conn-card-avatar" alt="${user.name}">
            </a>
            <div class="min-w-0">
              <a href="/profile/${user.id}" class="conn-card-name block truncate">${user.name}</a>
              <p class="conn-card-meta truncate">${user.email}</p>
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button onclick="startMessage(${user.id}, this)" class="message-btn btn-cc-secondary" data-user-id="${user.id}">
              <i class="fas fa-paper-plane" style="font-size:0.7rem;"></i>
            </button>
            <button onclick="sendConnectionRequest(${user.id})" class="btn-cc-primary">
              <i class="fas fa-user-plus" style="font-size:0.7rem;"></i> Connect
            </button>
          </div>
        </div>
      `).join('');
    }

  } catch (error) {
    console.error('Error rendering connections:', error);
    container.innerHTML = '<div class="py-8 text-center text-sm text-red-400">Failed to load data.</div>';
  }
}

function switchConnectionTab(tabName) {
  state.activeConnectionTab = tabName;

  document.querySelectorAll('.conn-tab-btn').forEach(btn => {
    if (btn.dataset.connTab === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Add animation to container
  const container = document.getElementById('connectionsContainer');
  if (container) {
    container.classList.remove('animate-fade-in');
    void container.offsetWidth; // Trigger reflow
    container.classList.add('animate-fade-in');
  }

  renderConnections();
}

// ============================================================
// TAB SWITCHING LOGIC
// ============================================================

function switchTab(tabName) {
  state.activeTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('animate-fade-in');
  });

  const tab = document.getElementById(`${tabName}Tab`);
  if (tab) {
    tab.classList.remove('hidden');
    void tab.offsetWidth; // Trigger reflow
    tab.classList.add('animate-fade-in');
  }
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================

async function openEditModal(type) {
  state.currentModal = type;

  const modal = document.getElementById('editModal');
  const backdrop = document.getElementById('editModalBackdrop');
  const panel = document.getElementById('editModalPanel');
  const titleEl = document.getElementById('modalTitle');
  const iconEl = document.getElementById('modalTitleIcon');
  const content = document.getElementById('modalContent');

  // ── CONFIG PER TYPE ──────────────────────────────────────
  const config = {
    about: { label: 'Edit About', icon: 'fas fa-user' },
    password: { label: 'Change Password', icon: 'fas fa-lock' },
    skills: { label: 'Edit Skills', icon: 'fas fa-bolt' },
    experience: { label: 'Edit Experience', icon: 'fas fa-briefcase' },
    education: { label: 'Edit Education', icon: 'fas fa-graduation-cap' },
  };

  const cfg = config[type] || { label: 'Edit', icon: 'fas fa-pen' };
  titleEl.childNodes[1].textContent = ' ' + cfg.label;
  iconEl.innerHTML = `<i class="${cfg.icon}"></i>`;

  // ── CONTENT ───────────────────────────────────────────────
  switch (type) {

    case 'about': {
      const bio = profileData.user.bio || '';
      const max = 500;
      content.innerHTML = `
        <div class="pf-field">
          <label class="pf-label">Bio</label>
          <textarea id="editBio" class="pf-textarea" maxlength="${max}"
            placeholder="Write a short bio about yourself…"
            oninput="pfCharCount(this,'bioCount',${max})"
            rows="6">${bio}</textarea>
          <div class="pf-char-count" id="bioCount">${bio.length} / ${max}</div>
        </div>
      `;
      break;
    }

    case 'password': {
      const hasPassword = profileData.user.has_password;
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          ${hasPassword ? '' : `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;
               background:#eef2ff;border-radius:10px;border:1px solid #c7d2fe;">
            <i class="fas fa-info-circle" style="color:#6366f1;margin-top:2px;font-size:0.8rem;flex-shrink:0;"></i>
            <span style="font-size:0.82rem;color:#4338ca;line-height:1.5;">
              You're currently using OTP login. Set a password to enable password-based login too.
            </span>
          </div>
          `}
          ${hasPassword ? `
          <div class="pf-field">
            <label class="pf-label">Current Password</label>
            <input type="password" id="currentPassword" class="pf-input"
                   placeholder="Enter your current password" autocomplete="current-password">
          </div>` : ''}
          <div class="pf-field">
            <label class="pf-label">New Password</label>
            <input type="password" id="newPassword" class="pf-input"
                   placeholder="Min 6 characters"
                   autocomplete="new-password"
                   oninput="pfPasswordStrength(this.value)">
            <div class="pf-pw-strength"><div class="pf-pw-strength-bar" id="pwStrengthBar"></div></div>
            <span class="pf-input-hint" id="pwStrengthLabel">Enter a password</span>
          </div>
          <div class="pf-field">
            <label class="pf-label">Confirm New Password</label>
            <input type="password" id="confirmPassword" class="pf-input"
                   placeholder="Re-enter new password"
                   autocomplete="new-password"
                   oninput="pfConfirmMatch()">
            <span class="pf-input-hint" id="confirmHint"></span>
          </div>
        </div>
      `;
      break;
    }

    case 'skills': {
      const skills = profileData.skills || [];
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="pf-field">
            <label class="pf-label">Current Skills</label>
            <div id="editSkillsList" style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;
                 background:#f9fafb;border-radius:12px;min-height:52px;
                 border:1.5px solid #e9eaf0;">
              ${skills.length === 0
          ? '<span class="pf-skills-empty" style="width:100%">No skills yet — add some below</span>'
          : skills.map(s => `
                <span class="pf-skill-chip">
                  ${s.name}
                  <button type="button" class="pf-skill-remove" onclick="removeSkill('${s.id}')"
                          title="Remove ${s.name}" aria-label="Remove ${s.name}">
                    <i class="fas fa-times"></i>
                  </button>
                </span>`).join('')}
            </div>
          </div>
          <div class="pf-field">
            <label class="pf-label">Add New Skill</label>
            <div style="display:flex;gap:8px;align-items:stretch;">
              <input type="text" id="newSkillInput" class="pf-input" style="flex:1;"
                     placeholder="e.g. React, Machine Learning, Public Speaking"
                     onkeydown="if(event.key==='Enter'){event.preventDefault();addSkill();}">
              <button type="button" onclick="addSkill()"
                      class="btn-cc-primary" style="padding:10px 18px;white-space:nowrap;">
                <i class="fas fa-plus" style="font-size:0.65rem;"></i>
                Add
              </button>
            </div>
          </div>
        </div>
      `;
      requestAnimationFrame(() => document.getElementById('newSkillInput')?.focus());
      break;
    }

    case 'experience': {
      const experiences = profileData.experiences || [];
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${experiences.length === 0
          ? `<p style="font-size:0.82rem;color:#9ca3af;text-align:center;padding:8px 0;">No experience entries yet. Add one below.</p>`
          : experiences.map((exp, i) => `
            <div class="pf-entry-card">
              <div class="pf-entry-card-head">
                <span class="pf-entry-label">
                  <span class="pf-entry-num">${i + 1}</span>
                  ${exp.title || 'Experience ' + (i + 1)}
                </span>
                <button type="button" class="pf-remove-btn" onclick="removeExperience('${exp.id}')">
                  <i class="fas fa-trash-alt" style="font-size:0.6rem;"></i> Remove
                </button>
              </div>
              <div class="pf-entry-body">
                <div class="pf-field">
                  <label class="pf-label">Title / Role</label>
                  <input type="text" class="pf-input" value="${exp.title || ''}"
                         placeholder="e.g. Software Engineer Intern"
                         data-exp-id="${exp.id}" data-field="title">
                </div>
                <div class="pf-field">
                  <label class="pf-label">Company</label>
                  <input type="text" class="pf-input" value="${exp.company || ''}"
                         placeholder="e.g. Google"
                         data-exp-id="${exp.id}" data-field="company">
                </div>
                <div class="pf-field">
                  <label class="pf-label">Location <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#c4c9d4;">(optional)</span></label>
                  <input type="text" class="pf-input" value="${exp.location || ''}"
                         placeholder="e.g. Ahmedabad, India"
                         data-exp-id="${exp.id}" data-field="location">
                </div>
                <div class="pf-input-row">
                  <div class="pf-field">
                    <label class="pf-label">Start Date</label>
                    <input type="text" class="pf-input" value="${exp.start_date || ''}"
                           placeholder="e.g. Jun 2023"
                           data-exp-id="${exp.id}" data-field="start_date">
                  </div>
                  <div class="pf-field">
                    <label class="pf-label">End Date</label>
                    <input type="text" class="pf-input" value="${exp.end_date && exp.end_date !== 'Present' ? exp.end_date : ''}"
                           placeholder="Leave blank if current"
                           id="endDate_${exp.id}"
                           data-exp-id="${exp.id}" data-field="end_date"
                           ${exp.is_current ? 'disabled style="opacity:0.4;"' : ''}>
                  </div>
                </div>
                <label class="pf-checkbox-row">
                  <input type="checkbox" class="pf-checkbox"
                         id="isCurrent_${exp.id}"
                         ${exp.is_current ? 'checked' : ''}
                         data-exp-id="${exp.id}" data-field="is_current"
                         onchange="
                           const ed = document.getElementById('endDate_${exp.id}');
                           if(ed){ed.disabled=this.checked;ed.style.opacity=this.checked?'0.4':'1';}
                         ">
                  <span class="pf-checkbox-label">Currently working here</span>
                </label>
                <div class="pf-field">
                  <label class="pf-label">Description <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#c4c9d4;">(optional)</span></label>
                  <textarea class="pf-textarea" rows="2" style="min-height:70px;"
                            placeholder="Briefly describe your role and achievements…"
                            data-exp-id="${exp.id}" data-field="description">${exp.description || ''}</textarea>
                </div>
              </div>
            </div>
          `).join('')}
          <button type="button" class="pf-add-btn" onclick="addExperience()">
            <i class="fas fa-plus" style="font-size:0.7rem;"></i>
            Add Experience
          </button>
        </div>
      `;
      break;
    }

    case 'education': {
      const educations = profileData.educations || [];
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${educations.length === 0
          ? `<p style="font-size:0.82rem;color:#9ca3af;text-align:center;padding:8px 0;">No education entries yet. Add one below.</p>`
          : educations.map((edu, i) => `
            <div class="pf-entry-card">
              <div class="pf-entry-card-head">
                <span class="pf-entry-label">
                  <span class="pf-entry-num">${i + 1}</span>
                  ${edu.institution || 'Education ' + (i + 1)}
                </span>
                <button type="button" class="pf-remove-btn" onclick="removeEducation('${edu.id}')">
                  <i class="fas fa-trash-alt" style="font-size:0.6rem;"></i> Remove
                </button>
              </div>
              <div class="pf-entry-body">
                <div class="pf-field">
                  <label class="pf-label">Degree</label>
                  <input type="text" class="pf-input" value="${edu.degree || ''}"
                         placeholder="e.g. Bachelor of Technology"
                         data-edu-id="${edu.id}" data-field="degree">
                </div>
                <div class="pf-field">
                  <label class="pf-label">Field of Study</label>
                  <input type="text" class="pf-input" value="${edu.field || ''}"
                         placeholder="e.g. Computer Science"
                         data-edu-id="${edu.id}" data-field="field">
                </div>
                <div class="pf-field">
                  <label class="pf-label">Institution</label>
                  <input type="text" class="pf-input" value="${edu.institution || ''}"
                         placeholder="e.g. L.J. University"
                         data-edu-id="${edu.id}" data-field="institution">
                </div>
                <div class="pf-field">
                  <label class="pf-label">Graduation Year</label>
                  <input type="text" class="pf-input" value="${edu.year || ''}"
                         placeholder="e.g. 2026"
                         data-edu-id="${edu.id}" data-field="year">
                </div>
              </div>
            </div>
          `).join('')}
          <button type="button" class="pf-add-btn" onclick="addEducation()">
            <i class="fas fa-plus" style="font-size:0.7rem;"></i>
            Add Education
          </button>
        </div>
      `;
      break;
    }
  }

  // ── ANIMATE OPEN ──────────────────────────────────────────
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
      panel.classList.add('visible');
    });
  });
}
function closeEditModal() {
  // Remove any temporary (unsaved) items before closing
  if (state.currentModal === 'experience') {
    profileData.experiences = profileData.experiences.filter(exp => !exp.isNew);
    renderExperience();
  } else if (state.currentModal === 'education') {
    profileData.educations = profileData.educations.filter(edu => !edu.isNew);
    renderEducation();
  }

  const modal = document.getElementById('editModal');
  const backdrop = document.getElementById('editModalBackdrop');
  const panel = document.getElementById('editModalPanel');

  // Animate out
  if (backdrop) backdrop.classList.remove('visible');
  if (panel) {
    panel.classList.remove('visible');
    panel.classList.add('closing');
  }

  setTimeout(() => {
    modal.style.display = 'none';
    if (panel) panel.classList.remove('closing');
    document.body.style.overflow = '';
    state.currentModal = null;
  }, 220);
}

// ── Modal utility helpers ──
function pfCharCount(el, counterId, max) {
  const counter = document.getElementById(counterId);
  if (!counter) return;
  const len = el.value.length;
  counter.textContent = len + ' / ' + max;
  counter.className = 'pf-char-count' + (len > max * 0.9 ? (len >= max ? ' over' : ' warn') : '');
}

function pfPasswordStrength(val) {
  const bar = document.getElementById('pwStrengthBar');
  const label = document.getElementById('pwStrengthLabel');
  if (!bar || !label) return;
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { w: '0%', color: '#f3f4f6', text: 'Enter a password' },
    { w: '25%', color: '#ef4444', text: 'Too weak' },
    { w: '50%', color: '#f59e0b', text: 'Fair' },
    { w: '75%', color: '#3b82f6', text: 'Good' },
    { w: '90%', color: '#10b981', text: 'Strong' },
    { w: '100%', color: '#059669', text: 'Very strong ✓' },
  ];
  const lvl = levels[Math.min(score, levels.length - 1)];
  bar.style.width = lvl.w;
  bar.style.background = lvl.color;
  label.textContent = val.length ? lvl.text : 'Enter a password';
  label.style.color = val.length ? lvl.color : '#9ca3af';
}

function pfConfirmMatch() {
  const newPw = document.getElementById('newPassword');
  const confPw = document.getElementById('confirmPassword');
  const hint = document.getElementById('confirmHint');
  if (!newPw || !confPw || !hint) return;
  if (!confPw.value) { hint.textContent = ''; hint.style.color = ''; return; }
  const match = newPw.value === confPw.value;
  hint.textContent = match ? '✓ Passwords match' : '✗ Passwords do not match';
  hint.style.color = match ? '#10b981' : '#ef4444';
}
async function saveModal() {
  try {
    switch (state.currentModal) {
      case 'about':
        const bio = document.getElementById('editBio').value;
        const response = await fetch('/api/profile/bio', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bio })
        });
        if (response.ok) {
          profileData.user.bio = bio;
          document.getElementById('aboutText').textContent = bio || 'No bio available.';
        }
        break;

      case 'password':
        const currentPwdInput = document.getElementById('currentPassword');
        const currentPassword = currentPwdInput ? currentPwdInput.value : null;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
          showToast('Validation Error', 'Passwords do not match.', 'warning');
          return;
        }
        if (newPassword.length < 6) {
          showToast('Validation Error', 'Password must be at least 6 characters.', 'warning');
          return;
        }

        const pwdResponse = await fetch('/api/profile/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword
          })
        });

        if (!pwdResponse.ok) {
          const data = await pwdResponse.json();
          showToast('Error', data.error || 'Failed to update password', 'error');
          return;
        }

        profileData.user.has_password = true; // Update local state
        break;

      case 'skills':
        // Skills are handled individually via add/remove functions
        break;

      case 'experience':
        // Collect data from all experience inputs
        const expInputs = document.querySelectorAll('[data-exp-id]');
        const expUpdates = {};

        expInputs.forEach(input => {
          const expId = input.dataset.expId;
          const field = input.dataset.field;

          if (!expUpdates[expId]) {
            const exp = profileData.experiences.find(e => e.id == expId);
            expUpdates[expId] = {
              id: expId,
              title: exp?.title || '',
              company: exp?.company || '',
              location: exp?.location || '',
              start_date: exp?.start_date || '',
              end_date: exp?.end_date || '',
              description: exp?.description || '',
              is_current: exp?.is_current || false,
              isNew: exp?.isNew || false
            };
          }

          if (field === 'is_current') {
            expUpdates[expId][field] = input.checked;
          } else {
            expUpdates[expId][field] = input.value;
          }
        });

        // Save each experience (POST for new, PUT for existing)
        for (const expId in expUpdates) {
          const expData = expUpdates[expId];
          const isNew = expId.toString().startsWith('temp_');

          // Skip if required fields are empty
          if (!expData.title || !expData.company || !expData.start_date) {
            // Remove from profileData if it's a new item with no data
            if (isNew) {
              profileData.experiences = profileData.experiences.filter(e => e.id != expId);
            }
            continue;
          }

          try {
            if (isNew) {
              // Create new experience (POST)
              const { id, isNew: _, ...dataToSend } = expData; // Remove id and isNew flag
              const response = await fetch('/api/profile/experiences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
              });

              if (response.ok) {
                const newExp = await response.json();
                const index = profileData.experiences.findIndex(e => e.id == expId);
                if (index !== -1) {
                  profileData.experiences[index] = newExp; // Replace temp with real data
                }
              }
            } else {
              // Update existing experience (PUT)
              const response = await fetch('/api/profile/experiences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expData)
              });

              if (response.ok) {
                const updatedExp = await response.json();
                const index = profileData.experiences.findIndex(e => e.id == expId);
                if (index !== -1) {
                  profileData.experiences[index] = updatedExp;
                }
              }
            }
          } catch (error) {
            console.error('Error saving experience:', error);
          }
        }

        renderExperience();
        break;

      case 'education':
        // Collect data from all education inputs
        const eduInputs = document.querySelectorAll('[data-edu-id]');
        const eduUpdates = {};

        eduInputs.forEach(input => {
          const eduId = input.dataset.eduId;
          const field = input.dataset.field;

          if (!eduUpdates[eduId]) {
            const edu = profileData.educations.find(e => e.id == eduId);
            eduUpdates[eduId] = {
              id: eduId,
              degree: edu?.degree || '',
              field: edu?.field || '',
              institution: edu?.institution || '',
              year: edu?.year || '',
              isNew: edu?.isNew || false
            };
          }

          eduUpdates[eduId][field] = input.value;
        });

        // Save each education (POST for new, PUT for existing)
        for (const eduId in eduUpdates) {
          const eduData = eduUpdates[eduId];
          const isNew = eduId.toString().startsWith('temp_');

          // Skip if required fields are empty
          if (!eduData.degree || !eduData.field || !eduData.institution || !eduData.year) {
            // Remove from profileData if it's a new item with no data
            if (isNew) {
              profileData.educations = profileData.educations.filter(e => e.id != eduId);
            }
            continue;
          }

          try {
            if (isNew) {
              // Create new education (POST)
              const { id, isNew: _, ...dataToSend } = eduData; // Remove id and isNew flag
              const response = await fetch('/api/profile/educations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
              });

              if (response.ok) {
                const newEdu = await response.json();
                const index = profileData.educations.findIndex(e => e.id == eduId);
                if (index !== -1) {
                  profileData.educations[index] = newEdu; // Replace temp with real data
                }
              }
            } else {
              // Update existing education (PUT)
              const response = await fetch('/api/profile/educations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eduData)
              });

              if (response.ok) {
                const updatedEdu = await response.json();
                const index = profileData.educations.findIndex(e => e.id == eduId);
                if (index !== -1) {
                  profileData.educations[index] = updatedEdu;
                }
              }
            }
          } catch (error) {
            console.error('Error saving education:', error);
          }
        }

        renderEducation();
        break;
    }

    showToast('Success', 'Your changes have been saved.', 'success');
    closeEditModal(); // Close modal after showing toast
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Save Error', 'Could not save your changes. Please try again.', 'error');
  }
}

// ============================================
// SKILL MANAGEMENT
// ============================================

async function addSkill() {
  const input = document.getElementById('newSkillInput');
  const skillName = input.value.trim();

  if (skillName) {
    try {
      const response = await fetch('/api/profile/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skillName })
      });

      if (response.ok) {
        const newSkill = await response.json();
        if (!profileData.skills) profileData.skills = [];
        profileData.skills.push(newSkill);
        input.value = '';
        renderSkills();
        openEditModal('skills'); // Refresh modal with new skill
        showToast('Success', 'Skill has been added.', 'success');
      } else {
        const error = await response.json();
        showToast('Error', error.error || 'Failed to add the skill.', 'error');
      }
    } catch (error) {
      console.error('Error adding skill:', error);
      showToast('Network Error', 'Could not add the skill. Please check your connection.', 'error');
    }
  }
}

async function removeSkill(skillId) {
  try {
    const response = await fetch(`/api/profile/skills?id=${skillId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      profileData.skills = profileData.skills.filter(s => s.id != skillId);
      renderSkills();
      openEditModal('skills'); // Refresh modal without the removed skill
      showToast('Success', 'The skill has been removed.', 'success');
    } else {
      const error = await response.json();
      showToast('Error', error.error || 'Failed to remove the skill.', 'error');
    }
  } catch (error) {
    console.error('Error removing skill:', error);
    showToast('Network Error', 'Could not remove the skill. Please check your connection.', 'error');
  }
}

// ============================================
// EXPERIENCE MANAGEMENT
// ============================================

function addExperience() {
  // Create temporary experience with a temporary ID (negative to distinguish from real ones)
  const tempExp = {
    id: `temp_${Date.now()}`,
    title: '',
    company: '',
    location: '',
    start_date: '',
    end_date: '',
    description: '',
    is_current: false,
    isNew: true  // Flag to indicate this is a new, unsaved item
  };

  if (!profileData.experiences) profileData.experiences = [];
  profileData.experiences.unshift(tempExp); // Add to beginning
  openEditModal('experience'); // Refresh modal to show new empty fields
}

async function removeExperience(expId) {
  // Check if this is a temporary (unsaved) item
  const exp = profileData.experiences.find(e => e.id == expId);
  if (exp && exp.isNew) {
    // Just remove from local array, no API call needed
    profileData.experiences = profileData.experiences.filter(e => e.id != expId);
    openEditModal('experience'); // Refresh modal
    renderExperience();
    return;
  }

  // For existing items, delete from database
  try {
    const response = await fetch(`/api/profile/experiences?id=${expId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      profileData.experiences = profileData.experiences.filter(e => e.id != expId);
      openEditModal('experience'); // Refresh modal
      renderExperience();
      showToast('Success', 'The experience has been removed.', 'success');
    } else {
      const error = await response.json();
      showToast('Error', error.error || 'Failed to remove the experience.', 'error');
    }
  } catch (error) {
    console.error('Error removing experience:', error);
    showToast('Network Error', 'Could not remove the experience. Please check your connection.', 'error');
  }
}

// ============================================
// EDUCATION MANAGEMENT
// ============================================

function addEducation() {
  // Create temporary education with a temporary ID (negative to distinguish from real ones)
  const tempEdu = {
    id: `temp_${Date.now()}`,
    degree: '',
    field: '',
    institution: '',
    year: '',
    isNew: true  // Flag to indicate this is a new, unsaved item
  };

  if (!profileData.educations) profileData.educations = [];
  profileData.educations.push(tempEdu);
  openEditModal('education'); // Refresh modal to show new empty fields
}

async function removeEducation(eduId) {
  // Check if this is a temporary (unsaved) item
  const edu = profileData.educations.find(e => e.id == eduId);
  if (edu && edu.isNew) {
    // Just remove from local array, no API call needed
    profileData.educations = profileData.educations.filter(e => e.id != eduId);
    openEditModal('education'); // Refresh modal
    renderEducation();
    return;
  }

  // For existing items, delete from database
  try {
    const response = await fetch(`/api/profile/educations?id=${eduId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      profileData.educations = profileData.educations.filter(e => e.id != eduId);
      openEditModal('education'); // Refresh modal
      renderEducation();
      showToast('Success', 'The education entry has been removed.', 'success');
    } else {
      const error = await response.json();
      showToast('Error', error.error || 'Failed to remove the education entry.', 'error');
    }
  } catch (error) {
    console.error('Error removing education:', error);
    showToast('Network Error', 'Could not remove the education entry. Please check your connection.', 'error');
  }
}

// ============================================
// CONNECTION MANAGEMENT
// ============================================

async function sendConnectionRequest(receiverId) {
  try {
    const response = await fetch('/api/connections/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId })
    });

    if (response.ok) {
      const data = await response.json();
      showToast('Success', 'Connection request sent.', 'success');
      // Reload profile data to update connection status
      await refreshConnectionData();
    } else {
      if (response.status === 401 || response.status === 403) {
        showToast('Session Error', 'Your session has expired. Reloading...', 'error');
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      const errorData = await response.json();
      showToast('Error', errorData.error || 'Could not send request.', 'error');
    }
  } catch (error) {
    console.error('Error sending connection request:', error);
    showToast('Network Error', 'Could not send request. Please check your connection.', 'error');
  }
}

async function acceptConnectionRequest(requestId) {
  try {
    const response = await fetch(`/api/connections/accept/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      showToast('Success', 'Connection request accepted.', 'success');
      // Reload profile data to update connection status
      await refreshConnectionData();
    } else {
      if (response.status === 401 || response.status === 403) {
        showToast('Session Error', 'Your session has expired. Reloading...', 'error');
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      const errorData = await response.json();
      showToast('Error', errorData.error || 'Could not accept request.', 'error');
    }
  } catch (error) {
    console.error('Error accepting connection request:', error);
    showToast('Network Error', 'Could not accept request. Please check your connection.', 'error');
  }
}

async function rejectConnectionRequest(requestId) {
  try {
    const response = await fetch(`/api/connections/reject/${requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      showToast('Info', 'Connection request rejected.', 'info');
      await refreshConnectionData();
    } else {
      if (response.status === 401 || response.status === 403) {
        showToast('Session Error', 'Your session has expired. Reloading...', 'error');
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      const errorData = await response.json();
      showToast('Error', errorData.error || 'Could not reject request.', 'error');
    }
  } catch (error) {
    console.error('Error rejecting connection request:', error);
    showToast('Network Error', 'Could not reject request. Please check your connection.', 'error');
  }
}

function removeConnection(userId) {
  state.connectionToRemove = userId;
  const modal = document.getElementById('removeConnectionModal');
  if (modal) modal.classList.remove('hidden');
}

function closeRemoveConnectionModal() {
  const modal = document.getElementById('removeConnectionModal');
  if (modal) modal.classList.add('hidden');
  state.connectionToRemove = null;
}

async function confirmRemoveConnection() {
  if (!state.connectionToRemove) return;

  try {
    const response = await fetch(`/api/connections/${state.connectionToRemove}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showToast('Success', 'Connection removed.', 'success');
      await refreshConnectionData();
    } else {
      const data = await response.json();
      showToast('Error', data.error || 'Failed to remove the connection.', 'error');
    }
  } catch (error) {
    console.error('Error removing connection:', error);
    showToast('Network Error', 'Could not remove the connection. Please check your connection.', 'error');
  } finally {
    closeRemoveConnectionModal();
  }
}

async function refreshConnectionData() {
  // Reload main profile data to update counts and "My Connections" list
  await loadProfileData(window.location.pathname.match(/\/profile\/(\d+)/)[1]);
  // Re-render current connection tab
  await renderConnections();
}

// ============================================
// POST INTERACTIONS
// ============================================

async function toggleLike(postId) {
  try {
    const response = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json(); // eslint-disable-line no-unused-vars
      // Update the UI to reflect the new like status
      // This would need to be implemented based on how posts are rendered
      console.log('Like toggled:', data);
    }
  } catch (error) {
    console.error('Error toggling like:', error);
  }
}

// ============================================
// PROFILE DISPLAY UPDATE
// ============================================

// ============================================
// API DATA FETCHING
// ============================================

function renderSkills() {
  const container = document.getElementById('skillsContainer');
  const skills = profileData.skills || [];

  if (!container) return;

  if (skills.length === 0) {
    container.innerHTML = `
      <div class="pf-empty">
        <div class="pf-empty-icon"><i class="fas fa-bolt"></i></div>
        <span>No skills added yet.</span>
      </div>`;
    return;
  }

  container.innerHTML = skills.map(skill => `
    <span class="badge badge-skill">${skill.name}</span>
  `).join('');
}





async function loadProfileData(userId) {
  const nameEl = document.getElementById('profileName');
  if (nameEl) { nameEl.classList.remove('loaded'); nameEl.textContent = ''; }
  const badgesRow = document.getElementById('profileBadges');
  if (badgesRow) badgesRow.classList.remove('loaded');
  const locRow = document.getElementById('profileLocationRow');
  if (locRow) { locRow.style.display = 'none'; locRow.classList.remove('loaded'); }
  const statsRow = document.querySelector('.pf-stats-row');
  if (statsRow) statsRow.classList.remove('loaded');
  document.getElementById('aboutText').textContent = '';
  try {
    const response = await fetch(`/api/profile/${userId}`);
    if (!response.ok) throw new Error('Failed to load profile data');

    profileData = await response.json();

    // Update profile header
    updateProfileHeader(profileData.user);

    // Render profile sections
    renderSkills();
    renderExperience();
    renderEducation();
    renderConnections();

  } catch (error) {
    console.error('Error loading profile data:', error);
  }
}

function updateProfileHeader(user) {
  // ── NAME ────────────────────────────────────────────────
  const nameEl = document.getElementById('profileName');
  if (nameEl) {
    nameEl.textContent = user.full_name;
    // Clear skeleton, trigger entrance animation
    requestAnimationFrame(() => nameEl.classList.add('loaded'));
  }

  // ── BADGES ──────────────────────────────────────────────
  const badgesRow = document.getElementById('profileBadges');

  // Helper: create or reuse a badge element
  function _badge(id, cls, html, show = true) {
    let el = document.getElementById(id);
    if (!el && badgesRow) {
      el = document.createElement('span');
      el.id = id;
      badgesRow.appendChild(el);
    }
    if (!el) return;
    el.className = `badge ${cls}`;
    el.innerHTML = html;
    el.style.display = show ? '' : 'none';
  }

  // Major/Branch badge — user.major is the branch/department e.g. "IT", "CS", "Mech"
  // Show with a small icon so it reads as a field-of-study badge
  const majorValue = user.major || user.branch || '';
  _badge('profileMajor', 'badge-major',
    majorValue
      ? `<i class="fas fa-microchip" style="font-size:0.58rem;opacity:0.7;"></i> ${majorValue}`
      : '',
    !!majorValue
  );

  // Batch → compact year format: 2028 → '28
  const batchEl = document.getElementById('profileBatch');
  if (batchEl) {
    if (user.batch) {
      // Clean up string, remove any existing quotes or whitespace
      let batchStr = String(user.batch).replace(/['"\s]/g, '');
      // If it's a 4 digit year like "2028", grab last 2. Otherwise use as-is.
      const shortYear = batchStr.length >= 4 ? `'${batchStr.slice(-2)}` : `'${batchStr}`;

      batchEl.className = 'badge badge-batch';
      batchEl.innerHTML = `<i class="fas fa-graduation-cap" style="font-size:0.58rem;opacity:0.7;"></i> ${shortYear}`;
      batchEl.style.display = '';
    } else {
      batchEl.style.display = 'none';
    }
  }

  // If API has a separate branch field that differs from major, show it too
  if (user.branch && user.major && user.branch !== user.major) {
    _badge('profileBranch', 'badge-branch',
      `<i class="fas fa-code-branch" style="font-size:0.56rem;opacity:0.7;"></i> ${user.branch}`
    );
  } else {
    const existing = document.getElementById('profileBranch');
    if (existing) existing.style.display = 'none';
  }

  // Animate badge row in
  if (badgesRow) requestAnimationFrame(() => badgesRow.classList.add('loaded'));

  // ── LOCATION ────────────────────────────────────────────
  const locSpan = document.getElementById('profileLocation');
  const locRow = document.getElementById('profileLocationRow');
  if (locSpan && user.university) {
    locSpan.textContent = user.university;
    if (locRow) { locRow.style.display = 'flex'; requestAnimationFrame(() => locRow.classList.add('loaded')); }
  }

  // ── ABOUT ───────────────────────────────────────────────
  document.getElementById('aboutText').textContent = user.bio || 'No bio added yet.';

  // ── STATS ───────────────────────────────────────────────
  document.getElementById('connectionsCount').textContent = profileData.stats.connections_count;
  document.getElementById('postsCount').textContent = profileData.stats.posts_count;

  const statsRow = document.querySelector('.pf-stats-row');
  if (statsRow) requestAnimationFrame(() => statsRow.classList.add('loaded'));

  const myConnCount = document.getElementById('count-my-connections');
  if (myConnCount) myConnCount.textContent = profileData.stats.connections_count || 0;
  const receivedCount = document.getElementById('count-received');
  if (receivedCount && profileData.stats.received_count !== undefined) receivedCount.textContent = profileData.stats.received_count || 0;
  const sentCount = document.getElementById('count-sent');
  if (sentCount && profileData.stats.sent_count !== undefined) sentCount.textContent = profileData.stats.sent_count || 0;

  // ── AVATAR ──────────────────────────────────────────────
  const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const avatarContainer = document.getElementById('profileAvatar');
  if (user.profile_picture && !user.profile_picture.includes('ui-avatars.com')) {
    avatarContainer.innerHTML = `<img src="${user.profile_picture}" class="w-full h-full object-cover profile-avatar-img" alt="${user.full_name}">`;
  } else {
    avatarContainer.textContent = initials;
  }

  if (profileData.is_own_profile) avatarContainer.classList.add('own-profile');

  setupAvatarUpload(profileData.is_own_profile);
  renderProfileActions();
}

function renderProfileActions() {
  const actionsContainer = document.getElementById('profileActions');
  const isOwnProfile = profileData.is_own_profile;
  const connectionStatus = profileData.connection_status;

  const aboutEditButton = document.getElementById('aboutEditButton');
  const skillsEditButton = document.getElementById('skillsEditButton');
  const experienceEditButton = document.getElementById('experienceEditButton');
  const educationEditButton = document.getElementById('educationEditButton');

  if (isOwnProfile) {
    if (aboutEditButton) aboutEditButton.classList.remove('hidden');
    if (skillsEditButton) skillsEditButton.classList.remove('hidden');
    if (experienceEditButton) experienceEditButton.classList.remove('hidden');
    if (educationEditButton) educationEditButton.classList.remove('hidden');

    actionsContainer.innerHTML = `
      <button onclick="openEditModal('password')" class="btn-cc-secondary">
        <i class="fas fa-key" style="font-size:0.7rem;"></i>
        Password
      </button>
    `;
  } else {
    if (aboutEditButton) aboutEditButton.classList.add('hidden');
    if (skillsEditButton) skillsEditButton.classList.add('hidden');
    if (experienceEditButton) experienceEditButton.classList.add('hidden');
    if (educationEditButton) educationEditButton.classList.add('hidden');

    let connectText = 'Connect';
    let connectClass = 'btn-cc-primary';
    let connectDisabled = '';
    let connectClick = `sendConnectionRequest(${profileData.user.id})`;

    if (connectionStatus === 'pending_sent') {
      connectText = 'Request Sent';
      connectClass = 'btn-cc-secondary';
      connectDisabled = 'disabled style="opacity:0.55;cursor:not-allowed;"';
      connectClick = '';
    } else if (connectionStatus === 'pending_received') {
      connectText = 'Accept Request';
      connectClass = 'btn-cc-primary';
      connectClick = `acceptConnectionRequest(${profileData.pending_request_id})`;
    } else if (connectionStatus === 'connected') {
      connectText = 'Connected';
      connectClass = 'btn-cc-secondary';
      connectDisabled = 'disabled style="opacity:0.55;cursor:not-allowed;"';
      connectClick = '';
    }

    actionsContainer.innerHTML = `
      <button onclick="${connectClick}" class="${connectClass}" ${connectDisabled}>
        <i class="fas fa-user-plus" style="font-size:0.7rem;"></i>
        ${connectText}
      </button>
      <button onclick="startMessage(${profileData.user.id}, this)"
        class="message-btn btn-cc-secondary" data-user-id="${profileData.user.id}">
        <i class="fas fa-comment-alt" style="font-size:0.7rem;"></i>
        Message
      </button>
    `;
  }
}

function setupAvatarUpload(isOwnProfile) {
  const container = document.getElementById('profileAvatar');

  // 1. Re-create Overlay if missing (because innerHTML was overwritten)
  let overlay = document.getElementById('avatarOverlay');
  if (isOwnProfile && !overlay) {
    overlay = document.createElement('div');
    overlay.id = 'avatarOverlay';
    overlay.className = 'pf-avatar-overlay';
    overlay.innerHTML = '<i class="fas fa-camera text-white text-xl"></i>';
    overlay.onclick = () => {
      const fileInput = document.getElementById('profile-photo-input');
      if (fileInput) fileInput.click();
    };
    container.appendChild(overlay);
  }

  // 2. Re-create Input if missing
  let input = document.getElementById('profile-photo-input');
  if (isOwnProfile && !input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'profile-photo-input';
    input.hidden = true;
    input.accept = 'image/*';
    container.appendChild(input);
  }

  // 3. Attach Listener
  if (input && isOwnProfile) {
    // Remove old listener to prevent duplicates
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        container.classList.add('opacity-50'); // Loading state
        const url = await ProfileUpload.upload(file);

        // Update local data and UI
        profileData.user.profile_picture = url;
        updateProfileHeader(profileData.user);
        window.ProfileUpload.updateGlobalAvatars(url);
        showToast('Success', 'Profile photo updated', 'success');
      } catch (err) {
        showToast('Upload Failed', err.message || 'Could not upload photo.', 'error');
      } finally {
        container.classList.remove('opacity-50');
      }
    });
  }
}

async function startMessage(userId, btnElement) {
  // UI Loading state
  const originalContent = btnElement.innerHTML;
  btnElement.disabled = true;
  btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const response = await fetch('/api/chats/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: userId })
    });

    if (response.status === 403) {
      alert("You must be connected to message this user");
      return;
    }

    if (!response.ok) throw new Error('Failed to start chat');

    const data = await response.json();
    window.location.href = `/messages?conversation=${data.conversation_id}`;

  } catch (error) {
    console.error(error);
    alert('Error starting chat');
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = originalContent;
    }
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Get user ID from URL
  const urlPath = window.location.pathname;
  const userIdMatch = urlPath.match(/\/profile\/(\d+)/);
  const userId = userIdMatch ? userIdMatch[1] : null;

  if (userId) {
    // Load profile data (which will render skills, experience, education)
    loadProfileData(userId);

    // 1. Force 'posts' tab to be visible immediately
    switchTab('posts');

    // Initialize connection tab styling
    switchConnectionTab('my-connections');

    // 2. Initialize Feed Loader with safety checks
    const feedContainer = document.getElementById('post-feed');

    if (feedContainer && typeof FeedLoader !== 'undefined') {
      // Create instance targeting the profile posts API
      window.feedLoader = new FeedLoader(`/api/profile/${userId}/posts`, 'post-feed');

      // Clear container to prevent duplication or stale data
      feedContainer.innerHTML = '';

      // Reset loader state
      window.feedLoader.posts = [];
      window.feedLoader.currentPage = 1;
      window.feedLoader.hasMore = true;

      // Load initial posts
      window.feedLoader.loadPosts();

      // Enable infinite scroll
      window.feedLoader.enableInfiniteScroll();
    } else {
      if (!feedContainer) console.error("Profile Error: Element #post-feed not found in DOM.");
      if (typeof FeedLoader === 'undefined') console.error("Profile Error: FeedLoader class not loaded. Check script order.");
    }
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.currentModal) {
    closeEditModal();
  }
});


// ═══════════════════════════════════════════════════════════════
// COMMENT MODAL
// ═══════════════════════════════════════════════════════════════

function closeComments(event) {
  const modal = document.getElementById("comment-modal");

  if (event && event.target === modal) {
    modal.style.display = "none";
  } else if (!event) {
    modal.style.display = "none";
  }
}

async function submitComment() {
  const input = document.getElementById('comment-input');
  const postId = input.dataset.postId;
  const text = input.value.trim();

  if (!text || !postId) return;

  try {
    const response = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) throw new Error('Failed to post comment');

    input.value = ''; // eslint-disable-line no-unused-vars

    const postIndex = window.feedLoader.posts.findIndex(p => p.id == postId);
    if (postIndex >= 0) {
      // Update count locally
      const post = window.feedLoader.posts[postIndex];
      if (post.commentsCount !== undefined) post.commentsCount++;
      else if (post.comments_count !== undefined) post.comments_count++;

      window.feedLoader.renderPosts();
      window.feedLoader.openComments(postIndex);
    }

  } catch (error) {
    console.error('Error posting comment:', error);
    showToast('Error', 'Failed to post comment.', 'error');
  }
}
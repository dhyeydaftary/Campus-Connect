/**
 * Campus Connect - Profile Page JavaScript
 * Vanilla JS implementation for Flask integration
 */

tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(238, 73%, 67%)',
          foreground: 'hsl(0, 0%, 100%)',
          light: 'hsl(238, 73%, 95%)',
        },
        background: 'hsl(240, 20%, 98%)',
        foreground: 'hsl(240, 10%, 10%)',
        card: 'hsl(0, 0%, 100%)',
        muted: {
          DEFAULT: 'hsl(240, 10%, 96%)',
          foreground: 'hsl(240, 5%, 46%)',
        },
        border: 'hsl(240, 10%, 90%)',
        accent: {
          DEFAULT: 'hsl(238, 73%, 67%)',
          foreground: 'hsl(0, 0%, 100%)',
        },
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 12px -4px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 24px -8px rgba(0, 0, 0, 0.12), 0 12px 32px -12px rgba(0, 0, 0, 0.08)',
      },
    }
  }
}


// ============================================
// PROFILE DATA - Fetched from API
// ============================================

let profileData = {};
let feedLoader; // Feed loader instance for profile posts
let profileUserId;

// ============================================
// MOCK DATA - For edit functionality
// ============================================

const mockData = {
  currentUser: {
    id: '1',
    name: 'Dhyey Daftary',
    initials: 'DD',
    major: 'IT',
    batch: '2028',
    institution: 'Harvard',
    location: 'Cambridge, MA',
    bio: 'Passionate software developer with a keen interest in building scalable web applications. Currently exploring AI/ML and cloud technologies. Always eager to learn and collaborate on innovative projects.',
    connectionsCount: 3,
    postsCount: 2,
  },
  skills: [
    { id: '1', name: 'React' },
    { id: '2', name: 'TypeScript' },
    { id: '3', name: 'Python' },
    { id: '4', name: 'Machine Learning' },
    { id: '5', name: 'Node.js' },
  ],
  experiences: [
    {
      id: '1',
      role: 'Software Engineer Intern',
      organization: 'Google',
      startDate: 'Jun 2025',
      endDate: 'Aug 2025',
      description: 'Worked on improving search algorithms and building internal tools.',
    },
    {
      id: '2',
      role: 'Research Assistant',
      organization: 'Harvard AI Lab',
      startDate: 'Jan 2025',
      endDate: null,
      description: 'Conducting research on natural language processing and transformer models.',
    },
  ],
  education: [
    {
      id: '1',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      institution: 'Harvard University',
      year: '2024 - 2028',
    },
  ],
};

// ============================================
// STATE MANAGEMENT
// ============================================

let state = {
  activeTab: 'posts',
  currentModal: null,
  editData: {},
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg shadow-card-hover`;

  const icon = type === 'success'
    ? '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
    : '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';

  toast.innerHTML = `${icon}<span class="text-sm text-foreground">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderSkills() {
  const container = document.getElementById('skillsContainer');
  const skills = profileData.skills || [];
  
  if (skills.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted-foreground">No skills added yet.</p>';
    return;
  }
  
  container.innerHTML = skills.map(skill => `
    <span class="skill-badge px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full cursor-default">
      ${skill.name}
    </span>
  `).join('');
}

function renderExperience() {
  const container = document.getElementById('experienceContainer');
  const experiences = profileData.experiences || [];
  
  if (experiences.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted-foreground">No experience added yet.</p>';
    return;
  }
  
  container.innerHTML = experiences.map(exp => `
    <div class="relative pl-4 border-l-2 border-primary/30">
      <div class="absolute -left-1.5 top-1 w-3 h-3 bg-primary rounded-full"></div>
      <h4 class="font-medium text-foreground">${exp.title}</h4>
      <p class="text-sm text-primary">${exp.company}</p>
      <p class="text-xs text-muted-foreground mt-1">${exp.start_date} - ${exp.end_date || 'Present'}</p>
      ${exp.description ? `<p class="text-sm text-muted-foreground mt-2">${exp.description}</p>` : ''}
    </div>
  `).join('');
}

function renderEducation() {
  const container = document.getElementById('educationContainer');
  const educations = profileData.educations || [];
  
  if (educations.length === 0) {
    container.innerHTML = '<p class="text-sm text-muted-foreground">No education added yet.</p>';
    return;
  }
  
  container.innerHTML = educations.map(edu => `
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 14l9-5-9-5-9 5 9 5z"/>
          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"/>
        </svg>
      </div>
      <div>
        <h4 class="font-medium text-foreground">${edu.degree}</h4>
        <p class="text-sm text-primary">${edu.field}</p>
        <p class="text-sm text-muted-foreground">${edu.institution}</p>
        <p class="text-xs text-muted-foreground mt-1">${edu.year}</p>
      </div>
    </div>
  `).join('');
}

function renderConnections() {
  const container = document.getElementById('connectionsContainer');
  if (!profileData.connections) return;
  container.innerHTML = profileData.connections.map(conn => `
    <div class="connection-card bg-card rounded-xl shadow-card border border-border p-4">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
          ${conn.full_name.split(' ').map(n => n[0]).join('')}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-foreground truncate">${conn.full_name}</h4>
          <p class="text-sm text-muted-foreground truncate">${conn.major} • ${conn.university}</p>
        </div>
      </div>
      <div class="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>Connected ${conn.connected_since}</span>
      </div>
      <button class="w-full px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        Message
      </button>
    </div>
  `).join('');
}

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(tabName) {
  state.activeTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  document.getElementById(`${tabName}Tab`).classList.remove('hidden');
}

// ============================================
// MODAL FUNCTIONS
// ============================================

async function openEditModal(type) {
  state.currentModal = type;
  const modal = document.getElementById('editModal');
  const title = document.getElementById('modalTitle');
  const content = document.getElementById('modalContent');

  switch (type) {
    case 'profile':
      title.textContent = 'Edit Profile';
      content.innerHTML = `
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">First Name</label>
            <input type="text" id="editFirstName" value="${profileData.user.first_name || ''}" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background">
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Last Name</label>
            <input type="text" id="editLastName" value="${profileData.user.last_name || ''}" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background">
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Major</label>
            <input type="text" id="editMajor" value="${profileData.user.major || ''}" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background">
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Batch</label>
            <input type="text" id="editBatch" value="${profileData.user.batch || ''}" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background">
          </div>
        </div>
      `;
      break;

    case 'about':
      title.textContent = 'Edit About';
      content.innerHTML = `
        <div>
          <label class="block text-sm font-medium text-foreground mb-1">Bio</label>
          <textarea id="editBio" rows="6" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background resize-none">${profileData.user.bio || ''}</textarea>
        </div>
      `;
      break;

    case 'skills':
      title.textContent = 'Edit Skills';
      const skills = profileData.skills || [];
      content.innerHTML = `
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">Current Skills</label>
            <div class="flex flex-wrap gap-2" id="editSkillsList">
              ${skills.map(skill => `
                <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full">
                  ${skill.name}
                  <button onclick="removeSkill('${skill.id}')" class="ml-1 hover:text-red-500">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              `).join('')}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">Add New Skill</label>
            <div class="flex gap-2">
              <input type="text" id="newSkillInput" placeholder="Enter skill name" class="flex-1 px-3 py-2 border border-border rounded-lg text-foreground bg-background">
              <button onclick="addSkill()" class="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
                Add
              </button>
            </div>
          </div>
        </div>
      `;
      break;

    case 'experience':
      title.textContent = 'Edit Experience';
      const experiences = profileData.experiences || [];
      content.innerHTML = `
        <div class="space-y-4">
          ${experiences.map((exp, index) => `
            <div class="p-4 border border-border rounded-lg space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-muted-foreground">Experience ${index + 1}</span>
                <button onclick="removeExperience('${exp.id}')" class="text-red-500 hover:text-red-600 text-sm">Remove</button>
              </div>
              <input type="text" value="${exp.title}" placeholder="Title/Role" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-exp-id="${exp.id}" data-field="title">
              <input type="text" value="${exp.company}" placeholder="Company" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-exp-id="${exp.id}" data-field="company">
              <input type="text" value="${exp.location || ''}" placeholder="Location (optional)" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-exp-id="${exp.id}" data-field="location">
              <div class="grid grid-cols-2 gap-2">
                <input type="text" value="${exp.start_date}" placeholder="Start Date" class="px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-exp-id="${exp.id}" data-field="start_date">
                <input type="text" value="${exp.end_date && exp.end_date !== 'Present' ? exp.end_date : ''}" placeholder="End Date (or leave blank)" class="px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-exp-id="${exp.id}" data-field="end_date">
              </div>
              <div class="flex items-center gap-2">
                <input type="checkbox" id="isCurrent_${exp.id}" ${exp.is_current ? 'checked' : ''} class="rounded" data-exp-id="${exp.id}" data-field="is_current">
                <label for="isCurrent_${exp.id}" class="text-sm text-muted-foreground">Currently working here</label>
              </div>
              <textarea placeholder="Description" rows="2" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background resize-none" data-exp-id="${exp.id}" data-field="description">${exp.description || ''}</textarea>
            </div>
          `).join('')}
          <button onclick="addExperience()" class="w-full px-4 py-2 border border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Experience
          </button>
        </div>
      `;
      break;

    case 'education':
      title.textContent = 'Edit Education';
      const educations = profileData.educations || [];
      content.innerHTML = `
        <div class="space-y-4">
          ${educations.map((edu, index) => `
            <div class="p-4 border border-border rounded-lg space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-muted-foreground">Education ${index + 1}</span>
                <button onclick="removeEducation('${edu.id}')" class="text-red-500 hover:text-red-600 text-sm">Remove</button>
              </div>
              <input type="text" value="${edu.degree}" placeholder="Degree" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-edu-id="${edu.id}" data-field="degree">
              <input type="text" value="${edu.field}" placeholder="Field of Study" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-edu-id="${edu.id}" data-field="field">
              <input type="text" value="${edu.institution}" placeholder="Institution" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-edu-id="${edu.id}" data-field="institution">
              <input type="text" value="${edu.year}" placeholder="Year" class="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-background" data-edu-id="${edu.id}" data-field="year">
            </div>
          `).join('')}
          <button onclick="addEducation()" class="w-full px-4 py-2 border border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
            Add Education
          </button>
        </div>
      `;
      break;
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
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
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  state.currentModal = null;
}
async function saveModal() {
  try {
    switch (state.currentModal) {
      case 'profile':
        const firstName = document.getElementById('editFirstName').value;
        const lastName = document.getElementById('editLastName').value;
        const major = document.getElementById('editMajor').value;
        const batch = document.getElementById('editBatch').value;

        // Note: Profile editing would require additional API endpoints for user data
        // For now, just update the display
        profileData.user.first_name = firstName;
        profileData.user.last_name = lastName;
        profileData.user.major = major;
        profileData.user.batch = batch;
        updateProfileHeader(profileData.user);
        break;

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
          document.getElementById('aboutTabText').textContent = bio || 'No bio available.';
        }
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

    closeEditModal();
    showToast('Changes saved successfully!');
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error saving changes', 'error');
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
        openEditModal('skills'); // Refresh modal
        showToast('Skill added successfully!');
      } else {
        const error = await response.json();
        showToast(error.error || 'Failed to add skill', 'error');
      }
    } catch (error) {
      console.error('Error adding skill:', error);
      showToast('Error adding skill', 'error');
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
      openEditModal('skills'); // Refresh modal
      showToast('Skill removed successfully!');
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to remove skill', 'error');
    }
  } catch (error) {
    console.error('Error removing skill:', error);
    showToast('Error removing skill', 'error');
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
      showToast('Experience removed successfully!');
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to remove experience', 'error');
    }
  } catch (error) {
    console.error('Error removing experience:', error);
    showToast('Error removing experience', 'error');
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
      showToast('Education removed successfully!');
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to remove education', 'error');
    }
  } catch (error) {
    console.error('Error removing education:', error);
    showToast('Error removing education', 'error');
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
      showToast('Connection request sent!', 'success');
      // Reload profile data to update connection status
      await loadProfileData(window.location.pathname.match(/\/profile\/(\d+)/)[1]);
    } else {
      const errorData = await response.json();
      showToast(errorData.error || 'Error sending request', 'error');
    }
  } catch (error) {
    console.error('Error sending connection request:', error);
    showToast('Error sending connection request', 'error');
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
      showToast('Connection request accepted!', 'success');
      // Reload profile data to update connection status
      await loadProfileData(window.location.pathname.match(/\/profile\/(\d+)/)[1]);
    } else {
      const errorData = await response.json();
      showToast(errorData.error || 'Error accepting request', 'error');
    }
  } catch (error) {
    console.error('Error accepting connection request:', error);
    showToast('Error accepting connection request', 'error');
  }
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
      const data = await response.json();
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

function updateProfileDisplay() {
  if (profileData.user) {
    document.getElementById('profileName').textContent = profileData.user.full_name;
    document.getElementById('profileMajor').textContent = profileData.user.major;
    document.getElementById('profileBatch').textContent = `Batch of ${profileData.user.batch}`;
    document.getElementById('profileLocation').textContent = profileData.user.university;
    const initials = profileData.user.full_name.split(' ').map(n => n[0]).join('');
    document.getElementById('profileAvatar').textContent = initials;
    document.getElementById('userAvatar').textContent = initials;
  }
}

// ============================================
// API DATA FETCHING
// ============================================

async function loadProfileData(userId) {
  document.getElementById('profileName').textContent = 'Loading...';
  document.getElementById('profileMajor').textContent = '';
  document.getElementById('profileBatch').textContent = '';
  document.getElementById('profileLocation').textContent = '';
  document.getElementById('aboutText').textContent = 'Loading profile...';
  document.getElementById('aboutTabText').textContent = 'Loading profile...';
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
  document.getElementById('profileName').textContent = user.full_name;
  document.getElementById('profileMajor').textContent = user.major;
  document.getElementById('profileBatch').textContent = `Batch of ${user.batch}`;
  document.getElementById('profileLocation').textContent = user.university;
  document.getElementById('aboutText').textContent = user.bio || 'No bio available.';
  document.getElementById('aboutTabText').textContent = user.bio || 'No bio available.';
  document.getElementById('connectionsCount').textContent = profileData.stats.connections_count;
  document.getElementById('postsCount').textContent = profileData.stats.posts_count;

  // Render profile actions based on ownership
  renderProfileActions();
}

function renderProfileActions() {
  const actionsContainer = document.getElementById('profileActions');
  const isOwnProfile = profileData.is_own_profile;
  const connectionStatus = profileData.connection_status;

  // Show/hide edit buttons for profile sections based on ownership
  const aboutEditButton = document.getElementById('aboutEditButton');
  const skillsEditButton = document.getElementById('skillsEditButton');
  const experienceEditButton = document.getElementById('experienceEditButton');
  const educationEditButton = document.getElementById('educationEditButton');

  if (isOwnProfile) {
    // Show edit buttons for own profile
    if (aboutEditButton) aboutEditButton.classList.remove('hidden');
    if (skillsEditButton) skillsEditButton.classList.remove('hidden');
    if (experienceEditButton) experienceEditButton.classList.remove('hidden');
    if (educationEditButton) educationEditButton.classList.remove('hidden');

    // Show edit profile button for own profile
    actionsContainer.innerHTML = `
      <button onclick="openEditModal('profile')"
        class="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit Profile
      </button>
    `;
  } else {
    // Hide edit buttons for other profiles
    if (aboutEditButton) aboutEditButton.classList.add('hidden');
    if (skillsEditButton) skillsEditButton.classList.add('hidden');
    if (experienceEditButton) experienceEditButton.classList.add('hidden');
    if (educationEditButton) educationEditButton.classList.add('hidden');

    // Show connection/message buttons for other profiles
    let connectButtonText = 'Connect';
    let connectButtonClass = 'px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2';

    if (connectionStatus === 'pending_sent') {
      connectButtonText = 'Request Sent';
      connectButtonClass += ' opacity-50 cursor-not-allowed';
    } else if (connectionStatus === 'pending_received') {
      connectButtonText = 'Accept Request';
      connectButtonClass = 'px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2';
    } else if (connectionStatus === 'connected') {
      connectButtonText = 'Connected';
      connectButtonClass += ' opacity-50 cursor-not-allowed';
    }

    actionsContainer.innerHTML = `
      <button onclick="${connectionStatus === 'pending_received' ? `acceptConnectionRequest(${profileData.pending_request_id})` : connectionStatus === 'not_connected' ? `sendConnectionRequest(${profileData.user.id})` : ''}"
        class="${connectButtonClass}" ${connectionStatus === 'pending_sent' || connectionStatus === 'connected' ? 'disabled' : ''}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        ${connectButtonText}
      </button>
      <button
        class="px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Message
      </button>
    `;
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

    // Initialize feed loader for profile page (uses same container 'post-feed' as home)
    feedLoader = new FeedLoader(`/api/profile/${userId}/posts`, 'post-feed');
    window.feedLoader = feedLoader; // Make it globally accessible

    // Load initial posts
    feedLoader.loadPosts();

    // Enable infinite scroll
    feedLoader.enableInfiniteScroll();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.currentModal) {
    closeEditModal();
  }
});


// ═══════════════════════════════════════════════════════════════
// CONNECTION STATUS (For viewing other profiles)
// ═══════════════════════════════════════════════════════════════

async function loadConnectionStatus() {
    const container = document.getElementById('profileActions');
    if (!container) return;
    
    try {
        const response = await fetch(`/api/connections/status/${profileUserId}`);
        if (!response.ok) throw new Error('Failed to load connection status');
        
        const data = await response.json();
        
        if (data.status === 'connected') {
            container.innerHTML = `
                <button class="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg cursor-default">
                    <i class="fas fa-check mr-2"></i>Connected
                </button>
            `;
        } else if (data.status === 'pending') {
            container.innerHTML = `
                <button class="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg cursor-default">
                    <i class="fas fa-clock mr-2"></i>Request Pending
                </button>
            `;
        } else {
            container.innerHTML = `
                <button onclick="sendConnectionRequest()" 
                    class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition">
                    <i class="fas fa-user-plus mr-2"></i>Connect
                </button>
            `;
        }
        
    } catch (error) {
        console.error('Error loading connection status:', error);
    }
}

async function sendConnectionRequest() {
    try {
        const response = await fetch('/api/connections/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: profileUserId })
        });
        
        if (!response.ok) throw new Error('Failed to send request');
        
        loadConnectionStatus();
        showToast('Connection request sent!', 'success');
        
    } catch (error) {
        console.error('Error sending connection request:', error);
        showToast('Failed to send connection request', 'error');
    }
}

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
        const response = await fetch(`/api/posts/${postId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) throw new Error('Failed to post comment');
        
        input.value = '';
        
        const postIndex = feedLoader.posts.findIndex(p => p.id == postId);
        if (postIndex >= 0) {
            feedLoader.openComments(postIndex);
        }
        
    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Failed to post comment', 'error');
    }
}
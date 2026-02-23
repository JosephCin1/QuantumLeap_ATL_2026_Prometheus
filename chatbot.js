const userRaw = sessionStorage.getItem('currentUser');
const clearanceEl = document.getElementById('clearance');
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const textSizeSelect = document.getElementById('text-size');
const adminSettings = document.getElementById('admin-settings');
const iccpRole = document.getElementById('iccp-role');
const iccpPermissions = document.getElementById('iccp-permissions');

const rolePermissions = {
  student: [
    { label: 'Student Grade', key: 'student_grade', enabled: true },
    { label: 'Location', key: 'location', enabled: true },
    { label: 'SSN', key: 'ssn', enabled: true }
  ],
  faculty: [
    { label: 'Student Grade', key: 'student_grade', enabled: true },
    { label: 'Location', key: 'location', enabled: true },
    { label: 'SSN', key: 'ssn', enabled: false }
  ],
  staff: [
    { label: 'Student Grade', key: 'student_grade', enabled: true },
    { label: 'Location', key: 'location', enabled: true },
    { label: 'SSN', key: 'ssn', enabled: false }
  ]
};

if (!userRaw) {
  window.location.href = 'login.html';
} else {
  const user = JSON.parse(userRaw);
  clearanceEl.textContent = `Logged in as ${user.username}. Role: ${user.role}. Clearance: ${user.clearance}.`;

  if (user.role.toLowerCase() === 'administrator') {
    adminSettings.hidden = false;
    renderIccpPermissions(iccpRole.value);
  }
}

function renderIccpPermissions(role) {
  const permissions = rolePermissions[role] || [];
  iccpPermissions.innerHTML = '';

  permissions.forEach((permission) => {
    const row = document.createElement('label');
    row.className = 'inline-control';

    const text = document.createElement('span');
    text.textContent = permission.label;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = permission.enabled;

    if (permission.key === 'ssn' && role !== 'student') {
      toggle.disabled = true;
    }

    row.append(text, toggle);
    iccpPermissions.appendChild(row);
  });
}

function addBubble(text, speaker) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${speaker}`;
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

settingsToggle.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

darkModeToggle.addEventListener('change', () => {
  document.body.classList.toggle('theme-dark', darkModeToggle.checked);
});

textSizeSelect.addEventListener('change', () => {
  document.body.dataset.textSize = textSizeSelect.value;
});

iccpRole.addEventListener('change', () => {
  renderIccpPermissions(iccpRole.value);
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  addBubble(question, 'user');
  addBubble('Demo chatbot response: request received and evaluated with ICCP rules.', 'bot');
  chatInput.value = '';
});

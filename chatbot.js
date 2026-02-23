const userRaw = sessionStorage.getItem('currentUser');
const clearanceEl = document.getElementById('clearance');
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const textSizeSelect = document.getElementById('text-size');
const rolePrivilegesGrid = document.getElementById('role-privileges-grid');
const importAuditBtn = document.getElementById('import-audit-btn');
const auditFileInput = document.getElementById('audit-file-input');
const auditLogStatements = document.getElementById('audit-log-statements');
const integrationsList = document.getElementById('integrations-list');

const settingsLaunchButtons = document.querySelectorAll('.settings-launch-btn');
const settingsModals = document.querySelectorAll('.settings-modal');
const closeModalButtons = document.querySelectorAll('[data-close-modal]');

const rolePermissions = {
  student: [
    { label: 'Student Grades', key: 'student_grades', enabled: true },
    { label: 'Location', key: 'location', enabled: true },
    { label: 'SSN', key: 'ssn', enabled: false }
  ],
  faculty: [
    { label: 'Student Grades', key: 'student_grades', enabled: true },
    { label: 'Location', key: 'location', enabled: true },
    { label: 'SSN', key: 'ssn', enabled: false }
  ],
  staff: [
    { label: 'Student Grades', key: 'student_grades', enabled: true },
    { label: 'Location', key: 'location', enabled: false },
    { label: 'SSN', key: 'ssn', enabled: false }
  ],
  administrator: [
    { label: 'Student Grades', key: 'student_grades', enabled: true },
    { label: 'Location', key: 'location', enabled: true },
    { label: 'SSN', key: 'ssn', enabled: true }
  ]
};

const integrationConfig = [
  {
    name: 'CAMPUS CE',
    apiKey: 'CAMPUS-API-2244',
    secret: 'campus-secret-1122'
  },
  {
    name: 'PAYMENTUS',
    apiKey: 'PAY-API-7744',
    secret: 'paymentus-secret-3119'
  },
  {
    name: 'ELLUCIAN',
    apiKey: 'ELLUCIAN-API-0093',
    secret: 'ellucian-secret-5561'
  },
  {
    name: 'SOCURE',
    apiKey: 'SOCURE-API-4213',
    secret: 'socure-secret-1188'
  }
];

if (!userRaw) {
  window.location.href = 'login.html';
} else {
  const user = JSON.parse(userRaw);
  clearanceEl.textContent = `Logged in as ${user.username}. Role: ${user.role}. Clearance: ${user.clearance}.`;

  // Only show settings for administrators
  if (user.role.toLowerCase() !== 'administrator') {
    settingsToggle.style.display = 'none';
    settingsPanel.hidden = true;
  }
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  values.push(value.trim());
  return values;
}

function addBubble(text, speaker) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${speaker}`;
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderRolePrivileges() {
  rolePrivilegesGrid.innerHTML = '';
  const roles = Object.keys(rolePermissions);

  roles.forEach((role) => {
    const card = document.createElement('article');
    card.className = 'role-card';

    const heading = document.createElement('h4');
    heading.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    card.appendChild(heading);

    rolePermissions[role].forEach((permission) => {
      const row = document.createElement('label');
      row.className = 'role-item';

      const text = document.createElement('span');
      text.textContent = permission.label;

      const toggle = document.createElement('input');
      toggle.className = 'apple-toggle';
      toggle.type = 'checkbox';
      toggle.checked = permission.enabled;
      toggle.addEventListener('change', () => {
        permission.enabled = toggle.checked;
      });

      row.append(text, toggle);
      card.appendChild(row);
    });

    rolePrivilegesGrid.appendChild(card);
  });
}

function renderIntegrations() {
  integrationsList.innerHTML = '';

  integrationConfig.forEach((integration, index) => {
    const card = document.createElement('article');
    card.className = 'integration-card';

    const row = document.createElement('div');
    row.className = 'integration-row';

    const title = document.createElement('h4');
    title.className = 'integration-title';
    title.textContent = integration.name;

    const revealButton = document.createElement('button');
    revealButton.className = 'btn-secondary';
    revealButton.type = 'button';
    revealButton.textContent = 'Reveal';

    row.append(title, revealButton);
    card.appendChild(row);

    const fields = document.createElement('div');
    fields.className = 'integration-fields';
    fields.hidden = true;
    fields.innerHTML = `
      <label for="integration-username-${index}">Username</label>
      <input id="integration-username-${index}" type="text" placeholder="integration username" />
      <label for="integration-api-${index}">API Key</label>
      <input id="integration-api-${index}" type="text" value="${integration.apiKey}" />
      <label for="integration-secret-${index}">Secret</label>
      <input id="integration-secret-${index}" type="password" value="${integration.secret}" />
    `;

    revealButton.addEventListener('click', () => {
      const isHidden = fields.hidden;
      fields.hidden = !isHidden;
      revealButton.textContent = isHidden ? 'Hide' : 'Reveal';
    });

    card.appendChild(fields);
    integrationsList.appendChild(card);
  });
}

function openModal(modalId) {
  settingsModals.forEach((modal) => {
    modal.hidden = modal.id !== modalId;
  });
}

function closeModals() {
  settingsModals.forEach((modal) => {
    modal.hidden = true;
  });
}

function renderAuditStatements(rows, headers) {
  auditLogStatements.innerHTML = '';

  rows.forEach((row, index) => {
    const statement = document.createElement('p');
    statement.className = 'audit-statement';

    const userField = row.User || row.Username || row.Email || row.user || row.username || row.email || 'Unknown user';
    const actionField = row.Action || row.Event || row.Transaction || row.action || row.event || row.transaction || 'performed an action';
    const timeField =
      row.Timestamp || row.Date || row.Time || row.timestamp || row.date || row.time || `record ${index + 1}`;

    const extras = headers
      .filter(
        (header) =>
          !['user', 'username', 'email', 'action', 'event', 'transaction', 'timestamp', 'date', 'time'].includes(
            header.toLowerCase()
          )
      )
      .map((header) => `${header}: ${row[header]}`)
      .join(' | ');

    statement.textContent = `${timeField} - ${userField} ${actionField}${extras ? ` (${extras})` : ''}.`;
    auditLogStatements.appendChild(statement);
  });

  if (!rows.length) {
    auditLogStatements.textContent = 'No audit entries were found in the selected CSV.';
  }
}

function parseCsvText(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    return record;
  });

  return { headers, rows };
}

async function loadDefaultAuditLog() {
  try {
    const response = await fetch('user_transactions.csv', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Default audit file not found');
    }

    const csvText = await response.text();
    const { headers, rows } = parseCsvText(csvText);
    renderAuditStatements(rows, headers);
  } catch (error) {
    auditLogStatements.textContent = 'Import a CSV file to view audit statements.';
  }
}

settingsToggle.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

settingsLaunchButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openModal(button.dataset.window);
  });
});

closeModalButtons.forEach((button) => {
  button.addEventListener('click', closeModals);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModals();
    settingsPanel.hidden = true;
  }
});

darkModeToggle.addEventListener('change', () => {
  document.body.classList.toggle('theme-dark', darkModeToggle.checked);
});

textSizeSelect.addEventListener('change', () => {
  document.body.dataset.textSize = textSizeSelect.value;
});

importAuditBtn.addEventListener('click', () => {
  auditFileInput.click();
});

auditFileInput.addEventListener('change', async () => {
  const [file] = auditFileInput.files;
  if (!file) return;

  const csvText = await file.text();
  const { headers, rows } = parseCsvText(csvText);
  renderAuditStatements(rows, headers);
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  addBubble(question, 'user');
  addBubble('Demo chatbot response: request received and evaluated with ICCP rules.', 'bot');
  chatInput.value = '';
});

// Only initialize admin features if user is an administrator
if (userRaw) {
  const user = JSON.parse(userRaw);
  if (user.role.toLowerCase() === 'administrator') {
    renderRolePrivileges();
    renderIntegrations();
    loadDefaultAuditLog();
  }
}

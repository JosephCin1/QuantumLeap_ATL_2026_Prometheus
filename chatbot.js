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
const integrationsLaunchBtn = document.querySelector('.settings-launch-btn[data-window="integrations-modal"]');

const rolePermissions = {
  student: [
    { label: 'Grades', key: 'grades', enabled: true },
    { label: 'Transcript', key: 'transcript', enabled: true },
    { label: 'Payroll', key: 'payroll', enabled: false }
  ],
  staff: [
    { label: 'Grades', key: 'grades', enabled: true },
    { label: 'Transcript', key: 'transcript', enabled: true },
    { label: 'Payroll', key: 'payroll', enabled: true }
  ],
  faculty: [
    { label: 'Grades', key: 'grades', enabled: true },
    { label: 'Transcript', key: 'transcript', enabled: true },
    { label: 'Payroll', key: 'payroll', enabled: true }
  ]
};

const integrationConfig = [
  { name: 'CAMPUS CE', apiKey: 'CAMPUS-API-2244', secret: 'campus-secret-1122' },
  { name: 'PAYMENTUS', apiKey: 'PAY-API-7744', secret: 'paymentus-secret-3119' },
  { name: 'ELLUCIAN', apiKey: 'ELLUCIAN-API-0093', secret: 'ellucian-secret-5561' },
  { name: 'SOCURE', apiKey: 'SOCURE-API-4213', secret: 'socure-secret-1188' }
];

let currentUser = null;
let isAdministrator = false;
let canAccessSettings = false;
let integrationsLoaded = false;
let auditLoaded = false;

if (!userRaw) {
  window.location.href = 'login.html';
} else {
  currentUser = JSON.parse(userRaw);
  const normalizedRole = (currentUser.role || '').toLowerCase();
  const settingsAllowedRoles = ['administrator', 'student', 'staff', 'faculty'];
  isAdministrator = normalizedRole === 'administrator';
  canAccessSettings = settingsAllowedRoles.includes(normalizedRole);

  if (clearanceEl) {
    clearanceEl.textContent = `Logged in as ${currentUser.username}. Role: ${currentUser.role}. Clearance: ${currentUser.clearance}.`;
  }

  if (!canAccessSettings && settingsToggle && settingsPanel) {
    settingsToggle.hidden = true;
    settingsPanel.hidden = true;
  }

  if (!isAdministrator && integrationsLaunchBtn) {
    integrationsLaunchBtn.hidden = true;
  }
}

function addBubble(text, speaker) {
  if (!chatWindow) return;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${speaker}`;
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
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

function renderRolePrivileges() {
  if (!rolePrivilegesGrid) return;
  rolePrivilegesGrid.innerHTML = '';
  const roles = ['student', 'staff', 'faculty'];

  roles.forEach((role) => {
    const card = document.createElement('article');
    card.className = 'role-card';

    const heading = document.createElement('h4');
    heading.textContent = role.charAt(0).toUpperCase() + role.slice(1);
    card.appendChild(heading);

    rolePermissions[role].forEach((permission) => {
      const row = document.createElement('label');
      row.className = 'role-item';

      const textWrap = document.createElement('div');
      textWrap.className = 'role-item-text';

      const text = document.createElement('span');
      text.textContent = permission.label;

      const state = document.createElement('small');
      state.className = 'role-item-state';
      state.textContent = permission.enabled ? 'Allow' : 'Disable';

      textWrap.append(text, state);

      const toggle = document.createElement('input');
      toggle.className = 'apple-toggle';
      toggle.type = 'checkbox';
      toggle.checked = permission.enabled;
      toggle.addEventListener('change', () => {
        permission.enabled = toggle.checked;
        state.textContent = permission.enabled ? 'Allow' : 'Disable';
      });

      row.append(textWrap, toggle);
      card.appendChild(row);
    });

    rolePrivilegesGrid.appendChild(card);
  });
}

function renderIntegrations() {
  if (!integrationsList) return;
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
      const wasHidden = fields.hidden;
      fields.hidden = !wasHidden;
      revealButton.textContent = wasHidden ? 'Hide' : 'Reveal';
    });

    card.appendChild(fields);
    integrationsList.appendChild(card);
  });
}

function ensureIntegrationsLoaded() {
  if (!isAdministrator || integrationsLoaded) return;
  renderIntegrations();
  integrationsLoaded = true;
}

function renderAuditStatements(rows, headers) {
  if (!auditLogStatements) return;
  auditLogStatements.innerHTML = '';

  if (!rows.length) {
    auditLogStatements.textContent = 'No audit entries were found in the selected CSV.';
    return;
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = 'audit-table-wrap';

  const table = document.createElement('table');
  table.className = 'audit-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach((header) => {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    headers.forEach((header) => {
      const td = document.createElement('td');
      td.textContent = row[header] || '-';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  tableWrap.appendChild(table);
  auditLogStatements.appendChild(tableWrap);
}

async function loadDefaultAuditLog() {
  if (auditLoaded) return;
  if (!auditLogStatements) return;
  try {
    const response = await fetch('user_transactions.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error('Default audit file not found');
    const csvText = await response.text();
    const { headers, rows } = parseCsvText(csvText);
    renderAuditStatements(rows, headers);
    auditLoaded = true;
  } catch (error) {
    auditLogStatements.textContent = 'Import a CSV file to view audit statements.';
  }
}

function openModal(modalId, sourceButton) {
  if (!canAccessSettings) return;
  if (modalId === 'integrations-modal') {
    if (!isAdministrator) return;
    if (!integrationsLaunchBtn || sourceButton !== integrationsLaunchBtn) return;
    ensureIntegrationsLoaded();
  }
  if (modalId === 'audit-modal') {
    loadDefaultAuditLog();
  }

  settingsModals.forEach((modal) => {
    modal.hidden = modal.id !== modalId;
  });
}

function closeModals() {
  settingsModals.forEach((modal) => {
    modal.hidden = true;
  });
}

if (settingsToggle) {
  settingsToggle.addEventListener('click', () => {
    if (!canAccessSettings || !settingsPanel) return;
    settingsPanel.hidden = !settingsPanel.hidden;
  });
}

settingsLaunchButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openModal(button.dataset.window, button);
  });
});

closeModalButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    closeModals();
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModals();
    if (settingsPanel) settingsPanel.hidden = true;
  }
});

if (darkModeToggle) {
  darkModeToggle.addEventListener('change', () => {
    document.body.classList.toggle('theme-dark', darkModeToggle.checked);
  });
}

if (textSizeSelect) {
  textSizeSelect.addEventListener('change', () => {
    document.body.dataset.textSize = textSizeSelect.value;
  });
}

if (importAuditBtn && auditFileInput) {
  importAuditBtn.addEventListener('click', () => {
    auditFileInput.click();
  });
}

if (auditFileInput) {
  auditFileInput.addEventListener('change', async () => {
    const [file] = auditFileInput.files;
    if (!file) return;
    const csvText = await file.text();
    const { headers, rows } = parseCsvText(csvText);
    renderAuditStatements(rows, headers);
    auditLoaded = true;
  });
}

if (chatForm) {
  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = (chatInput?.value || '').trim();
    if (!question) return;
    addBubble(question, 'user');
    addBubble('Demo chatbot response: request received and evaluated with ICCP rules.', 'bot');
    chatInput.value = '';
  });
}

renderRolePrivileges();

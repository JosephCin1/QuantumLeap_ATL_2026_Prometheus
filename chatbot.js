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
const auditLogBtn = document.getElementById('audit-log-btn');
const auditLogContainer = document.getElementById('audit-log-container');
const closeAuditBtn = document.getElementById('close-audit-btn');
const auditLogTable = document.getElementById('audit-log-table');

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

async function loadAuditLog() {
  try {
    const response = await fetch('audit_log.csv', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Could not load audit log');
    }

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    const headers = parseCsvLine(lines[0]);

    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      return record;
    });

    displayAuditLog(rows, headers);
  } catch (error) {
    auditLogTable.textContent = `Error loading audit log: ${error.message}`;
  }
}

function displayAuditLog(rows, headers) {
  auditLogTable.innerHTML = '';

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
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    headers.forEach((header) => {
      const td = document.createElement('td');
      td.textContent = row[header];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  auditLogTable.appendChild(table);
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

auditLogBtn.addEventListener('click', () => {
  auditLogContainer.hidden = !auditLogContainer.hidden;
  if (!auditLogContainer.hidden && auditLogTable.innerHTML === '') {
    loadAuditLog();
  }
});

closeAuditBtn.addEventListener('click', () => {
  auditLogContainer.hidden = true;
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  addBubble(question, 'user');
  addBubble('Demo chatbot response: request received and evaluated with ICCP rules.', 'bot');
  chatInput.value = '';
});

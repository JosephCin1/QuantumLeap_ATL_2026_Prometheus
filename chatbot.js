// ═══════════════════════════════════════════════════════════════════════════
//  ICCP Chatbot – vanilla JS client for the Node/Express ICCP backend
// ═══════════════════════════════════════════════════════════════════════════

// ─── Config ──────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3001';

// ─── DOM refs ────────────────────────────────────────────────────────────
const userIdInput    = document.getElementById('userId');
const idStatus       = document.getElementById('id-status');
const clearanceEl    = document.getElementById('clearance');
const chatWindow     = document.getElementById('chat-window');
const chatForm       = document.getElementById('chat-form');
const chatInput      = document.getElementById('chat-input');
const sendBtn        = document.getElementById('sendBtn');
const debugPanel     = document.getElementById('debugPanel');

// Settings (existing UI)
const settingsToggle    = document.getElementById('settings-toggle');
const settingsPanel     = document.getElementById('settings-panel');
const darkModeToggle    = document.getElementById('dark-mode-toggle');
const textSizeSelect    = document.getElementById('text-size');
const adminSettings     = document.getElementById('admin-settings');
const iccpRole          = document.getElementById('iccp-role');
const iccpPermissions   = document.getElementById('iccp-permissions');
const auditLogBtn       = document.getElementById('audit-log-btn');
const auditLogContainer = document.getElementById('audit-log-container');
const closeAuditBtn     = document.getElementById('close-audit-btn');
const auditLogTable     = document.getElementById('audit-log-table');

// ─── Admin-panel role permissions (existing feature) ─────────────────────
const rolePermissions = {
  student: [
    { label: 'Student Grade', key: 'student_grade', enabled: true },
    { label: 'Location',      key: 'location',      enabled: true },
    { label: 'SSN',           key: 'ssn',           enabled: true }
  ],
  faculty: [
    { label: 'Student Grade', key: 'student_grade', enabled: true },
    { label: 'Location',      key: 'location',      enabled: true },
    { label: 'SSN',           key: 'ssn',           enabled: false }
  ],
  staff: [
    { label: 'Student Grade', key: 'student_grade', enabled: true },
    { label: 'Location',      key: 'location',      enabled: true },
    { label: 'SSN',           key: 'ssn',           enabled: false }
  ]
};

// ─── Session / identity ──────────────────────────────────────────────────
const userRaw = sessionStorage.getItem('currentUser');

if (!userRaw) {
  // No login session → still let the page work (user types ID manually)
  clearanceEl.textContent = 'Not logged in — enter a User ID below.';
} else {
  const user = JSON.parse(userRaw);
  clearanceEl.textContent =
    'Logged in as ' + user.username + '. Role: ' + user.role + '. Clearance: ' + user.clearance + '.';

  // Auto-populate the userId field with the login email
  userIdInput.value = user.username;

  if (user.role.toLowerCase() === 'administrator') {
    adminSettings.hidden = false;
    renderIccpPermissions(iccpRole.value);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Resource inference — determines requested_resources from user message
// ═══════════════════════════════════════════════════════════════════════════

function inferResources(message, userId) {
  var lower = message.toLowerCase();

  // Transaction / history keywords → user_transactions
  if (/\b(transaction|transactions|history|payment|payments|purchase|purchases|ledger|spending)\b/.test(lower)) {
    return ['user_transactions:' + userId];
  }

  // Context / profile keywords → users_context
  if (/\b(context|profile|who am i|my info|about me|permissions|goals|my data|my record|my account)\b/.test(lower)) {
    return ['users_context:' + userId];
  }

  // Both
  if (/\b(everything|all data|full report|all my)\b/.test(lower)) {
    return ['users_context:' + userId, 'user_transactions:' + userId];
  }

  // General chat — no data needed
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
//  Chat bubbles
// ═══════════════════════════════════════════════════════════════════════════

function addBubble(text, speaker, extraClass) {
  var bubble = document.createElement('div');
  bubble.className = 'bubble ' + speaker + (extraClass ? ' ' + extraClass : '');

  // Support basic newlines in text
  text.split('\n').forEach(function (line, i) {
    if (i > 0) bubble.appendChild(document.createElement('br'));
    bubble.appendChild(document.createTextNode(line));
  });

  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Debug panel
// ═══════════════════════════════════════════════════════════════════════════

function updateDebug(data) {
  var display = {
    decision:       data.decision       || undefined,
    trace_id:       data.trace_id       || undefined,
    reason:         data.reason         || undefined,
    context_packet: data.context_packet || undefined,
    error:          data.error          || undefined
  };
  // Strip undefined keys
  Object.keys(display).forEach(function (k) {
    if (display[k] === undefined) delete display[k];
  });
  debugPanel.textContent = JSON.stringify(display, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Send message to ICCP backend
// ═══════════════════════════════════════════════════════════════════════════

var isSending = false;

async function sendMessage() {
  if (isSending) return;

  var userId  = userIdInput.value.trim();
  var message = chatInput.value.trim();

  // Validation
  if (!userId) {
    addBubble('⚠️ Please enter your User ID above before sending.', 'bot', 'warn');
    userIdInput.focus();
    return;
  }
  if (!message) {
    addBubble('⚠️ Please type a message.', 'bot', 'warn');
    chatInput.focus();
    return;
  }

  // Show user bubble
  addBubble(message, 'user');
  chatInput.value = '';

  // Determine resources
  var requestedResources = inferResources(message, userId);

  // Show what we inferred (small tag)
  if (requestedResources.length > 0) {
    idStatus.textContent = 'Resources: ' + requestedResources.join(', ');
  } else {
    idStatus.textContent = 'General chat (no data resources)';
  }

  // Loading indicator
  var loadingBubble = addBubble('Thinking…', 'bot', 'loading');
  isSending = true;
  sendBtn.disabled = true;

  try {
    var res = await fetch(API_BASE + '/iccp/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        prompt: message,
        requested_resources: requestedResources
      })
    });

    loadingBubble.remove();

    var data = await res.json();

    if (data.error) {
      // Backend returned an error (e.g. unknown user, missing fields)
      addBubble('⚠️ ' + data.error, 'bot', 'error');
      updateDebug(data);
      return;
    }

    if (data.decision === 'DENY') {
      addBubble(
        '🚫 Access Denied\n' + data.reason + '\n\nTrace: ' + data.trace_id,
        'bot',
        'deny'
      );
    } else if (data.decision === 'ALLOW') {
      addBubble(data.answer || '(No response content)', 'bot');
    } else {
      addBubble('Unexpected response from server.', 'bot', 'error');
    }

    updateDebug(data);

  } catch (err) {
    loadingBubble.remove();
    addBubble(
      '⚠️ Backend unreachable — make sure the server is running on ' + API_BASE,
      'bot',
      'error'
    );
    updateDebug({ error: err.message });
  } finally {
    isSending = false;
    sendBtn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Audit log – fetches from backend /iccp/audit
// ═══════════════════════════════════════════════════════════════════════════

async function loadAuditLog() {
  auditLogTable.textContent = 'Loading…';
  try {
    var res = await fetch(API_BASE + '/iccp/audit', { cache: 'no-store' });
    if (!res.ok) throw new Error('Server returned ' + res.status);

    var data = await res.json();
    var logs = data.logs || [];

    if (logs.length === 0) {
      auditLogTable.textContent = 'No audit entries yet.';
      return;
    }

    var headers = Object.keys(logs[0]);
    displayAuditLog(logs, headers);
  } catch (err) {
    auditLogTable.textContent = 'Error loading audit log: ' + err.message;
  }
}

function displayAuditLog(rows, headers) {
  auditLogTable.innerHTML = '';

  var table = document.createElement('table');
  table.className = 'audit-table';

  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  headers.forEach(function (header) {
    var th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  rows.forEach(function (row) {
    var tr = document.createElement('tr');
    headers.forEach(function (header) {
      var td = document.createElement('td');
      var val = row[header];
      // Pretty-print arrays
      td.textContent = Array.isArray(val) ? val.join(', ') : (val || '');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  auditLogTable.appendChild(table);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Admin ICCP permissions (existing feature, preserved)
// ═══════════════════════════════════════════════════════════════════════════

function renderIccpPermissions(role) {
  var permissions = rolePermissions[role] || [];
  iccpPermissions.innerHTML = '';

  permissions.forEach(function (permission) {
    var row = document.createElement('label');
    row.className = 'inline-control';

    var text = document.createElement('span');
    text.textContent = permission.label;

    var toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = permission.enabled;

    if (permission.key === 'ssn' && role !== 'student') {
      toggle.disabled = true;
    }

    row.append(text, toggle);
    iccpPermissions.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Event listeners
// ═══════════════════════════════════════════════════════════════════════════

// Chat submit (button click + Enter key via form submit)
chatForm.addEventListener('submit', function (e) {
  e.preventDefault();
  sendMessage();
});

// Settings toggle
settingsToggle.addEventListener('click', function () {
  settingsPanel.hidden = !settingsPanel.hidden;
});

// Dark mode
darkModeToggle.addEventListener('change', function () {
  document.body.classList.toggle('theme-dark', darkModeToggle.checked);
});

// Text size
textSizeSelect.addEventListener('change', function () {
  document.body.dataset.textSize = textSizeSelect.value;
});

// ICCP role selector (admin panel)
iccpRole.addEventListener('change', function () {
  renderIccpPermissions(iccpRole.value);
});

// Audit log (admin panel) – now fetches from backend
auditLogBtn.addEventListener('click', function () {
  auditLogContainer.hidden = !auditLogContainer.hidden;
  if (!auditLogContainer.hidden && auditLogTable.innerHTML === '') {
    loadAuditLog();
  }
});

closeAuditBtn.addEventListener('click', function () {
  auditLogContainer.hidden = true;
});

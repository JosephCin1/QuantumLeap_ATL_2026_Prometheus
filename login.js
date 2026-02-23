const viewButtons = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.auth-view');

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetForm = document.getElementById('reset-form');

const statusEl = document.getElementById('status');
const signupStatusEl = document.getElementById('signup-status');
const resetStatusEl = document.getElementById('reset-status');
const generatedEmailEl = document.getElementById('generated-email');
const resetConfirmation = document.getElementById('reset-confirmation');

const COMPANY_EMAIL_MAP = {
  campus: 'campus.ce.edu',
  paymentus: 'paymentus.edu',
  ellucian: 'ellucian.edu',
  socure: 'socure.edu'
};

const STATIC_PASSWORDS = {
  'john@campus.ce.edu': '123',
  'faculty@paymentus.edu': '123',
  'admin@ellucian.edu': '123'
};

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

async function loadUsersFromCsv() {
  const response = await fetch('users.csv', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Could not load users.csv');
  }

  const csvText = await response.text();
  const lines = csvText.trim().split('\n');
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || '';
    });

    const username = (record.username || '').toLowerCase().includes('@')
      ? record.username.toLowerCase()
      : `${record.username.toLowerCase()}@uni.atlanta.edu`;

    return {
      username,
      role: record.role || 'Student',
      roleOnProject: record.role_on_project || 'End User',
      clearance: record.role || 'Student'
    };
  });
}

function setStatus(element, message, type = '') {
  element.textContent = message;
  element.className = `status ${type}`;
}

function activateView(viewId) {
  views.forEach((view) => {
    view.classList.toggle('active', view.id === viewId);
  });

  viewButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewId);
  });
}

viewButtons.forEach((button) => {
  button.addEventListener('click', () => activateView(button.dataset.view));
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(statusEl, 'Checking credentials...');

  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
    setStatus(statusEl, 'Use a valid email address.', 'error');
    return;
  }

  try {
    const users = await loadUsersFromCsv();
    const matchedUser = users.find((user) => user.username === username);

    if (!matchedUser || STATIC_PASSWORDS[username] !== password) {
      setStatus(statusEl, 'Invalid username or password. Demo uses password 123.', 'error');
      return;
    }

    sessionStorage.setItem(
      'currentUser',
      JSON.stringify({
        username,
        role: matchedUser.role,
        clearance: matchedUser.clearance,
        roleOnProject: matchedUser.roleOnProject
      })
    );

    setStatus(statusEl, `Access granted. Role: ${matchedUser.role}.`, 'success');

    setTimeout(() => {
      window.location.href = 'chatbot.html';
    }, 700);
  } catch (error) {
    setStatus(statusEl, error.message, 'error');
  }
});

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.getElementById('signup-username').value.trim().toLowerCase();
  const company = document.getElementById('signup-company').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm').value;

  if (!/^[a-z0-9]{3,}$/.test(username)) {
    setStatus(signupStatusEl, 'Username must be at least 3 characters and alphanumeric.', 'error');
    return;
  }

  if (!company) {
    setStatus(signupStatusEl, 'Please choose a company.', 'error');
    return;
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(password)) {
    setStatus(signupStatusEl, 'Password does not meet the requirements.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    setStatus(signupStatusEl, 'Password confirmation does not match.', 'error');
    return;
  }

  const generatedEmail = `${username}@${COMPANY_EMAIL_MAP[company]}`;
  generatedEmailEl.textContent = `Generated company email: ${generatedEmail}`;
  setStatus(signupStatusEl, 'Sign-up form accepted. Account request queued.', 'success');
});

resetForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const resetEmail = document.getElementById('reset-email').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
    setStatus(resetStatusEl, 'Enter a valid email for reset.', 'error');
    return;
  }

  resetConfirmation.hidden = false;
  setStatus(resetStatusEl, 'Confirmation email sent.', 'success');
});

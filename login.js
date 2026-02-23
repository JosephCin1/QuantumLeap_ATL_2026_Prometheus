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
  'john.doe@campus.ce.edu': 'Student@123',
  'aisha.patel@campus.ce.edu': 'Student@123',
  'michael.brown@campus.ce.edu': 'Student@123',
  'sophia.nguyen@campus.ce.edu': 'Student@123',
  'carlos.martinez@campus.ce.edu': 'Student@123',
  'lily.chen@campus.ce.edu': 'Student@123',
  'noah.wilson@campus.ce.edu': 'Student@123',
  'emma.rodriguez@campus.ce.edu': 'Student@123',
  'alan.richards@paymentus.edu': 'Faculty@123',
  'melissa.grant@paymentus.edu': 'Faculty@123',
  'daniel.park@paymentus.edu': 'Faculty@123',
  'rebecca.collins@paymentus.edu': 'Faculty@123',
  'brian.cooper@paymentus.edu': 'Faculty@123',
  'angela.morris@paymentus.edu': 'Faculty@123',
  'susan.carter@lightleap.ai': 'Admin@123',
  'michael.reynolds@lightleap.ai': 'Admin@123',
  'angela.watson@lightleap.ai': 'Admin@123',
  'daniel.price@lightleap.ai': 'Admin@123',
  'linda.morales@lightleap.ai': 'Admin@123',
  'robert.turner@lightleap.ai': 'Admin@123'
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
  const [credentialsResponse, contextResponse] = await Promise.all([
    fetch('user_credentials.csv', { cache: 'no-store' }),
    fetch('users_context.csv', { cache: 'no-store' })
  ]);

  if (!credentialsResponse.ok || !contextResponse.ok) {
    throw new Error('Could not load user files');
  }

  const credentialsCsv = await credentialsResponse.text();
  const contextCsv = await contextResponse.text();

  const credentialLines = credentialsCsv.trim().split('\n');
  const credentialHeaders = parseCsvLine(credentialLines[0]);
  const credentials = {};

  credentialLines.slice(1).forEach((line) => {
    const row = parseCsvLine(line);
    const record = {};
    credentialHeaders.forEach((header, index) => {
      record[header] = row[index] || '';
    });
    if (record.Email) {
      credentials[record.Email.toLowerCase()] = record;
    }
  });

  const contextLines = contextCsv.trim().split('\n');
  const contextHeaders = parseCsvLine(contextLines[0]);

  return contextLines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    const record = {};
    contextHeaders.forEach((header, index) => {
      record[header] = row[index] || '';
    });

    const userIdStr = record.UserID || '';
    const email = Object.keys(credentials).find((email) => {
      const cred = credentials[email];
      return cred.UserID === userIdStr;
    });

    return {
      username: email || record.username,
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

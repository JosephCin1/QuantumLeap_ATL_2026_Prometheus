const form = document.getElementById("login-form");
const statusEl = document.getElementById("status");

const REQUIRED_USERNAME = "john@uni.atlanta.edu";
const REQUIRED_PASSWORD = "123";

async function loadUsersFromCsv() {
  const response = await fetch("users.csv", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load users.csv");
  }

  const csvText = await response.text();
  const rows = csvText
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [username, password, role, clearance] = line.split(",").map((v) => v.trim());
      return { username, password, role, clearance };
    });

  return rows;
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Checking credentials...", "");

  const username = document.getElementById("username").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!/^[^\s@]+@uni\.atlanta\.edu$/i.test(username)) {
    setStatus("Use a valid @uni.atlanta.edu email.", "error");
    return;
  }

  try {
    const users = await loadUsersFromCsv();
    const matchedUser = users.find((user) => user.username.toLowerCase() === username && user.password === password);

    if (!matchedUser) {
      setStatus("Invalid username or password.", "error");
      return;
    }

    if (username !== REQUIRED_USERNAME || password !== REQUIRED_PASSWORD) {
      setStatus("Access denied. Demo login only allows john@uni.atlanta.edu / 123.", "error");
      return;
    }

    sessionStorage.setItem("currentUser", JSON.stringify(matchedUser));
    setStatus(`Access granted. Clearance level: ${matchedUser.clearance} (${matchedUser.role}).`, "success");

    setTimeout(() => {
      window.location.href = "chatbot.html";
    }, 700);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

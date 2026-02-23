const userRaw = sessionStorage.getItem("currentUser");
const clearanceEl = document.getElementById("clearance");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

if (!userRaw) {
  window.location.href = "login.html";
} else {
  const user = JSON.parse(userRaw);
  clearanceEl.textContent = `Logged in as ${user.username}. Role: ${user.role}. Clearance: ${user.clearance}.`;
}

function addBubble(text, speaker) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${speaker}`;
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  addBubble(question, "user");
  addBubble("Demo chatbot response: request received and evaluated with ICCP rules.", "bot");
  chatInput.value = "";
});

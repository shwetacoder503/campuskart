const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");
const btn = document.getElementById("submitBtn");
const resendBox = document.getElementById("resendBox");
const resendBtn = document.getElementById("resendBtn");

if (getToken()) location.replace("index.html"); // pehle se logged in

function showMsg(text, type) {
  msg.textContent = text;
  msg.className = "form-msg " + type;
  msg.hidden = false;
}

// next param sirf simple page name allow (open redirect se bachne ke liye)
function nextPage() {
  const next = new URLSearchParams(location.search).get("next");
  return next && /^[a-z0-9-]+\.html(\?id=\d+)?$/i.test(next) ? next : "index.html";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;
  resendBox.hidden = true;

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  if (!email || !password) {
    showMsg("Please enter both email and password.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Logging in...";
  try {
    const data = await apiPost("/api/auth/login", { email, password });
    saveSession(data);
    location.href = nextPage();
  } catch (err) {
    showMsg(err.message, "error");
    if (err.status === 403) resendBox.hidden = false; // email unverified
  } finally {
    btn.disabled = false;
    btn.textContent = "Log in";
  }
});

resendBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim().toLowerCase();
  if (!email) {
    showMsg("Please enter your email first.", "error");
    return;
  }
  resendBtn.disabled = true;
  try {
    await apiPost("/api/auth/resend-verification", { email });
    showMsg("If this email is registered, a new verification link has been sent.", "success");
  } catch (err) {
    showMsg(err.message, "error");
  } finally {
    resendBtn.disabled = false;
  }
});
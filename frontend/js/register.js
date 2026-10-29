const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");
const btn = document.getElementById("submitBtn");
const formBox = document.getElementById("formBox");
const doneBox = document.getElementById("doneBox");
const resendBtn = document.getElementById("resendBtn");
const resendMsg = document.getElementById("resendMsg");
let registeredEmail = "";

function showMsg(text) {
  msg.textContent = text;
  msg.className = "form-msg error";
  msg.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm").value;

  // Yeh sirf jaldi feedback ke liye hai, asli domain check backend karta hai
  if (!fullName) return showMsg("Naam daalo.");
  if (!email.endsWith("@sggs.ac.in")) return showMsg("Only @sggs.ac.in college emails are allowed.");
  if (password.length < 8) return showMsg("Password must be at least 8 characters.");
  if (password !== confirm) return showMsg("Passwords do not match.");

  btn.disabled = true;
  btn.textContent = "Creating...";
  try {
    await apiPost("/api/auth/register", { fullName, email, password });
    registeredEmail = email;
    formBox.hidden = true;
    doneBox.hidden = false;
  } catch (err) {
    showMsg(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create account";
  }
});

resendBtn.addEventListener("click", async () => {
  resendBtn.disabled = true;
  try {
    await apiPost("/api/auth/resend-verification", { email: registeredEmail });
    resendMsg.textContent = "A new link has been sent (you can request one every 60 seconds).";
  } catch (err) {
    resendMsg.textContent = err.message;
  } finally {
    resendMsg.hidden = false;
    resendBtn.disabled = false;
  }
});
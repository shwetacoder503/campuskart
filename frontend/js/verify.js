const titleEl = document.getElementById("title");
const textEl = document.getElementById("text");
const loginLink = document.getElementById("loginLink");

(async function verify() {
  const token = new URLSearchParams(location.search).get("token");
  // Token ko address bar/history se hata do
  history.replaceState(null, "", location.pathname);

  if (!token) {
    titleEl.textContent = "Invalid link";
    textEl.textContent = "No token found in this link. Please open the full link from your email.";
    return;
  }

  try {
    await apiPost("/api/auth/verify-email", { token });
    titleEl.textContent = "Email verified";
    textEl.textContent = "You can now log in.";
    loginLink.hidden = false;
  } catch (err) {
    titleEl.textContent = "Verification failed";
    textEl.textContent = err.message + " You can request a new link from the login page.";
    loginLink.textContent = "Go to log in";
    loginLink.hidden = false;
  }
})();
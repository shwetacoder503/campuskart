const TOKEN_KEY = "ck_token";
const USER_KEY = "ck_user";
const EXP_KEY = "ck_exp";

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  localStorage.setItem(EXP_KEY, String(Date.now() + data.expiresInSeconds * 1000));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXP_KEY);
}

function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const exp = Number(localStorage.getItem(EXP_KEY) || 0);
  if (!token || Date.now() >= exp) {
    clearSession();
    return null;
  }
  return token;
}

function getUser() {
  if (!getToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch (e) {
    return null;
  }
}

// Protected pages (sell, my listings...) ke upar yeh call karenge
function requireLogin() {
  if (!getToken()) {
    const page = (location.pathname.split("/").pop() || "index.html") + location.search;
    location.href = "login.html?next=" + encodeURIComponent(page);
  }
}

function renderNav() {
  const box = document.getElementById("navAuth");
  if (!box) return;
  box.replaceChildren();
  const user = getUser();

  if (user) {
    const hello = document.createElement("span");
    hello.className = "hello";
    hello.textContent = "Hi, " + user.fullName.split(" ")[0];
    box.appendChild(hello);

    const out = document.createElement("button");
    out.className = "btn btn-ghost";
    out.textContent = "Log out";
    out.addEventListener("click", () => {
      clearSession();
      location.href = "index.html";
    });
    box.appendChild(out);
  } else {
    const login = document.createElement("a");
    login.href = "login.html";
    login.className = "btn btn-ghost";
    login.textContent = "Log in";
    box.appendChild(login);
  }

  const sell = document.createElement("a");
  sell.href = "sell.html";
  sell.className = "btn btn-dark";
  sell.textContent = "Sell an item";
  box.appendChild(sell);
}

document.addEventListener("DOMContentLoaded", renderNav);
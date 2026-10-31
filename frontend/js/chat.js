requireLogin(); // login nahi hai toh login.html?next=chat.html?id=.. pe bhej deta hai

if (getToken()) {
  const convId = new URLSearchParams(location.search).get("id");
  const pageStatus = document.getElementById("pageStatus");
  const chatEl = document.getElementById("chat");
  const barEl = document.getElementById("productBar");
  const thread = document.getElementById("thread");
  const form = document.getElementById("sendForm");
  const input = document.getElementById("sendText");
  const sendBtn = document.getElementById("sendBtn");
  const sendError = document.getElementById("sendError");

  const POLL_MS = 5000;
  const seen = new Set(); // dobara dikhne se bachane ke liye
  let lastId = 0;
  let polling = false;
  let timer = null;

  function stopPolling() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function fail(text) {
    stopPolling();
    chatEl.hidden = true;
    pageStatus.hidden = false;
    pageStatus.textContent = text;
    pageStatus.className = "msg error";
  }

  function goLogin() {
    location.href = "login.html?next=" + encodeURIComponent("chat.html?id=" + convId);
  }

  function nearBottom() {
    return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
  }

  function clock(iso) {
    const d = new Date(iso);
    const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === new Date().toDateString()) return t;
    return d.toLocaleDateString([], { day: "numeric", month: "short" }) + ", " + t;
  }

  function bubble(m) {
    const b = el("div", "bubble " + (m.mine ? "mine" : "theirs"));
    b.appendChild(el("span", "", m.body)); // textContent = XSS safe
    b.appendChild(el("time", "", clock(m.createdAt)));
    return b;
  }

  function addMessages(list, forceScroll) {
    const stick = forceScroll || nearBottom();
    const empty = thread.querySelector(".thread-empty");
    if (empty && list.length) empty.remove();
    list.forEach((m) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      thread.appendChild(bubble(m));
      if (m.id > lastId) lastId = m.id;
    });
    if (stick) thread.scrollTop = thread.scrollHeight;
  }

  function renderBar(c) {
    const p = c.product;
    barEl.href = "product.html?id=" + p.id;
    barEl.replaceChildren();

    const pic = el("div", "cp-pic");
    pic.appendChild(svgIcon("OTHER", 24));
    if (p.image) {
      const img = document.createElement("img");
      img.src = imageUrl(p.image);
      img.alt = p.title;
      img.addEventListener("error", () => img.remove());
      pic.appendChild(img);
    }
    barEl.appendChild(pic);

    const info = el("div", "cp-info");
    info.appendChild(el("div", "cp-title", p.title));
    info.appendChild(el("div", "cp-meta", formatPrice(p.price) + " · " + (STATUS_LABEL[p.status] || p.status)));
    info.appendChild(
      el("div", "cp-who", (c.role === "BUYING" ? "You are buying from " : "You are selling to ") + c.otherName)
    );
    barEl.appendChild(info);
    document.title = "Chat with " + c.otherName + " | CampusKart";
  }

  async function poll() {
    if (polling || document.hidden) return;
    polling = true;
    try {
      const data = await apiGet("/api/conversations/" + convId + "/messages?afterId=" + lastId, true);
      if (data.messages.length) addMessages(data.messages, false);
    } catch (err) {
      if (err.status === 401) return goLogin();
      if (err.status === 404) return fail("This conversation is no longer available.");
      // baaki errors par chup raho, agli baar phir koshish hogi
    } finally {
      polling = false;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && timer) poll();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    sendError.hidden = true;
    sendBtn.disabled = true;
    try {
      const msg = await apiPost("/api/conversations/" + convId + "/messages", { body }, true);
      addMessages([msg], true);
      input.value = "";
    } catch (err) {
      if (err.status === 401) return goLogin();
      sendError.textContent = err.message; // jaise phone number wali rule
      sendError.hidden = false;
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  });

  (async function init() {
    if (!/^\d+$/.test(convId || "")) return fail("This chat link is not valid.");
    try {
      const data = await apiGet("/api/conversations/" + convId + "/messages", true);
      pageStatus.hidden = true;
      chatEl.hidden = false;
      renderBar(data.conversation);
      if (data.messages.length === 0) {
        thread.appendChild(el("div", "thread-empty", "No messages yet. Say hello!"));
      }
      addMessages(data.messages, true);
      timer = setInterval(poll, POLL_MS);
    } catch (err) {
      if (err.status === 401) return goLogin();
      fail(err.status === 404 ? "This conversation was not found." : err.message);
    }
  })();
}
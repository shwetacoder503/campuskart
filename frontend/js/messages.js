requireLogin(); // login nahi hai toh login.html?next=messages.html pe bhej deta hai

if (getToken()) {
  const listEl = document.getElementById("list");
  const loadingEl = document.getElementById("loading");
  const emptyEl = document.getElementById("empty");
  const moreBtn = document.getElementById("loadMore");
  const tabs = document.querySelectorAll(".tab");

  const state = { role: "", page: 1, size: 20, shown: 0, token: 0 };

  function goLogin() {
    location.href = "login.html?next=messages.html";
  }

  function buildRow(c) {
    const row = el("a", "convo");
    row.href = "chat.html?id=" + c.id;

    const pic = el("div", "convo-pic");
    pic.appendChild(svgIcon("OTHER", 24));
    if (c.product.image) {
      const img = document.createElement("img");
      img.src = imageUrl(c.product.image);
      img.alt = c.product.title;
      img.loading = "lazy";
      img.addEventListener("error", () => img.remove());
      pic.appendChild(img);
    }
    row.appendChild(pic);

    const mid = el("div", "convo-mid");
    const top = el("div", "convo-top");
    top.appendChild(el("span", "convo-name", c.otherName));
    top.appendChild(el("span", "convo-time", c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""));
    mid.appendChild(top);
    mid.appendChild(
      el(
        "div",
        "convo-product",
        c.product.title + " · " + formatPrice(c.product.price) + " · " + (c.role === "BUYING" ? "Buying" : "Selling")
      )
    );
    const last = c.lastMessage ? (c.lastMessage.mine ? "You: " : "") + c.lastMessage.body : "No messages yet";
    mid.appendChild(el("div", "convo-last" + (c.unreadCount ? " unread" : ""), last));
    row.appendChild(mid);

    const side = el("div", "convo-side");
    if (c.unreadCount) side.appendChild(el("span", "count-badge", String(c.unreadCount)));
    row.appendChild(side);
    return row;
  }

  async function load(reset) {
    const mine = ++state.token; // tab jaldi badle toh purana jawab ignore ho
    if (reset) {
      state.page = 1;
      state.shown = 0;
      listEl.replaceChildren();
    }
    moreBtn.hidden = true;
    emptyEl.hidden = true;
    loadingEl.hidden = false;
    loadingEl.textContent = "Loading...";
    loadingEl.className = "msg";

    const params = new URLSearchParams({ page: state.page, size: state.size });
    if (state.role) params.set("role", state.role);

    try {
      const data = await apiGet("/api/conversations?" + params.toString(), true);
      if (mine !== state.token) return;
      loadingEl.hidden = true;
      data.items.forEach((c) => listEl.appendChild(buildRow(c)));
      state.shown += data.items.length;
      emptyEl.hidden = state.shown > 0;
      moreBtn.hidden = state.shown >= data.total;
    } catch (err) {
      if (err.status === 401) return goLogin();
      if (mine !== state.token) return;
      loadingEl.textContent = err.message;
      loadingEl.className = "msg error";
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.role = tab.dataset.role;
      load(true);
    });
  });

  moreBtn.addEventListener("click", () => {
    state.page += 1;
    load(false);
  });

  load(true);
}
const box = document.getElementById("productBox");
const pageStatus = document.getElementById("pageStatus");
const dlg = document.getElementById("msgDialog");
const msgForm = document.getElementById("msgForm");
const msgFor = document.getElementById("msgFor");
const msgText = document.getElementById("msgText");
const msgError = document.getElementById("msgError");
const msgSend = document.getElementById("msgSend");
const msgCancel = document.getElementById("msgCancel");

let current = null; // abhi khula hua item

function fail(text) {
  pageStatus.hidden = false;
  pageStatus.textContent = text;
  pageStatus.className = "msg error";
}

function goLogin() {
  location.href = "login.html?next=" + encodeURIComponent("product.html?id=" + current.id);
}

function openMessage() {
  if (!getToken()) return goLogin();
  msgFor.textContent = "About: " + current.title;
  msgText.value = "Hi, is this still available?";
  msgError.hidden = true;
  dlg.showModal();
}

msgCancel.addEventListener("click", () => dlg.close());

msgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  msgError.hidden = true;
  const message = msgText.value.trim();
  if (!message) {
    msgError.textContent = "Please write a message.";
    msgError.hidden = false;
    return;
  }
  msgSend.disabled = true;
  msgSend.textContent = "Sending...";
  try {
    const conv = await apiPost("/api/conversations", { productId: current.id, message }, true);
    location.href = "chat.html?id=" + conv.id;
  } catch (err) {
    if (err.status === 401) return goLogin();
    msgError.textContent = err.message;
    msgError.hidden = false;
    msgSend.disabled = false;
    msgSend.textContent = "Send message";
  }
});

function render(p) {
  current = p;
  const cat = CATEGORIES[p.category] || CATEGORIES.OTHER;
  document.title = p.title + " | CampusKart";
  pageStatus.hidden = true;

  const grid = el("div", "product-grid");

  // ---- Gallery ----
  const gallery = el("div", "gallery");
  const main = el("div", "gallery-main");
  let mainImg = null;
  if (p.images.length) {
    mainImg = document.createElement("img");
    mainImg.src = imageUrl(p.images[0]);
    mainImg.alt = p.title;
    main.appendChild(mainImg);
  } else {
    main.style.background = cat.bg;
    main.style.color = cat.fg;
    main.appendChild(svgIcon(p.category, 96));
  }
  gallery.appendChild(main);

  if (p.images.length > 1) {
    const thumbs = el("div", "gallery-thumbs");
    p.images.forEach((path, i) => {
      const b = el("button", "gthumb" + (i === 0 ? " active" : ""));
      b.type = "button";
      b.setAttribute("aria-label", "Show photo " + (i + 1));
      const im = document.createElement("img");
      im.src = imageUrl(path);
      im.alt = "";
      b.appendChild(im);
      b.addEventListener("click", () => {
        mainImg.src = imageUrl(path);
        thumbs.querySelectorAll(".gthumb").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      thumbs.appendChild(b);
    });
    gallery.appendChild(thumbs);
  }
  grid.appendChild(gallery);

  // ---- Info ----
  const info = el("div", "product-info");

  const chip = el("span", "chip static");
  chip.style.color = cat.fg;
  chip.appendChild(svgIcon(p.category, 16));
  chip.appendChild(document.createTextNode(" " + cat.label));
  info.appendChild(chip);

  info.appendChild(el("h1", "product-title", p.title));
  info.appendChild(el("div", "product-price", formatPrice(p.price)));

  const tags = el("div", "product-tags");
  tags.appendChild(el("span", "status " + p.status, STATUS_LABEL[p.status] || p.status));
  tags.appendChild(el("span", "tag", "Condition: " + (CONDITIONS[p.itemCondition] || p.itemCondition)));
  info.appendChild(tags);

  info.appendChild(el("h2", "product-sub", "Description"));
  info.appendChild(el("p", "product-desc", p.description));

  info.appendChild(el("div", "seller", "Listed by " + p.sellerName + " · " + timeAgo(p.createdAt)));

  const me = getUser();
  if (me && me.id === p.sellerId) {
    const own = el("div", "own-note");
    own.appendChild(document.createTextNode("This is your listing. "));
    const link = el("a", "linkbtn", "Manage it in My listings");
    link.href = "my-listings.html";
    own.appendChild(link);
    info.appendChild(own);
  } else {
    const contact = el("div", "contact");
    const btn = el("button", "btn btn-brand btn-block", p.status === "SOLD" ? "This item is sold" : "Message seller");
    btn.type = "button";
    btn.disabled = p.status === "SOLD";
    btn.addEventListener("click", openMessage);
    contact.appendChild(btn);
    contact.appendChild(el("p", "hint", "Chat inside CampusKart. Your phone number and email are never shown."));
    info.appendChild(contact);
  }

  grid.appendChild(info);
  box.replaceChildren(grid);
}

(async function init() {
  const id = new URLSearchParams(location.search).get("id");
  if (!/^\d+$/.test(id || "")) {
    fail("This item link is not valid.");
    return;
  }
  try {
    render(await apiGet("/api/products/" + id));
  } catch (err) {
    fail(err.status === 404 ? "This item was not found. It may have been removed." : err.message);
  }
})();
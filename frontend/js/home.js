const CATEGORIES = {
  BOOKS: { label: "Books", bg: "#ffe4d6", fg: "#c2410c" },
  CALCULATORS: { label: "Calculators", bg: "#e0e7ff", fg: "#4338ca" },
  LAB_GEAR: { label: "Lab gear", bg: "#ccfbf1", fg: "#0f766e" },
  HOSTEL: { label: "Hostel", bg: "#fce7f3", fg: "#be185d" },
  ELECTRONICS: { label: "Electronics", bg: "#ede9fe", fg: "#6d28d9" },
  OTHER: { label: "Other", bg: "#f3f4f6", fg: "#4b5563" },
};
const CONDITIONS = { NEW: "New", LIKE_NEW: "Like new", GOOD: "Good", FAIR: "Fair" };
const STATUS_LABEL = { AVAILABLE: "Available", RESERVED: "Reserved", SOLD: "Sold" };

const state = { search: "", category: "", page: 1, size: 12, shown: 0 };

const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");
const loadMoreBtn = document.getElementById("loadMore");
const chipsEl = document.getElementById("chips");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent = XSS safe
  return node;
}

function timeAgo(iso) {
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function showStatus(text, isError) {
  statusEl.hidden = !text;
  statusEl.textContent = text || "";
  statusEl.className = "msg" + (isError ? " error" : "");
}

function buildCard(p) {
  const cat = CATEGORIES[p.category] || CATEGORIES.OTHER;
  const card = el("article", "card");

  const pic = el("div", "pic");
  pic.style.background = cat.bg;
  pic.style.color = cat.fg;
  pic.appendChild(svgIcon(p.category, 54));
  pic.appendChild(el("span", "cond", CONDITIONS[p.itemCondition] || p.itemCondition));
  card.appendChild(pic);

  const body = el("div", "body");
  body.appendChild(el("div", "title", p.title));

  const row = el("div", "row");
  row.appendChild(el("span", "price", "₹" + Number(p.price).toLocaleString("en-IN")));
  row.appendChild(el("span", "status " + p.status, STATUS_LABEL[p.status] || p.status));
  body.appendChild(row);

  body.appendChild(el("div", "meta", p.sellerName + " · " + timeAgo(p.createdAt)));
  card.appendChild(body);
  return card;
}

async function loadProducts(reset) {
  if (reset) {
    state.page = 1;
    state.shown = 0;
    gridEl.replaceChildren();
  }
  loadMoreBtn.hidden = true;
  showStatus("Loading...");

  const params = new URLSearchParams({ page: state.page, size: state.size });
  if (state.search) params.set("search", state.search);
  if (state.category) params.set("category", state.category);

  try {
    const data = await apiGet("/api/products?" + params.toString());
    data.items.forEach((p) => gridEl.appendChild(buildCard(p)));
    state.shown += data.items.length;

    if (state.shown === 0) {
      showStatus("No items found. Try a different search or category.");
    } else {
      showStatus("");
    }
    loadMoreBtn.hidden = state.shown >= data.total;
  } catch (err) {
    showStatus("Could not load items. Is the backend running? (" + err.message + ")", true);
  }
}

function renderChips() {
  chipsEl.replaceChildren();
  const entries = [["", { label: "All" }], ...Object.entries(CATEGORIES)];
  entries.forEach(([key, c]) => {
    const btn = el("button", "chip" + (state.category === key ? " active" : ""));
    btn.type = "button";
    btn.appendChild(svgIcon(key || "all", 16));
    btn.appendChild(document.createTextNode(" " + c.label));
    btn.addEventListener("click", () => {
      state.category = key;
      renderChips();
      loadProducts(true);
    });
    chipsEl.appendChild(btn);
  });
}

function renderHeroArt() {
  const a = document.getElementById("heroPicA");
  const b = document.getElementById("heroPicB");
  if (a) { a.style.color = CATEGORIES.CALCULATORS.fg; a.appendChild(svgIcon("CALCULATORS", 52)); }
  if (b) { b.style.color = CATEGORIES.BOOKS.fg; b.appendChild(svgIcon("BOOKS", 52)); }
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  state.search = searchInput.value.trim();
  loadProducts(true);
});

loadMoreBtn.addEventListener("click", () => {
  state.page += 1;
  loadProducts(false);
});

renderHeroArt();
renderChips();
loadProducts(true);
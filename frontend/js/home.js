const state = { search: "", category: "", page: 1, size: 12, shown: 0 };

const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");
const loadMoreBtn = document.getElementById("loadMore");
const chipsEl = document.getElementById("chips");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

function showStatus(text, isError) {
  statusEl.hidden = !text;
  statusEl.textContent = text || "";
  statusEl.className = "msg" + (isError ? " error" : "");
}

function buildCard(p) {
  const cat = CATEGORIES[p.category] || CATEGORIES.OTHER;
  const card = el("a", "card");
  card.href = "product.html?id=" + p.id;

  const pic = el("div", "pic");
  pic.style.background = cat.bg;
  pic.style.color = cat.fg;
  pic.appendChild(svgIcon(p.category, 54)); // photo na ho ya load na ho toh yahi icon dikhega

  if (p.images && p.images.length) {
    const img = document.createElement("img");
    img.src = imageUrl(p.images[0]);
    img.alt = p.title;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    pic.appendChild(img);
  }
  pic.appendChild(el("span", "cond", CONDITIONS[p.itemCondition] || p.itemCondition));
  card.appendChild(pic);

  const body = el("div", "body");
  body.appendChild(el("div", "title", p.title));

  const row = el("div", "row");
  row.appendChild(el("span", "price", formatPrice(p.price)));
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
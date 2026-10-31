requireLogin(); // login nahi hai toh login.html?next=my-listings.html pe bhej deta hai

if (getToken()) {
  const listEl = document.getElementById("list");
  const msgEl = document.getElementById("msg");
  const loadingEl = document.getElementById("loading");
  const emptyEl = document.getElementById("empty");
  const moreBtn = document.getElementById("loadMore");
  const dlg = document.getElementById("editDialog");
  const editForm = document.getElementById("editForm");
  const editMsg = document.getElementById("editMsg");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  const state = { page: 1, size: 10, shown: 0 };
  const items = new Map(); // id -> product data
  const rows = new Map(); // id -> row element
  let editingId = null;

  function goLogin() {
    location.href = "login.html?next=my-listings.html"; // token expire ho gaya
  }

  function showMsg(text, type) {
    msgEl.textContent = text;
    msgEl.className = "form-msg " + type;
    msgEl.hidden = false;
  }

  function buildRow(p) {
    const cat = CATEGORIES[p.category] || CATEGORIES.OTHER;
    const row = el("article", "item");

    const pic = el("a", "item-pic");
    pic.href = "product.html?id=" + p.id;
    pic.style.background = cat.bg;
    pic.style.color = cat.fg;
    pic.appendChild(svgIcon(p.category, 30));
    if (p.images.length) {
      const img = document.createElement("img");
      img.src = imageUrl(p.images[0]);
      img.alt = p.title;
      img.loading = "lazy";
      img.addEventListener("error", () => img.remove());
      pic.appendChild(img);
    }
    row.appendChild(pic);

    const info = el("div", "item-info");
    const title = el("a", "item-title", p.title);
    title.href = "product.html?id=" + p.id;
    info.appendChild(title);
    info.appendChild(el("div", "item-price", formatPrice(p.price)));
    info.appendChild(
      el("div", "item-meta", cat.label + " · " + (CONDITIONS[p.itemCondition] || p.itemCondition) + " · " + timeAgo(p.createdAt))
    );
    row.appendChild(info);

    const actions = el("div", "item-actions");

    const select = el("select", "status-select " + p.status);
    select.setAttribute("aria-label", "Item status");
    ["AVAILABLE", "RESERVED", "SOLD"].forEach((s) => {
      const opt = el("option", "", STATUS_LABEL[s]);
      opt.value = s;
      if (s === p.status) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => changeStatus(p.id, select));
    actions.appendChild(select);

    const edit = el("button", "btn btn-ghost btn-sm", "Edit");
    edit.type = "button";
    if (p.status === "SOLD") {
      edit.disabled = true;
      edit.title = "Sold items cannot be edited";
    }
    edit.addEventListener("click", () => openEdit(p.id));
    actions.appendChild(edit);

    const del = el("button", "btn btn-danger btn-sm", "Delete");
    del.type = "button";
    del.addEventListener("click", () => removeItem(p.id));
    actions.appendChild(del);

    row.appendChild(actions);
    return row;
  }

  function putItem(p) {
    items.set(p.id, p);
    const fresh = buildRow(p);
    const old = rows.get(p.id);
    if (old) old.replaceWith(fresh);
    else listEl.appendChild(fresh);
    rows.set(p.id, fresh);
  }

  async function changeStatus(id, select) {
    const previous = items.get(id).status;
    select.disabled = true;
    try {
      const updated = await apiPatch("/api/products/" + id + "/status", { status: select.value });
      putItem(updated);
      showMsg("Status changed to " + STATUS_LABEL[updated.status] + ".", "success");
    } catch (err) {
      if (err.status === 401) return goLogin();
      select.value = previous;
      select.disabled = false;
      showMsg(err.message, "error");
    }
  }

  async function removeItem(id) {
    const p = items.get(id);
    if (!confirm('Delete "' + p.title + '"? This cannot be undone.')) return;
    try {
      await apiDelete("/api/products/" + id);
      rows.get(id).remove();
      rows.delete(id);
      items.delete(id);
      state.shown = Math.max(0, state.shown - 1);
      emptyEl.hidden = items.size > 0;
      showMsg("Item deleted.", "success");
    } catch (err) {
      if (err.status === 401) return goLogin();
      showMsg(err.message, "error");
    }
  }

  function openEdit(id) {
    const p = items.get(id);
    editingId = id;
    document.getElementById("eTitle").value = p.title;
    document.getElementById("eCategory").value = p.category;
    document.getElementById("eCondition").value = p.itemCondition;
    document.getElementById("ePrice").value = p.price;
    document.getElementById("eDesc").value = p.description;
    editMsg.hidden = true;
    dlg.showModal();
  }

  function editError(text) {
    editMsg.textContent = text;
    editMsg.hidden = false;
  }

  cancelBtn.addEventListener("click", () => dlg.close());

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    editMsg.hidden = true;

    const title = document.getElementById("eTitle").value.trim();
    const category = document.getElementById("eCategory").value;
    const itemCondition = document.getElementById("eCondition").value;
    const price = document.getElementById("ePrice").value.trim();
    const description = document.getElementById("eDesc").value.trim();

    // Quick feedback ke liye, asli validation backend karta hai
    if (title.length < 3) return editError("Title must be at least 3 characters.");
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return editError("Enter a valid price (for example 650 or 199.50).");
    if (Number(price) <= 0 || Number(price) > 100000) return editError("Price must be between 1 and 1,00,000.");
    if (description.length < 10) return editError("Description must be at least 10 characters.");

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    try {
      const updated = await apiPatch("/api/products/" + editingId, {
        title,
        description,
        category,
        price,
        itemCondition,
      });
      putItem(updated);
      dlg.close();
      showMsg("Item updated.", "success");
    } catch (err) {
      if (err.status === 401) return goLogin();
      editError(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save changes";
    }
  });

  async function load() {
    moreBtn.hidden = true;
    try {
      const data = await apiGet(
        "/api/products/mine?page=" + state.page + "&size=" + state.size,
        true
      );
      loadingEl.hidden = true;
      data.items.forEach(putItem);
      state.shown += data.items.length;
      emptyEl.hidden = items.size > 0;
      moreBtn.hidden = state.shown >= data.total;
    } catch (err) {
      if (err.status === 401) return goLogin();
      loadingEl.hidden = true;
      showMsg(err.message, "error");
    }
  }

  moreBtn.addEventListener("click", () => {
    state.page += 1;
    load();
  });

  load();
}
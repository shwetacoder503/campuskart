requireLogin(); // login nahi hai toh login.html?next=sell.html pe bhej deta hai

if (getToken()) {
  const MAX_FILES = 5;
  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const form = document.getElementById("sellForm");
  const msg = document.getElementById("msg");
  const btn = document.getElementById("submitBtn");
  const desc = document.getElementById("description");
  const counter = document.getElementById("counter");
  const fileInput = document.getElementById("photoInput");
  const addBtn = document.getElementById("addPhotos");
  const previews = document.getElementById("previews");

  let picked = []; // { file, url }
  let createdProductId = null; // item save ho gaya par photos fail hui toh retry ke liye

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = "form-msg " + type;
    msg.hidden = false;
    msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderPreviews() {
    previews.replaceChildren();
    const locked = createdProductId !== null;

    picked.forEach((item, index) => {
      const box = document.createElement("div");
      box.className = "thumb";

      const img = document.createElement("img");
      img.src = item.url;
      img.alt = "Selected photo " + (index + 1);
      box.appendChild(img);

      if (index === 0) {
        const cover = document.createElement("span");
        cover.className = "cover";
        cover.textContent = "Cover";
        box.appendChild(cover);
      }

      if (!locked) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "rm";
        rm.textContent = "×";
        rm.setAttribute("aria-label", "Remove photo " + (index + 1));
        rm.addEventListener("click", () => {
          URL.revokeObjectURL(item.url);
          picked.splice(index, 1);
          renderPreviews();
        });
        box.appendChild(rm);
      }
      previews.appendChild(box);
    });

    addBtn.hidden = locked || picked.length >= MAX_FILES;
  }

  function lockFields() {
    ["title", "category", "itemCondition", "price", "description"].forEach((id) => {
      document.getElementById(id).disabled = true;
    });
  }

  addBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const problems = [];
    for (const file of fileInput.files) {
      if (picked.length >= MAX_FILES) {
        problems.push("You can add up to " + MAX_FILES + " photos.");
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        problems.push(file.name + " is not a JPEG, PNG or WebP image.");
        continue;
      }
      if (file.size > MAX_BYTES) {
        problems.push(file.name + " is larger than 5 MB.");
        continue;
      }
      picked.push({ file, url: URL.createObjectURL(file) });
    }
    fileInput.value = ""; // same file dobara choose ho sake
    renderPreviews();
    if (problems.length) showMsg(problems.join(" "), "error");
    else msg.hidden = true;
  });

  desc.addEventListener("input", () => {
    counter.textContent = desc.value.length;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.hidden = true;

    const title = document.getElementById("title").value.trim();
    const category = document.getElementById("category").value;
    const itemCondition = document.getElementById("itemCondition").value;
    const price = document.getElementById("price").value.trim();
    const description = desc.value.trim();

    // Yeh sirf quick feedback ke liye hai, asli validation backend karta hai
    if (picked.length < 1) return showMsg("Please add at least one photo.", "error");
    if (title.length < 3) return showMsg("Title must be at least 3 characters.", "error");
    if (!category) return showMsg("Please choose a category.", "error");
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return showMsg("Enter a valid price (for example 650 or 199.50).", "error");
    if (Number(price) <= 0 || Number(price) > 100000) return showMsg("Price must be between 1 and 1,00,000.", "error");
    if (description.length < 10) return showMsg("Description must be at least 10 characters.", "error");

    btn.disabled = true;
    btn.textContent = "Posting...";
    try {
      // Step 1: item banao (sellerId kabhi nahi bhejte, backend token se nikalta hai)
      if (createdProductId === null) {
        const product = await apiPost(
          "/api/products",
          { title, description, category, price, itemCondition },
          true
        );
        createdProductId = product.id;
        lockFields();
        renderPreviews();
      }

      // Step 2: photos upload karo
      const data = new FormData();
      picked.forEach((item) => data.append("files", item.file));
      await apiUpload("/api/products/" + createdProductId + "/images", data);

      showMsg("Item posted! Taking you to the home page...", "success");
      setTimeout(() => (location.href = "index.html"), 1500);
    } catch (err) {
      if (err.status === 401) {
        location.href = "login.html?next=sell.html"; // token expire ho gaya
        return;
      }
      if (createdProductId !== null) {
        showMsg(
          "Your item was saved, but the photos could not be uploaded: " +
            err.message +
            ". Press Post item to try the upload again.",
          "error"
        );
      } else {
        showMsg(err.message, "error");
      }
      btn.disabled = false;
      btn.textContent = "Post item";
    }
  });
}
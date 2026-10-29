requireLogin(); // login nahi hai toh login.html?next=sell.html pe bhej deta hai

if (getToken()) {
  const form = document.getElementById("sellForm");
  const msg = document.getElementById("msg");
  const btn = document.getElementById("submitBtn");
  const desc = document.getElementById("description");
  const counter = document.getElementById("counter");

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = "form-msg " + type;
    msg.hidden = false;
    msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

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

    // Yeh sirf jaldi feedback ke liye, asli validation backend karta hai
    if (title.length < 3) return showMsg("Title kam se kam 3 characters ka ho.", "error");
    if (!category) return showMsg("Category choose karo.", "error");
    if (!/^\d+(\.\d{1,2})?$/.test(price)) return showMsg("Price number me daalo (jaise 650 ya 199.50).", "error");
    if (Number(price) <= 0 || Number(price) > 100000) return showMsg("Price 1 se 1,00,000 ke beech ho.", "error");
    if (description.length < 10) return showMsg("Description kam se kam 10 characters ka ho.", "error");

    btn.disabled = true;
    btn.textContent = "Posting...";
    try {
      // sellerId kabhi nahi bhejte, backend token se nikalta hai
      await apiPost("/api/products", { title, description, category, price, itemCondition }, true);
      form.reset();
      counter.textContent = "0";
      showMsg("Item post ho gaya! Home page pe le ja rahe hain...", "success");
      setTimeout(() => (location.href = "index.html"), 1500);
    } catch (err) {
      if (err.status === 401) {
        location.href = "login.html?next=sell.html"; // token expire ho gaya
        return;
      }
      showMsg(err.message, "error");
      btn.disabled = false;
      btn.textContent = "Post item";
    }
  });
}
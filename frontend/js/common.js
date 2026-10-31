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

function formatPrice(value) {
  return "₹" + Number(value).toLocaleString("en-IN");
}
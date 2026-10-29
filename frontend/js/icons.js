// Sirf hamare apne fixed SVG hain (user ka data nahi), isliye innerHTML yahan safe hai
const ICON_PATHS = {
  all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  CALCULATORS:
    '<rect x="5" y="2" width="14" height="20" rx="2"/><rect x="8" y="5" width="8" height="4" rx="1"/>' +
    '<g fill="currentColor" stroke="none"><circle cx="9" cy="13" r="1"/><circle cx="12" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>' +
    '<circle cx="9" cy="16" r="1"/><circle cx="12" cy="16" r="1"/><circle cx="15" cy="16" r="1"/>' +
    '<circle cx="9" cy="19" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></g>',
  BOOKS: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/>',
  LAB_GEAR: '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
  HOSTEL: '<path d="M3 18V8"/><path d="M3 14h18v4"/><path d="M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>',
  ELECTRONICS: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  OTHER: '<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4"/><path d="M12 11v10"/>',
};

function svgIcon(name, size) {
  const span = document.createElement("span");
  span.className = "ico";
  span.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (ICON_PATHS[name] || ICON_PATHS.OTHER) + "</svg>";
  return span;
}
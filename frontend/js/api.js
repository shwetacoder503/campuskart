class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function parseError(data) {
  const d = data && data.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    return d.map((x) => (x.msg || "").replace(/^Value error, /, "")).join(". ");
  }
  return "Something went wrong";
}

// Backend se aaye image path ko poora URL banata hai
function imageUrl(path) {
  return API_BASE + path;
}

async function request(method, path, body, auth) {
  const headers = {};
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  // FormData ke saath Content-Type khud mat set karo, browser boundary ke saath lagata hai
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError("Cannot reach server. Is the backend running?", 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* body JSON nahi tha */
  }

  if (!res.ok) {
    if (res.status === 401 && auth) clearSession(); // token kharab ya expire
    throw new ApiError(parseError(data), res.status);
  }
  return data;
}

const apiGet = (path, auth = false) => request("GET", path, undefined, auth);
const apiPost = (path, body, auth = false) => request("POST", path, body, auth);
const apiUpload = (path, formData) => request("POST", path, formData, true);
const apiPatch = (path, body) => request("PATCH", path, body, true);
const apiDelete = (path) => request("DELETE", path, undefined, true);
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

async function request(method, path, body, auth) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
(function () {
  const API = window.__MAINT_API_BASE__ || "http://127.0.0.1:8000";
  const TOKEN_KEY = "maint_token";

  function token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function requireAuth() {
    if (!token()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  }

  async function api(path, options = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );
    const tok = token();
    if (tok) headers.Authorization = "Bearer " + tok;
    const res = await fetch(API + path, Object.assign({}, options, { headers }));
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = (data && data.detail) || res.statusText || "Request failed";
      const err = new Error(
        Array.isArray(msg) ? msg.map((m) => m.msg).join("; ") : String(msg)
      );
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.Maint = {
    API,
    token,
    setToken,
    clearToken,
    requireAuth,
    api,
  };
})();

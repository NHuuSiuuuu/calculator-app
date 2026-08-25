function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").replace(/\/+$/, "");
}

export function createSupportApi({
  baseUrl = "",
  getAccessToken,
  fetchImpl = globalThis.fetch,
}) {
  const root = normalizeBaseUrl(baseUrl);

  async function request(path, options = {}) {
    const token = getAccessToken();
    const authHeaders = token ? { authorization: `Bearer ${token}` } : {};
    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
        ...authHeaders,
        ...(options.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload.error ? `: ${payload.error}` : "";
      throw new Error(`${path} failed with ${response.status}${detail}`);
    }
    return payload;
  }

  return {
    getCurrentUser() {
      return request("/api/me");
    },
    sendMessage({ conversationId, message }) {
      return request("/api/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId, message }),
      });
    },
    listConversations() {
      return request("/api/conversations");
    },
    listMessages(conversationId) {
      return request(`/api/conversations/${conversationId}/messages`);
    },
    listDocuments() {
      return request("/api/documents");
    },
    uploadDocument(file) {
      const formData = new FormData();
      formData.set("file", file);
      return request("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
    },
  };
}

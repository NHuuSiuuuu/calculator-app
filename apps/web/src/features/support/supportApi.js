function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").replace(/\/+$/, "");
}

export function createSupportApi({
  baseUrl = import.meta.env.VITE_SUPPORT_API_URL,
  getAccessToken,
  fetchImpl = globalThis.fetch,
}) {
  const root = normalizeBaseUrl(baseUrl);

  async function request(path, options = {}) {
    const token = getAccessToken();
    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
        authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? `Request failed with ${response.status}`);
    }
    return payload;
  }

  return {
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

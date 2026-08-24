import { useEffect, useMemo, useState } from "react";

import { createSupportApi } from "./supportApi.js";

function responseItems(payload, key) {
  return Array.isArray(payload?.[key]) ? payload[key] : [];
}

function messageId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AiSupportPanel({ session, supportApi }) {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const api = useMemo(() => supportApi ?? createSupportApi({
    getAccessToken: () => session?.accessToken ?? "",
  }), [session, supportApi]);

  useEffect(() => {
    if (!session) {
      setConversations([]);
      setMessages([]);
      setDocuments([]);
      setSelectedConversationId(null);
      return undefined;
    }

    let isCurrent = true;
    async function loadSupportData() {
      try {
        const conversationsPayload = await api.listConversations();
        if (isCurrent) setConversations(responseItems(conversationsPayload, "conversations"));
      } catch (nextError) {
        if (isCurrent) setError(nextError.message);
      }

      try {
        const documentsPayload = await api.listDocuments();
        if (isCurrent) setDocuments(responseItems(documentsPayload, "documents"));
      } catch (nextError) {
        if (isCurrent) setError(nextError.message);
      }
    }

    loadSupportData();
    return () => {
      isCurrent = false;
    };
  }, [api, session]);

  async function selectConversation(conversationId) {
    setSelectedConversationId(conversationId);
    setError("");
    setStatusMessage("Loading conversation...");
    try {
      const payload = await api.listMessages(conversationId);
      setMessages(responseItems(payload, "messages"));
      setStatusMessage("");
    } catch (nextError) {
      setError(nextError.message);
      setStatusMessage("");
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || isSending) return;

    setError("");
    setStatusMessage("Sending message...");
    setIsSending(true);
    setInput("");
    setMessages((current) => [...current, { id: messageId("user"), role: "user", content: message }]);

    try {
      const result = await api.sendMessage({
        conversationId: selectedConversationId ?? undefined,
        message,
      });
      setSelectedConversationId(result.conversationId);
      setMessages((current) => [...current, {
        id: messageId("assistant"),
        role: "assistant",
        content: result.answer,
        sources: result.sources ?? [],
      }]);
      const conversationsPayload = await api.listConversations();
      setConversations(responseItems(conversationsPayload, "conversations"));
      setStatusMessage("");
    } catch (nextError) {
      setError(nextError.message);
      setStatusMessage("");
    } finally {
      setIsSending(false);
    }
  }

  async function uploadDocument(event) {
    const [file] = event.target.files;
    if (!file) return;

    setError("");
    setStatusMessage("Uploading document...");
    setIsUploading(true);
    try {
      await api.uploadDocument(file);
      const documentsPayload = await api.listDocuments();
      setDocuments(responseItems(documentsPayload, "documents"));
      setStatusMessage("Document uploaded.");
    } catch (nextError) {
      setError(nextError.message);
      setStatusMessage("");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  if (!session) {
    return (
      <div className="support-empty-state">
        <h1>AI Support</h1>
        <p>Hỏi theo tài liệu công ty</p>
        <p>Đăng nhập để dùng AI Support.</p>
      </div>
    );
  }

  return (
    <div className="support-tool">
      <header className="support-header">
        <div>
          <p className="eyebrow">Company knowledge</p>
          <h1>AI Support</h1>
          <p>Hỏi theo tài liệu công ty</p>
        </div>
        <span className="status-pill">{isSending ? "Working" : "Ready"}</span>
      </header>

      {error ? <p className="support-message-status is-error" role="alert">{error}</p> : null}
      {statusMessage ? <p className="support-message-status" aria-live="polite">{statusMessage}</p> : null}

      <div className="support-layout">
        <aside className="support-sidebar" aria-label="Conversations">
          <h2>Cuộc trò chuyện</h2>
          <div className="support-conversations">
            {conversations.length === 0 ? <p className="support-empty">No conversations yet.</p> : null}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`support-conversation${selectedConversationId === conversation.id ? " is-selected" : ""}`}
                type="button"
                onClick={() => selectConversation(conversation.id)}
              >
                {conversation.title || "Untitled conversation"}
              </button>
            ))}
          </div>
        </aside>

        <div className="support-main">
          <section className="support-chat" aria-label="Support chat">
            <div className="support-messages" aria-live="polite">
              {messages.length === 0 ? <p className="support-empty">Ask a question about company documents.</p> : null}
              {messages.map((message) => (
                <article key={message.id} className={`support-message${message.role === "user" ? " is-user" : ""}`}>
                  <p>{message.content}</p>
                  {message.sources?.length ? (
                    <div className="support-sources">
                      <strong>Nguồn:</strong>
                      {message.sources.map((source) => (
                        <span key={source.chunkId} className="support-source-chip">{source.filename}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <form className="support-compose" onSubmit={submitMessage}>
              <label className="sr-only" htmlFor="support-message">Support question</label>
              <input
                id="support-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about company documents"
                disabled={isSending}
              />
              <button type="submit" disabled={isSending || !input.trim()}>Send</button>
            </form>
          </section>

          <section className="support-admin" aria-label="Company documents">
            <div className="support-admin__header">
              <h2>Tài liệu công ty</h2>
              <label className="support-upload">
                <span>Upload .txt hoặc .md</span>
                <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={uploadDocument} disabled={isUploading} />
              </label>
            </div>
            <ul className="support-documents">
              {documents.length === 0 ? <li className="support-empty">No documents available.</li> : null}
              {documents.map((document) => <li key={document.id}>{document.filename}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

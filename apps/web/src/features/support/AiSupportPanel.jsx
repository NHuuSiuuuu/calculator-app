import { useEffect, useMemo, useRef, useState } from "react";

import { createLatestRequestGuard } from "./latestRequestGuard.js";
import { createSupportApi } from "./supportApi.js";

function responseItems(payload, key) {
  return Array.isArray(payload?.[key]) ? payload[key] : [];
}

const SUPPORT_THEME_STORAGE_KEY = "support-theme";
const SCROLL_BOTTOM_THRESHOLD = 96;

function readStoredSupportTheme() {
  const storedTheme = window.localStorage.getItem(SUPPORT_THEME_STORAGE_KEY);
  return storedTheme === "light" ? "light" : "dark";
}

function messageId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDocumentTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown upload time";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function renderInlineMarkdown(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-strong-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function MessageContent({ content }) {
  const blocks = [];
  let bulletItems = [];

  function flushBullets() {
    if (bulletItems.length === 0) return;
    const listIndex = blocks.length;
    blocks.push(
      <ul key={`list-${listIndex}`}>
        {bulletItems.map((item, itemIndex) => (
          <li key={`list-${listIndex}-item-${itemIndex}`}>
            {renderInlineMarkdown(item, `list-${listIndex}-item-${itemIndex}`)}
          </li>
        ))}
      </ul>,
    );
    bulletItems = [];
  }

  String(content ?? "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      bulletItems.push(bulletMatch[1]);
      return;
    }

    flushBullets();
    const paragraphIndex = blocks.length;
    blocks.push(
      <p key={`paragraph-${paragraphIndex}`}>
        {renderInlineMarkdown(trimmed, `paragraph-${paragraphIndex}`)}
      </p>,
    );
  });
  flushBullets();

  return <div className="support-message-content">{blocks}</div>;
}

export function AiSupportPanel({ session, supportApi }) {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [documents, setDocuments] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [theme, setTheme] = useState(readStoredSupportTheme);
  const [isScrollToBottomVisible, setIsScrollToBottomVisible] = useState(false);
  const messagesRef = useRef(null);
  const hasSession = Boolean(session?.accessToken);
  const conversationRequestGuard = useRef(null);
  if (!conversationRequestGuard.current) {
    conversationRequestGuard.current = createLatestRequestGuard();
  }
  const api = useMemo(() => supportApi ?? createSupportApi({
    getAccessToken: () => session?.accessToken ?? "",
  }), [session, supportApi]);

  useEffect(() => {
    window.localStorage.setItem(SUPPORT_THEME_STORAGE_KEY, theme);
  }, [theme]);

  function updateScrollToBottomVisibility() {
    const messagesElement = messagesRef.current;
    if (!messagesElement) {
      setIsScrollToBottomVisible(false);
      return;
    }

    const distanceFromBottom = messagesElement.scrollHeight
      - messagesElement.scrollTop
      - messagesElement.clientHeight;
    setIsScrollToBottomVisible(distanceFromBottom > SCROLL_BOTTOM_THRESHOLD);
  }

  function scrollMessagesToBottom(behavior = "auto") {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;

    messagesElement.scrollTo({ top: messagesElement.scrollHeight, behavior });
    setIsScrollToBottomVisible(false);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(scrollMessagesToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, selectedConversationId]);

  useEffect(() => {
    let isCurrent = true;
    async function loadSupportData() {
      if (!hasSession) {
        conversationRequestGuard.current.begin();
        setConversations([]);
        setMessages([]);
        setDocuments([]);
        setIsAdmin(false);
        setSelectedConversationId(null);
        setError("");
        setStatusMessage("");
        return;
      }

      try {
        const conversationsPayload = await api.listConversations();
        if (isCurrent) setConversations(responseItems(conversationsPayload, "conversations"));
      } catch (nextError) {
        if (isCurrent) setError(nextError.message);
      }

      try {
        const currentUserPayload = await api.getCurrentUser();
        if (!isCurrent) return;
        const nextIsAdmin = currentUserPayload?.user?.role === "admin";
        setIsAdmin(nextIsAdmin);
        if (nextIsAdmin) {
          const documentsPayload = await api.listDocuments();
          if (isCurrent) setDocuments(responseItems(documentsPayload, "documents"));
        }
      } catch (nextError) {
        if (isCurrent) setError(nextError.message);
      }
    }

    loadSupportData();
    return () => {
      isCurrent = false;
    };
  }, [api, hasSession]);

  async function selectConversation(conversationId) {
    const request = conversationRequestGuard.current.begin();
    setSelectedConversationId(conversationId);
    setError("");
    setStatusMessage("Loading conversation...");
    try {
      const payload = await api.listMessages(conversationId);
      if (!conversationRequestGuard.current.isCurrent(request)) return;
      setMessages(responseItems(payload, "messages"));
      setStatusMessage("");
    } catch (nextError) {
      if (!conversationRequestGuard.current.isCurrent(request)) return;
      setError(nextError.message);
      setStatusMessage("");
    }
  }

  function startNewChat() {
    conversationRequestGuard.current.begin();
    setSelectedConversationId(null);
    setMessages([]);
    setInput("");
    setError("");
    setStatusMessage("");
  }

  async function deleteConversation(conversation) {
    const title = conversation.title || "Untitled conversation";
    if (!window.confirm(`Xóa cuộc trò chuyện "${title}"?`)) return;

    conversationRequestGuard.current.begin();
    setError("");
    setStatusMessage("Deleting conversation...");
    setDeletingConversationId(conversation.id);
    try {
      await api.deleteConversation(conversation.id);
      setConversations((current) => current.filter((existing) => existing.id !== conversation.id));
      if (selectedConversationId === conversation.id) {
        setSelectedConversationId(null);
        setMessages([]);
      }
      setStatusMessage("");
    } catch (nextError) {
      setError(nextError.message);
      setStatusMessage("");
    } finally {
      setDeletingConversationId(null);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const message = input.trim();
    if (!hasSession || !message || isSending) return;

    setError("");
    setStatusMessage("Sending message...");
    setIsSending(true);
    setInput("");
    const optimisticMessage = { id: messageId("user"), role: "user", content: message };
    const pendingMessage = { id: messageId("assistant-loading"), role: "assistant", isLoading: true };
    setMessages((current) => [...current, optimisticMessage, pendingMessage]);

    try {
      const result = await api.sendMessage({
        conversationId: selectedConversationId ?? undefined,
        message,
      });
      setSelectedConversationId(result.conversationId);
      const assistantMessage = {
        id: messageId("assistant"),
        role: "assistant",
        content: result.answer,
        sources: result.sources ?? [],
      };
      setMessages((current) => current.map((existing) => (
        existing.id === pendingMessage.id ? assistantMessage : existing
      )));
    } catch (nextError) {
      setMessages((current) => current.filter((existing) => (
        existing.id !== optimisticMessage.id && existing.id !== pendingMessage.id
      )));
      setError(nextError.message);
      setStatusMessage("");
      setIsSending(false);
      return;
    }

    try {
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

  async function deleteDocument(document) {
    const filename = document.filename || "Untitled document";
    if (!window.confirm(`Xóa tài liệu "${filename}"?`)) return;

    setError("");
    setStatusMessage("Deleting document...");
    setDeletingDocumentId(document.id);
    try {
      await api.deleteDocument(document.id);
      setDocuments((current) => current.filter((existing) => existing.id !== document.id));
      setStatusMessage("");
    } catch (nextError) {
      setError(nextError.message);
      setStatusMessage("");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  return (
    <div className={`support-chat-shell is-${theme}`}>
      <aside className="support-sidebar" aria-label="Conversations">
        <div className="support-sidebar-section">
          <div className="support-sidebar-header">
            <div>
              <p className="eyebrow">AHV</p>
              <h1>AI Support</h1>
            </div>
            <div className="support-sidebar-actions">
              <button
                className="support-theme-toggle"
                type="button"
                aria-label="Toggle support theme"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              >
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              <span className="status-pill">{hasSession ? (isSending ? "Working" : "Ready") : "Sign in"}</span>
            </div>
          </div>
        </div>

        <div className="support-sidebar-section">
          <button className="support-new-chat" type="button" onClick={startNewChat}>
            Tạo chat mới
          </button>
          <h2>Cuộc trò chuyện</h2>
          <div className="support-conversations">
            {conversations.length === 0 ? <p className="support-empty">No conversations yet.</p> : null}
            {conversations.map((conversation) => {
              const title = conversation.title || "Untitled conversation";
              return (
                <div
                  key={conversation.id}
                  className={`support-conversation-row${selectedConversationId === conversation.id ? " is-selected" : ""}`}
                >
                  <button
                    className="support-conversation"
                    type="button"
                    aria-label={title}
                    onClick={() => selectConversation(conversation.id)}
                    disabled={deletingConversationId === conversation.id}
                  >
                    <span className="support-conversation-title" aria-hidden="true">
                      <span className="support-conversation-title-track">
                        <span className="support-conversation-title-text">{title}</span>
                        <span className="support-conversation-title-text" aria-hidden="true">{title}</span>
                      </span>
                    </span>
                  </button>
                  <button
                    className="support-conversation-delete"
                    type="button"
                    aria-label="Xóa cuộc trò chuyện"
                    onClick={() => deleteConversation(conversation)}
                    disabled={deletingConversationId === conversation.id}
                  >
                    Xóa
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin ? <section className="support-sidebar-section support-sidebar-section--documents" aria-label="Company documents">
          <div className="support-admin__header">
            <h2>Tài liệu công ty</h2>
            <label className="support-upload">
              <span>Upload .txt hoặc .md</span>
              <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={uploadDocument} disabled={isUploading} />
            </label>
          </div>
          <ul className="support-documents">
            {documents.length === 0 ? <li className="support-empty">No documents available.</li> : null}
            {documents.map((document) => (
              <li key={document.id} className="support-document">
                <div className="support-document__header">
                  <strong>{document.filename}</strong>
                  <button
                    className="support-document-delete"
                    type="button"
                    aria-label={`Xóa tài liệu ${document.filename}`}
                    onClick={() => deleteDocument(document)}
                    disabled={deletingDocumentId === document.id}
                  >
                    Xóa
                  </button>
                </div>
                <div className="support-document__metadata">
                  <span className={`support-document__status is-${document.status}`}>{document.status}</span>
                  <span>{document.chunk_count} chunks</span>
                  <time dateTime={document.created_at}>{formatDocumentTime(document.created_at)}</time>
                </div>
                {document.error_message ? <p className="support-document__error">{document.error_message}</p> : null}
              </li>
            ))}
          </ul>
        </section> : null}
      </aside>

      <main className="support-chat-stage">
        <section className="support-chat-panel" aria-label="Support chat">
          <header className="support-chat-header">
            <div>
              <h2>Hỏi theo tài liệu công ty</h2>
              <p>{selectedConversationId ? "Conversation context loaded" : "New conversation"}</p>
            </div>
          </header>

          <div className="support-notices">
            {error ? <p className="support-message-status is-error" role="alert">{error}</p> : null}
            {statusMessage ? <p className="support-message-status" aria-live="polite">{statusMessage}</p> : null}
          </div>

          <div
            className="support-messages"
            ref={messagesRef}
            aria-live="polite"
            onScroll={updateScrollToBottomVisibility}
          >
            {messages.length === 0 ? (
              <div className="support-empty-state">
                <h1>{hasSession ? "Khi bạn sẵn sàng là chúng ta có thể bắt đầu." : "Đăng nhập để hỏi AI Support."}</h1>
              </div>
            ) : null}
            {messages.map((message) => (
              <article key={message.id} className={`support-message${message.role === "user" ? " is-user" : ""}`}>
                {message.isLoading ? (
                  <div className="support-typing" aria-label="AI đang trả lời">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : <MessageContent content={message.content} />}
              </article>
            ))}
          </div>

          {isScrollToBottomVisible ? (
            <button
              className="support-scroll-bottom"
              type="button"
              aria-label="Cuộn xuống cuối cuộc trò chuyện"
              onClick={() => scrollMessagesToBottom("smooth")}
            >
              <span aria-hidden="true">↓</span>
            </button>
          ) : null}

          <form className="support-compose" onSubmit={submitMessage} autoComplete="off">
            <label className="sr-only" htmlFor="support-message">Câu hỏi</label>
            <input
              id="support-message"
              name="support-chat-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={hasSession ? "Ask about documents" : "Đăng nhập để hỏi AI Support"}
              maxLength={4000}
              disabled={!hasSession || isSending}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <button type="submit" disabled={!hasSession || isSending || !input.trim()}>Gửi</button>
          </form>
        </section>
      </main>
    </div>
  );
}

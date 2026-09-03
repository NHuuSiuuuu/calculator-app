import { useEffect, useState } from "react";

export function AuthPanel({ authApi, session, onSessionChange, initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("error");
  const [isLoading, setIsLoading] = useState(false);

  function selectMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setMessageTone("error");
  }

  useEffect(() => {
    if (!session) {
      selectMode(initialMode);
    }
  }, [initialMode, session]);

  function validateCredentials(actionLabel) {
    if (!email.trim()) {
      return `Nhập email trước khi ${actionLabel}.`;
    }

    if (password.length < 6) {
      return `Nhập mật khẩu ít nhất 6 ký tự trước khi ${actionLabel}.`;
    }

    return "";
  }

  async function runAuth(action, options = {}) {
    setMessage("");
    setMessageTone("error");
    setIsLoading(true);

    try {
      const nextSession = await action();
      onSessionChange(nextSession);
      setPassword("");
      if (!nextSession && options.successMessage) {
        setMessage(options.successMessage);
        setMessageTone("success");
      }
    } catch (error) {
      setMessage(error.message);
      setMessageTone("error");
    } finally {
      setIsLoading(false);
    }
  }

  if (!authApi) {
    return (
      <section className="auth-panel" aria-label="Supabase setup">
        <p className="todo-message is-error">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Todo sign in.</p>
      </section>
    );
  }

  if (session) {
    return (
      <section className="auth-panel" aria-label="Account">
        <p>
          Đang đăng nhập bằng <strong>{session.user.email}</strong>
        </p>
        <button type="button" className="todo-action" disabled={isLoading} onClick={() => runAuth(async () => {
          await authApi.signOut();
          return null;
        })}>
          Đăng xuất
        </button>
        {message ? <p className="todo-message is-error" role="alert">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-label="Sign in">
      <p>Đăng nhập để quản lý Todo.</p>
      <div className="auth-mode-tabs" role="tablist" aria-label="Chọn chế độ tài khoản">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={mode === "signin" ? "auth-mode-tab is-active" : "auth-mode-tab"}
          onClick={() => selectMode("signin")}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "auth-mode-tab is-active" : "auth-mode-tab"}
          onClick={() => selectMode("signup")}
        >
          Đăng ký
        </button>
      </div>
      <div className="auth-grid">
        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          className="todo-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          className="todo-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="auth-actions">
        {mode === "signin" ? (
          <button type="button" className="todo-add" disabled={isLoading} onClick={() => {
            const validationError = validateCredentials("đăng nhập");
            if (validationError) {
              setMessage(validationError);
              setMessageTone("error");
              return;
            }

            runAuth(() => authApi.signIn(email.trim(), password));
          }}>
            Đăng nhập
          </button>
        ) : (
          <button
            type="button"
            className="todo-add"
            disabled={isLoading}
            onClick={() => {
              const validationError = validateCredentials("đăng ký");
              if (validationError) {
                setMessage(validationError);
                setMessageTone("error");
                return;
              }

              runAuth(
                () => authApi.signUp(email.trim(), password),
                { successMessage: "Đã tạo tài khoản. Hãy kiểm tra email để xác nhận, rồi đăng nhập." },
              );
            }}
          >
            Đăng ký
          </button>
        )}
      </div>
      {message ? (
        <p className={`todo-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
    </section>
  );
}

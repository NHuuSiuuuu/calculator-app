import { useState } from "react";

export function AuthPanel({ authApi, session, onSessionChange }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function runAuth(action) {
    setMessage("");
    setIsLoading(true);

    try {
      const nextSession = await action();
      onSessionChange(nextSession);
      setPassword("");
    } catch (error) {
      setMessage(error.message);
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
          Signed in as <strong>{session.user.email}</strong>
        </p>
        <button type="button" className="todo-action" disabled={isLoading} onClick={() => runAuth(async () => {
          await authApi.signOut();
          return null;
        })}>
          Sign out
        </button>
        {message ? <p className="todo-message is-error" role="alert">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-label="Sign in">
      <p>Sign in to manage your todos.</p>
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
        <button type="button" className="todo-add" disabled={isLoading} onClick={() => runAuth(() => authApi.signIn(email.trim(), password))}>
          Sign in
        </button>
        <button type="button" className="todo-action" disabled={isLoading} onClick={() => runAuth(() => authApi.signUp(email.trim(), password))}>
          Sign up
        </button>
      </div>
      {message ? <p className="todo-message is-error" role="alert">{message}</p> : null}
    </section>
  );
}

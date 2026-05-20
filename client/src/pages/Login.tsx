import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { FeatureCards } from "../components/FeatureCards";

export function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.login({
        username: String(form.get("username") || ""),
        password: String(form.get("password") || "")
      });
      setUser(result.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  return (
    <section className="auth-layout auth-with-info">
      <div className="panel auth-panel">
        <p className="eyebrow">Welcome back</p>
        <h1>Login</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="form-stack" onSubmit={submit}>
          <label>Username<input name="username" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">Login</button>
        </form>
        <p className="muted">Need access? <Link to="/register">Create an account</Link>.</p>
      </div>
      <FeatureCards
        title="Why Sign In?"
        subtitle="Authenticated access keeps stego operations tied to the right user and visible to admins."
        cards={[
          {
            meta: "Protected",
            title: "Private Workspace",
            text: "Your generated stego files and recent activity stay attached to your account."
          },
          {
            meta: "Recover",
            title: "Extract Later",
            text: "Upload a stego image later and recover hidden text or files when credentials match."
          },
          {
            meta: "Audit",
            title: "Traceable Activity",
            text: "Successful and failed extraction attempts are recorded for project monitoring."
          }
        ]}
      />
    </section>
  );
}

import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { FeatureCards } from "../components/FeatureCards";

export function Register() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.register({
        username: String(form.get("username") || ""),
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        confirmPassword: String(form.get("confirmPassword") || "")
      });
      setUser(result.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    }
  }

  return (
    <section className="auth-layout auth-with-info">
      <div className="panel auth-panel">
        <p className="eyebrow">Create secure access</p>
        <h1>Register</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form className="form-stack" onSubmit={submit}>
          <label>Username<input name="username" minLength={3} autoComplete="username" required /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <label>Confirm password<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button type="submit">Create Account</button>
        </form>
        <p className="muted">Already registered? <Link to="/login">Login</Link>.</p>
      </div>
      <FeatureCards
        title="What You Can Do"
        subtitle="A registered account unlocks the complete steganography workflow."
        cards={[
          {
            meta: "Embed",
            title: "Hide Text Or Files",
            text: "Choose a cover image, provide a message or secret file, and generate a stego output."
          },
          {
            meta: "Secure",
            title: "Add A Stego Password",
            text: "Use optional password protection so extraction fails unless the correct key is provided."
          },
          {
            meta: "Manage",
            title: "Admin Ready",
            text: "Administrator accounts can review logs and block or reactivate users."
          }
        ]}
      />
    </section>
  );
}

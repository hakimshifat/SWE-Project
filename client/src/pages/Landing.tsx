import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { FeatureCards } from "../components/FeatureCards";

export function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Secure steganography workspace</p>
          <h1>Hide confidential data inside clean image files.</h1>
          <p className="hero-lede">
            Embed text or files into PNG/BMP cover images, protect payloads with optional passwords,
            and monitor every operation from an admin view.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/register">Create Account</Link>
            <Link className="button secondary" to="/login">Login</Link>
          </div>
          <div className="hero-stats">
            <div><strong>PNG/BMP</strong><span>lossless image support</span></div>
            <div><strong>AES-GCM</strong><span>password protection</span></div>
            <div><strong>Audit Logs</strong><span>admin monitoring</span></div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="visual-toolbar"><span /><span /><span /></div>
          <div className="visual-stage">
            <div className="cover-preview">
              <div className="pixel-row" />
              <div className="pixel-row short" />
              <div className="pixel-row" />
              <div className="pixel-lock" />
            </div>
            <div className="flow-line" />
            <div className="payload-preview">
              <span>secret.txt</span>
              <strong>Encrypted payload</strong>
              <div className="payload-bars"><i /><i /><i /></div>
            </div>
          </div>
          <div className="visual-footer">
            <span className="status-pill success">Ready to embed</span>
            <span className="status-pill locked">Protected</span>
          </div>
        </div>
      </section>
      <section className="feature-strip">
        <article><h2><span className="action-title-word compact">Embed</span></h2><p>Upload a cover image, add secret text or a file, and generate a downloadable stego PNG.</p></article>
        <article><h2><span className="action-title-word compact">Extract</span></h2><p>Recover hidden content only when the correct optional stego password is provided.</p></article>
        <article><h2>Monitor</h2><p>Admins can review activity logs and manage user access from the same interface.</p></article>
      </section>
      <FeatureCards
        title="Built For The Full Workflow"
        subtitle="Everything in the SRS is available from one browser-based workspace."
        cards={[
          {
            meta: "FR-2 to FR-6",
            title: "Image-Based Data Hiding",
            text: "Upload PNG or BMP cover media, embed text or files, and download a generated stego PNG."
          },
          {
            meta: "FR-4, FR-8, FR-9",
            title: "Password-Protected Extraction",
            text: "Optional AES-GCM protection keeps hidden payloads inaccessible when the wrong password is supplied."
          },
          {
            meta: "FR-10",
            title: "Operation Visibility",
            text: "Embedding, extraction, login, and admin actions are logged for review from the admin dashboard."
          },
          {
            meta: "NFR Security",
            title: "Credential Safety",
            text: "User passwords are hashed with Argon2id and authenticated sessions are stored in PostgreSQL."
          }
        ]}
      />
    </>
  );
}

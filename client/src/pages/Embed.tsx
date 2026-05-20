import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export function Embed() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      await api.embed(formData);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Embedding failed.");
    }
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Hide data</p>
          <h1><span className="action-title-word">Embed</span> Secret Data</h1>
        </div>
      </section>
      <section className="panel">
        {error && <div className="alert alert-error">{error}</div>}
        <form className="form-grid" onSubmit={submit}>
          <label>Cover image<input name="coverFile" type="file" accept=".png,.bmp,image/png,image/bmp" required /></label>
          <label>Optional stego password<input name="stegoPassword" type="password" autoComplete="off" /></label>
          <label className="span-two">Secret text<textarea name="secretText" rows={8} /></label>
          <label className="span-two">Secret file<input name="secretFile" type="file" /></label>
          <div className="span-two form-actions">
            <button type="submit">Generate Stego File</button>
            <a className="button secondary" href="/dashboard">Cancel</a>
          </div>
        </form>
      </section>
    </>
  );
}

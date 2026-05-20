import { FormEvent, useState } from "react";
import { api } from "../api";

export function Extract() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [extractedText, setExtractedText] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setExtractedText("");
    const formData = new FormData(event.currentTarget);
    try {
      const result = await api.extract(formData);
      if (result.type === "text") {
        setExtractedText(result.body.text);
        setSuccess("Hidden text extracted.");
      } else {
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.filename;
        link.click();
        URL.revokeObjectURL(url);
        setSuccess("Hidden file extracted.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    }
  }

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">Recover data</p>
          <h1><span className="action-title-word">Extract</span> Hidden Data</h1>
        </div>
      </section>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <section className="panel">
        <form className="form-grid" onSubmit={submit}>
          <label>Stego image<input name="stegoFile" type="file" accept=".png,.bmp,image/png,image/bmp" required /></label>
          <label>Stego password<input name="stegoPassword" type="password" autoComplete="off" /></label>
          <div className="span-two form-actions">
            <button type="submit">Extract</button>
            <a className="button secondary" href="/dashboard">Cancel</a>
          </div>
        </form>
      </section>
      {extractedText && <section className="panel result-panel"><h2>Extracted Text</h2><pre>{extractedText}</pre></section>}
    </>
  );
}

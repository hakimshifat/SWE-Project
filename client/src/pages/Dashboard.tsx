import { useEffect, useState } from "react";
import type { StegoFileSummary } from "../../../shared/src/types";
import { api } from "../api";

export function Dashboard() {
  const [files, setFiles] = useState<StegoFileSummary[]>([]);

  useEffect(() => {
    api.dashboard().then((data) => {
      setFiles(data.files);
    });
  }, []);

  return (
    <>
      <section className="dashboard-action-strip">
        <a className="button action-button embed-action" href="/embed">Embed</a>
        <a className="button action-button extract-action" href="/extract">Extract</a>
      </section>
      <section className="dashboard-workspace">
        <aside className="file-sidebar">
          <div className="sidebar-title">Stego Files</div>
          {files.length ? (
            <ul className="file-tree">
              {files.map((file) => (
                <li key={file.stegoFileId}>
                  <a href={`/api/stego/files/${file.stegoFileId}/download`}>
                    <span className="file-icon">PNG</span>
                    <span>
                      <strong>{file.stegoFileName}</strong>
                      <small>{file.passwordProtected ? "Protected" : "Open"} · {file.fileSize} bytes</small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="empty">No generated stego files yet.</p>}
        </aside>
        <div className="panel activity-panel">
          <h2>Workspace Summary</h2>
          <p className="empty">
            {files.length
              ? `${files.length} stego file${files.length === 1 ? "" : "s"} available in your workspace.`
              : "No generated stego files yet."}
          </p>
        </div>
      </section>
    </>
  );
}

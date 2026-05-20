import { useEffect, useState } from "react";
import type { OperationLogSummary, StegoFileSummary } from "../../../shared/src/types";
import { api } from "../api";
import { StatusPill } from "../components/StatusPill";

export function Dashboard() {
  const [files, setFiles] = useState<StegoFileSummary[]>([]);
  const [recentLogs, setRecentLogs] = useState<OperationLogSummary[]>([]);

  useEffect(() => {
    api.dashboard().then((data) => {
      setFiles(data.files);
      setRecentLogs(data.recentLogs);
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
          <h2>Recent Activity</h2>
          {recentLogs.length ? (
            <ul className="activity-list">{recentLogs.map((log) => (
              <li key={log.logId}><strong>{log.operationType}</strong><StatusPill>{log.operationStatus}</StatusPill><p>{log.message}</p></li>
            ))}</ul>
          ) : <p className="empty">No activity recorded.</p>}
        </div>
      </section>
    </>
  );
}

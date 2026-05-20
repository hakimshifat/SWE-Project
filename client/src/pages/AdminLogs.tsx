import { useEffect, useState } from "react";
import type { OperationLogSummary } from "../../../shared/src/types";
import { api } from "../api";
import { StatusPill } from "../components/StatusPill";

export function AdminLogs() {
  const [logs, setLogs] = useState<OperationLogSummary[]>([]);

  useEffect(() => {
    api.adminLogs().then((data) => setLogs(data.logs));
  }, []);

  return (
    <>
      <section className="page-head"><div><p className="eyebrow">Administration</p><h1>Operation Logs</h1></div></section>
      <section className="panel">
        <div className="table-wrap">
          <table><thead><tr><th>Time</th><th>User</th><th>Operation</th><th>Status</th><th>Message</th></tr></thead>
            <tbody>{logs.map((log) => (
              <tr key={log.logId}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.user?.username ?? "system"}</td>
                <td>{log.operationType}</td>
                <td><StatusPill>{log.operationStatus}</StatusPill></td>
                <td>{log.message}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

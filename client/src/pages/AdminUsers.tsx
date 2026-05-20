import { useEffect, useState } from "react";
import type { PublicUser } from "../../../shared/src/types";
import { api } from "../api";
import { StatusPill } from "../components/StatusPill";

export function AdminUsers() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState("");

  async function loadUsers() {
    const data = await api.adminUsers();
    setUsers(data.users);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateStatus(userId: number, status: string) {
    setError("");
    try {
      await api.updateUserStatus(userId, status);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <>
      <section className="page-head"><div><p className="eyebrow">Administration</p><h1>User Access</h1></div></section>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="panel">
        <div className="table-wrap">
          <table><thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th /></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.userId}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td><StatusPill tone="role">{user.role}</StatusPill></td>
                <td><StatusPill tone={user.status}>{user.status}</StatusPill></td>
                <td>{new Date(user.createdAt).toLocaleString()}</td>
                <td>
                  <div className="status-form">
                    <select defaultValue={user.status} onChange={(event) => updateStatus(user.userId, event.target.value)}>
                      <option value="active">active</option>
                      <option value="blocked">blocked</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

import type { OperationLogSummary, PublicUser, StegoFileSummary } from "../../shared/src/types";

const jsonHeaders = { "Content-Type": "application/json" };

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    let message = "Request failed.";
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error || message;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const api = {
  me: () => request<{ user: PublicUser | null }>("/api/auth/me"),
  register: (data: { username: string; email: string; password: string; confirmPassword: string }) =>
    request<{ user: PublicUser }>("/api/auth/register", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data)
    }),
  login: (data: { username: string; password: string }) =>
    request<{ user: PublicUser }>("/api/auth/login", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(data)
    }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  dashboard: () => request<{ files: StegoFileSummary[] }>("/api/dashboard"),
  embed: (formData: FormData) =>
    request<{ file: StegoFileSummary }>("/api/stego/embed", {
      method: "POST",
      body: formData
    }),
  extract: async (formData: FormData) => {
    const response = await fetch("/api/stego/extract", {
      method: "POST",
      credentials: "include",
      body: formData
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error || "Extraction failed.");
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return { type: "text" as const, body: await response.json() as { text: string } };
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || "extracted-secret.bin";
    return { type: "file" as const, blob, filename };
  },
  adminUsers: () => request<{ users: PublicUser[] }>("/api/admin/users"),
  updateUserStatus: (userId: number, status: string) =>
    request<{ user: PublicUser }>(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ status })
    }),
  adminLogs: () => request<{ logs: OperationLogSummary[] }>("/api/admin/logs")
};

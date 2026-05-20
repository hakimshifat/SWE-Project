import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { AdminLogs } from "./pages/AdminLogs";
import { AdminUsers } from "./pages/AdminUsers";
import { Dashboard } from "./pages/Dashboard";
import { Embed } from "./pages/Embed";
import { Extract } from "./pages/Extract";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import "./styles.css";

function Protected({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="shell"><div className="panel">Loading...</div></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/embed" element={<Protected><Embed /></Protected>} />
            <Route path="/extract" element={<Protected><Extract /></Protected>} />
            <Route path="/admin/users" element={<Protected admin><AdminUsers /></Protected>} />
            <Route path="/admin/logs" element={<Protected admin><AdminLogs /></Protected>} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);


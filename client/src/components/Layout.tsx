import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export function Layout({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const [loadingBar, setLoadingBar] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sihs-theme", theme);
  }, [theme]);

  useEffect(() => {
    setLoadingBar(true);
    const timeout = window.setTimeout(() => setLoadingBar(false), 620);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  async function logout() {
    await api.logout();
    setUser(null);
    navigate("/login");
  }

  return (
    <>
      <div className={`loading-bar ${loadingBar ? "is-active" : ""}`} aria-hidden="true" />
      <header className="topbar">
        <Link className="brand" to={user ? "/dashboard" : "/"}>
          <span className="brand-mark" />
          Secure Information Hiding
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink className="primary-nav-action" to="/embed">Embed</NavLink>
              <NavLink className="primary-nav-action" to="/extract">Extract</NavLink>
              {user.role === "admin" && (
                <>
                  <NavLink to="/admin/users">Users</NavLink>
                  <NavLink to="/admin/logs">Logs</NavLink>
                </>
              )}
              <button className="link-button" type="button" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/">Home</NavLink>
              <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
            </>
          )}
          {user && <span className="nav-user">{user.username}</span>}
          <button
            className="theme-toggle"
            type="button"
            aria-pressed={theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <span className="theme-toggle-track"><span className="theme-toggle-thumb" /></span>
            <span className="theme-toggle-text">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </nav>
      </header>
      <main className="shell">{children}</main>
    </>
  );
}

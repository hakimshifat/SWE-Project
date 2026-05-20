(() => {
  const storageKey = "sihs-theme";
  const root = document.documentElement;
  const toggle = document.querySelector("[data-theme-toggle]");
  const label = document.querySelector("[data-theme-toggle-text]");

  function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);
    if (label) {
      label.textContent = theme === "dark" ? "Dark" : "Light";
    }
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.setAttribute("title", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
    }
  }

  const currentTheme = root.dataset.theme || "light";
  applyTheme(currentTheme);

  if (toggle) {
    toggle.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }
})();

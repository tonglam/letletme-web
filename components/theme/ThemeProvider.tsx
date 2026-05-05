"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  themes: Theme[];
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(storageKey: string, defaultTheme: Theme, enableSystem: boolean): Theme {
  if (typeof window === "undefined") return defaultTheme;

  try {
    const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    if (storedTheme === "system") return enableSystem ? storedTheme : defaultTheme;
  } catch {}

  return defaultTheme;
}

function applyTheme(theme: Theme, systemTheme: ResolvedTheme, disableTransition: boolean) {
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const root = document.documentElement;
  let transitionStyle: HTMLStyleElement | null = null;

  if (disableTransition) {
    transitionStyle = document.createElement("style");
    transitionStyle.appendChild(
      document.createTextNode(
        "*,*::before,*::after{transition:none!important;animation:none!important}",
      ),
    );
    document.head.appendChild(transitionStyle);
  }

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;

  if (transitionStyle) {
    window.getComputedStyle(document.body);
    window.setTimeout(() => transitionStyle?.remove(), 1);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    getStoredTheme(storageKey, defaultTheme, enableSystem),
  );
  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(getSystemTheme());

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    applyTheme(theme, systemTheme, disableTransitionOnChange);
  }, [disableTransitionOnChange, systemTheme, theme]);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      const safeTheme = enableSystem ? nextTheme : nextTheme === "system" ? defaultTheme : nextTheme;
      setThemeState(safeTheme);

      try {
        window.localStorage.setItem(storageKey, safeTheme);
      } catch {}
    },
    [defaultTheme, enableSystem, storageKey],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      systemTheme,
      themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
      setTheme,
    }),
    [enableSystem, resolvedTheme, setTheme, systemTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

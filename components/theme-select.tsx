"use client";
import { useTheme } from "@/lib/client/theme";
export function ThemeSelect() {
  const { preference, setTheme } = useTheme();
  return (
    <select
      className="theme-select"
      aria-label="Theme"
      value={preference}
      onChange={(event) => {
        const value = event.target.value;
        if (value === "light" || value === "dark" || value === "system")
          setTheme(value);
      }}
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}

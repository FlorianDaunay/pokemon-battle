import { defineTheme } from "../define";

export default defineTheme({
  id: "spire",
  name: "Echo Spire",
  description: "The game's own look: night indigo glass with a warm gold accent.",
  scheme: "dark",
  colors: {
    canvas: "#0B0D1A",
    surface: "#151A33E6",
    surfaceHover: "#1F2647",
    border: "#2E3766",
    textPrimary: "#F1F0FA",
    textSecondary: "#B4B6D6",
    textMuted: "#7C80A8",
    accent: "#F5B83D",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
  },
  radius: { control: "0.6rem", tile: "0.9rem", card: "1.1rem" },
  shadow: {
    card: "0 6px 24px -8px rgb(0 0 0 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.05)",
    overlay: "0 16px 48px -12px rgb(0 0 0 / 0.75)",
  },
  effects: { surfaceBackdrop: "blur(10px) saturate(1.2)" },
  fonts: { sans: '"Nunito", "Segoe UI", sans-serif' },
});

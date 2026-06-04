/**
 * "Clarity" palettes. Content-first, calm, precise. One confident accent
 * plus a small data-viz set (calories/protein/carbs/fat). Light + dark.
 */
export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  // data-viz
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  trend: string;
  positive: string;
  warning: string;
  error: string;
}

export const lightTheme: Palette = {
  bg:         "#FBFAF8",
  surface:    "#FFFFFF",
  surfaceAlt: "#F2F1ED",
  fg:         "#1A1A18",
  muted:      "#6B6A66",
  border:     "#E6E4DE",
  accent:     "#3B5BDB",
  accentSoft: "rgba(59,91,219,0.10)",
  onAccent:   "#FFFFFF",
  calories:   "#3B5BDB",
  protein:    "#E8590C",
  carbs:      "#2F9E44",
  fat:        "#F08C00",
  trend:      "#3B5BDB",
  positive:   "#2F9E44",
  warning:    "#F08C00",
  error:      "#E03131",
};

export const darkTheme: Palette = {
  bg:         "#14140F",
  surface:    "#1D1D17",
  surfaceAlt: "#26261E",
  fg:         "#F2F1EC",
  muted:      "#A3A199",
  border:     "#33332B",
  accent:     "#91A7FF",
  accentSoft: "rgba(145,167,255,0.14)",
  onAccent:   "#10131F",
  calories:   "#91A7FF",
  protein:    "#FF922B",
  carbs:      "#51CF66",
  fat:        "#FFC078",
  trend:      "#91A7FF",
  positive:   "#51CF66",
  warning:    "#FFC078",
  error:      "#FF6B6B",
};

export type ColorScheme = "light" | "dark" | null | undefined;

export const resolveTheme = (scheme: ColorScheme): Palette =>
  scheme === "dark" ? darkTheme : lightTheme;

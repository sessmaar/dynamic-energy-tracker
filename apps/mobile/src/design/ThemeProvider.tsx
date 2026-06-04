import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { type Palette, resolveTheme } from "./theme";

const ThemeCtx = createContext<Palette>(resolveTheme("light"));

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const scheme = useColorScheme();
  return <ThemeCtx.Provider value={resolveTheme(scheme)}>{children}</ThemeCtx.Provider>;
};

/** Live palette for the current device color scheme. */
export const useTheme = (): Palette => useContext(ThemeCtx);

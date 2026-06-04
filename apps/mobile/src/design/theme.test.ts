import { describe, expect, it } from "vitest";
import { resolveTheme, lightTheme, darkTheme } from "./theme";

describe("resolveTheme", () => {
  it("returns the light palette for 'light'", () => {
    expect(resolveTheme("light")).toBe(lightTheme);
  });
  it("returns the dark palette for 'dark'", () => {
    expect(resolveTheme("dark")).toBe(darkTheme);
  });
  it("defaults to light when scheme is null/undefined", () => {
    expect(resolveTheme(null)).toBe(lightTheme);
    expect(resolveTheme(undefined)).toBe(lightTheme);
  });
  it("both palettes expose the same keys", () => {
    expect(Object.keys(lightTheme).sort()).toEqual(Object.keys(darkTheme).sort());
  });
});

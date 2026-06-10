// jsdom doesn't expose localStorage on globalThis in vitest 4.x; provide a
// minimal in-memory implementation so tests that touch zustand's persist
// middleware work as expected.
if (typeof globalThis !== "undefined" && !globalThis.localStorage) {
  const data: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => { data[k] = String(v); },
    removeItem: (k: string) => { delete data[k]; },
    clear: () => { for (const k of Object.keys(data)) delete data[k]; },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() { return Object.keys(data).length; },
  } as Storage;
}

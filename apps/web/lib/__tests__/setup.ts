// Polyfill localStorage for jsdom
if (typeof global !== "undefined" && !global.localStorage) {
  class LocalStorage {
    private data: Record<string, string> = {};

    getItem(key: string): string | null {
      return this.data[key] ?? null;
    }

    setItem(key: string, value: string): void {
      this.data[key] = String(value);
    }

    removeItem(key: string): void {
      delete this.data[key];
    }

    clear(): void {
      this.data = {};
    }

    key(index: number): string | null {
      const keys = Object.keys(this.data);
      return keys[index] ?? null;
    }

    get length(): number {
      return Object.keys(this.data).length;
    }
  }

  global.localStorage = new LocalStorage() as any;
}

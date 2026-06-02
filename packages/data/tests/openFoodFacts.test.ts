import { describe, expect, it, vi } from "vitest";
import { lookupBarcode, searchOpenFoodFacts } from "../src/openFoodFacts";

const productPayload = (overrides: Record<string, unknown> = {}) => ({
  code: "0123456789012",
  product_name: "Test Oats",
  brands: "TestCo",
  serving_quantity: 40,
  nutriments: {
    "energy-kcal_100g": 380,
    "proteins_100g": 13,
    "carbohydrates_100g": 67,
    "fat_100g": 7,
  },
  ...overrides,
});

const ok = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;

describe("searchOpenFoodFacts", () => {
  it("returns normalized candidates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ products: [productPayload()] }));
    const out = await searchOpenFoodFacts("oats", 5, fetchMock as unknown as typeof fetch);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      source: "off",
      sourceRef: "0123456789012",
      name: "Test Oats",
      brand: "TestCo",
      kcalPer100g: 380,
    });
  });

  it("drops products without kcal or name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({
      products: [
        productPayload({ product_name: "" }),
        productPayload({ nutriments: {} }),
        productPayload({ code: "abc" }),
      ],
    }));
    const out = await searchOpenFoodFacts("foo", 5, fetchMock as unknown as typeof fetch);
    expect(out).toHaveLength(1);
    expect(out[0]!.sourceRef).toBe("abc");
  });

  it("empty query returns []", async () => {
    const fetchMock = vi.fn();
    expect(await searchOpenFoodFacts("  ", 5, fetchMock as unknown as typeof fetch)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("lookupBarcode", () => {
  it("returns null when product not found", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ status: 0 }));
    expect(await lookupBarcode("xxx", fetchMock as unknown as typeof fetch)).toBeNull();
  });
  it("returns candidate when found", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ status: 1, product: productPayload() }));
    const r = await lookupBarcode("0123456789012", fetchMock as unknown as typeof fetch);
    expect(r?.name).toBe("Test Oats");
  });
});

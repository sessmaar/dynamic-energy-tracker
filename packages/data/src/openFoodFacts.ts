/**
 * Open Food Facts client. No API key, no auth — just an HTTPS endpoint.
 * We normalize their loose response shape into the same `FoodCandidate`
 * type the local `foods` table uses, so the UI never branches on source.
 *
 * Rate-limit etiquette: OFF asks for a descriptive User-Agent. We pass
 * one through on every call.
 */

const UA = "DynamicEnergyTracker/0.1 (https://github.com/) — research";

export interface FoodCandidate {
  /** OFF barcode (`code`) or USDA fdc_id — stable provider-side ref. */
  sourceRef: string;
  source: "off" | "usda";
  name: string;
  brand: string | null;
  servingSizeG: number | null;
  kcalPer100g: number;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
}

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string; // e.g. "30 g", "1 cup (240 ml)"
  serving_quantity?: number; // grams, when OFF parsed it
  nutriments?: {
    "energy-kcal_100g"?: number;
    "proteins_100g"?: number;
    "carbohydrates_100g"?: number;
    "fat_100g"?: number;
  };
}

const fromOffProduct = (p: OffProduct): FoodCandidate | null => {
  const kcal = p.nutriments?.["energy-kcal_100g"];
  const name = p.product_name?.trim();
  if (!name || kcal == null || !Number.isFinite(kcal)) return null;
  return {
    source: "off",
    sourceRef: p.code,
    name,
    brand: p.brands?.split(",")[0]?.trim() || null,
    servingSizeG: typeof p.serving_quantity === "number" ? p.serving_quantity : null,
    kcalPer100g: kcal,
    proteinPer100g: p.nutriments?.["proteins_100g"] ?? null,
    carbsPer100g: p.nutriments?.["carbohydrates_100g"] ?? null,
    fatPer100g: p.nutriments?.["fat_100g"] ?? null,
  };
};

/**
 * Free-text search. Returns up to `limit` candidates. OFF's relevance
 * is noisy — for v1 we sort by name length (shorter ≈ more generic and
 * more useful) as a cheap tiebreaker.
 */
export const searchOpenFoodFacts = async (
  query: string,
  limit = 12,
  fetchImpl: typeof fetch = fetch,
): Promise<FoodCandidate[]> => {
  if (!query.trim()) return [];
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(Math.min(limit * 3, 50)));
  url.searchParams.set(
    "fields",
    "code,product_name,brands,serving_size,serving_quantity,nutriments",
  );

  const res = await fetchImpl(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`OFF search ${res.status}`);
  const body = (await res.json()) as { products?: OffProduct[] };
  const candidates = (body.products ?? [])
    .map(fromOffProduct)
    .filter((c): c is FoodCandidate => c !== null);
  candidates.sort((a, b) => a.name.length - b.name.length);
  return candidates.slice(0, limit);
};

/** Lookup a single product by barcode. Returns null if not found. */
export const lookupBarcode = async (
  barcode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FoodCandidate | null> => {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetchImpl(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const body = (await res.json()) as { status: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) return null;
  return fromOffProduct({ ...body.product, code: barcode });
};

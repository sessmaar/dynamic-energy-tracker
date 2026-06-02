-- ============================================================================
-- Seed the shared `foods` catalog with ~40 staples so the first user
-- searching "chicken" or "oats" gets an instant local hit without a
-- round trip to Open Food Facts.
--
-- All entries are `source = 'custom'` with `created_by = null` so they're
-- visible to every authenticated user, owned by no one, and not deletable
-- by a regular account. Macros are USDA-derived rough averages for raw
-- or as-cooked staples; the user can always override with a custom row
-- if they want the exact brand they buy.
-- ============================================================================

insert into public.foods (source, source_ref, name, brand, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, common_unit, common_unit_grams, created_by)
values
  -- Protein
  ('custom', null, 'Chicken breast, cooked',       null, 165, 31.0,  0.0,  3.6, '1 fillet (cooked)',   170, null),
  ('custom', null, 'Chicken thigh, cooked',        null, 209, 26.0,  0.0, 11.0, '1 thigh',             100, null),
  ('custom', null, 'Beef, lean ground (90/10)',    null, 176, 20.0,  0.0, 10.0, '100 g cooked',        100, null),
  ('custom', null, 'Salmon, cooked',               null, 208, 20.0,  0.0, 13.0, '1 fillet',            170, null),
  ('custom', null, 'Tuna, canned in water',        null, 116, 26.0,  0.0,  1.0, '1 can',               142, null),
  ('custom', null, 'Egg, whole',                   null, 143, 13.0,  1.1,  9.5, '1 large egg',          50, null),
  ('custom', null, 'Egg whites',                   null,  52, 11.0,  0.7,  0.2, '1 large white',        33, null),
  ('custom', null, 'Greek yogurt, plain non-fat',  null,  59, 10.3,  3.6,  0.4, '1 cup',               245, null),
  ('custom', null, 'Cottage cheese, low-fat',      null,  72, 12.4,  2.7,  1.0, '1 cup',               226, null),
  ('custom', null, 'Whey protein, isolate',        null, 370, 80.0, 10.0,  3.0, '1 scoop',              30, null),
  ('custom', null, 'Tofu, firm',                   null,  76,  8.0,  1.9,  4.8, '100 g',               100, null),

  -- Carbs / grains / starches
  ('custom', null, 'Oats, rolled, dry',            null, 379, 13.2, 67.7,  6.5, '1/2 cup dry',          40, null),
  ('custom', null, 'Rice, white, cooked',          null, 130,  2.7, 28.0,  0.3, '1 cup cooked',        158, null),
  ('custom', null, 'Rice, brown, cooked',          null, 112,  2.3, 23.5,  0.8, '1 cup cooked',        195, null),
  ('custom', null, 'Pasta, cooked',                null, 158,  5.8, 31.0,  0.9, '1 cup cooked',        140, null),
  ('custom', null, 'Bread, whole wheat',           null, 247, 13.0, 41.0,  3.4, '1 slice',              28, null),
  ('custom', null, 'Tortilla, flour',              null, 304,  8.0, 49.0,  8.0, '1 medium',             49, null),
  ('custom', null, 'Potato, baked',                null,  93,  2.5, 21.0,  0.1, '1 medium',            173, null),
  ('custom', null, 'Sweet potato, baked',          null,  90,  2.0, 21.0,  0.2, '1 medium',            150, null),
  ('custom', null, 'Quinoa, cooked',               null, 120,  4.4, 21.3,  1.9, '1 cup cooked',        185, null),

  -- Fruit
  ('custom', null, 'Banana',                       null,  89,  1.1, 23.0,  0.3, '1 medium',            118, null),
  ('custom', null, 'Apple',                        null,  52,  0.3, 14.0,  0.2, '1 medium',            182, null),
  ('custom', null, 'Blueberries',                  null,  57,  0.7, 14.5,  0.3, '1 cup',               148, null),
  ('custom', null, 'Strawberries',                 null,  32,  0.7,  7.7,  0.3, '1 cup',               152, null),
  ('custom', null, 'Avocado',                      null, 160,  2.0,  9.0, 15.0, '1 medium',            150, null),

  -- Veg
  ('custom', null, 'Broccoli, cooked',             null,  35,  2.4,  7.2,  0.4, '1 cup',               156, null),
  ('custom', null, 'Spinach, raw',                 null,  23,  2.9,  3.6,  0.4, '1 cup',                30, null),
  ('custom', null, 'Mixed greens salad',           null,  17,  1.4,  3.3,  0.2, '2 cups',               72, null),
  ('custom', null, 'Carrot',                       null,  41,  0.9,  9.6,  0.2, '1 medium',             61, null),

  -- Fats / nuts / oils
  ('custom', null, 'Almonds',                      null, 579, 21.0, 22.0, 49.9, '1 oz (~23 nuts)',      28, null),
  ('custom', null, 'Peanut butter, natural',       null, 588, 25.0, 20.0, 50.0, '2 tbsp',               32, null),
  ('custom', null, 'Olive oil',                    null, 884,  0.0,  0.0,100.0, '1 tbsp',               14, null),

  -- Dairy / drinks
  ('custom', null, 'Milk, 2%',                     null,  50,  3.3,  4.7,  2.0, '1 cup',               244, null),
  ('custom', null, 'Almond milk, unsweetened',     null,  13,  0.4,  0.3,  1.1, '1 cup',               240, null),
  ('custom', null, 'Coffee, black',                null,   2,  0.3,  0.0,  0.0, '1 cup (8 oz)',        237, null),
  ('custom', null, 'Beer, lager',                  null,  43,  0.5,  3.6,  0.0, '12 oz can',           355, null),
  ('custom', null, 'Wine, red',                    null,  85,  0.1,  2.6,  0.0, '5 oz glass',          147, null),

  -- Sweets / snacks
  ('custom', null, 'Dark chocolate, 70%',          null, 598,  7.8, 46.0, 43.0, '1 square',             10, null),
  ('custom', null, 'Protein bar, generic',         null, 380, 30.0, 35.0, 11.0, '1 bar',                60, null)
on conflict do nothing;

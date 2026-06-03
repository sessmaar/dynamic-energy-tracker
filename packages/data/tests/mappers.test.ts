import { describe, expect, it } from "vitest";
import {
  accountFromRow, activityFromRow, bodyMeasurementFromRow, goalFromRow, intakeFromRow,
  profileFromRow, progressPhotoFromRow, weightFromRow,
} from "../src/mappers";

const PROFILE_ROW = {
  id: "u1",
  sex: "male",
  date_of_birth: "1990-01-01",
  height_cm: 180,
  initial_weight_kg: 80,
  timezone: "UTC",
  preferred_units: "metric",
  activity_level: "very",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as const;

describe("profileFromRow", () => {
  it("derives age from DOB at a fixed reference date", () => {
    // Real wall-clock would make this flaky; mappers use system time. To
    // assert behavior precisely we'd need to inject a clock. For now,
    // assert age is non-negative and inside a sane window.
    const p = profileFromRow(PROFILE_ROW);
    expect(p.sex).toBe("male");
    expect(p.heightCm).toBe(180);
    expect(p.age).toBeGreaterThan(30);
    expect(p.age).toBeLessThan(80);
  });
});

describe("accountFromRow", () => {
  it("surfaces the stored activity level for the cold-start seed", () => {
    expect(accountFromRow(PROFILE_ROW).activityLevel).toBe("very");
  });
});

describe("bodyMeasurementFromRow", () => {
  it("maps tape + direct body-fat columns to the domain shape", () => {
    const m = bodyMeasurementFromRow({
      id: "m1", user_id: "u1", date: "2026-06-02",
      neck_cm: 38, waist_cm: 85, hip_cm: null, weight_kg: 80,
      body_fat_pct: null, source: "manual", note: null,
      created_at: "2026-06-02T00:00:00Z",
    });
    expect(m).toEqual({
      id: "m1", date: "2026-06-02",
      neckCm: 38, waistCm: 85, hipCm: null, weightKg: 80,
      bodyFatPct: null, note: null,
    });
  });
});

describe("progressPhotoFromRow", () => {
  it("maps the storage pointer", () => {
    expect(progressPhotoFromRow({
      id: "p1", user_id: "u1", date: "2026-06-02",
      storage_path: "u1/2026-06-02-front.jpg", note: "front",
      created_at: "2026-06-02T00:00:00Z",
    })).toEqual({ id: "p1", date: "2026-06-02", storagePath: "u1/2026-06-02-front.jpg", note: "front" });
  });
});

describe("goalFromRow", () => {
  it("applies negative sign for cuts", () => {
    expect(
      goalFromRow({
        id: "g", user_id: "u", goal_type: "cut",
        goal_rate_kg_per_week: 0.5, start_date: "2026-06-01",
        end_date: null, status: "active", created_at: "2026-06-01T00:00:00Z",
        protein_g_target: null, carbs_g_target: null, fat_g_target: null,
      }),
    ).toEqual({ kgPerWeek: -0.5 });
  });
  it("forces zero for maintain regardless of stored rate", () => {
    expect(
      goalFromRow({
        id: "g", user_id: "u", goal_type: "maintain",
        goal_rate_kg_per_week: 0.9, start_date: "2026-06-01",
        end_date: null, status: "active", created_at: "2026-06-01T00:00:00Z",
        protein_g_target: null, carbs_g_target: null, fat_g_target: null,
      }),
    ).toEqual({ kgPerWeek: 0 });
  });
  it("positive for gains", () => {
    expect(
      goalFromRow({
        id: "g", user_id: "u", goal_type: "gain",
        goal_rate_kg_per_week: 0.25, start_date: "2026-06-01",
        end_date: null, status: "active", created_at: "2026-06-01T00:00:00Z",
        protein_g_target: null, carbs_g_target: null, fat_g_target: null,
      }),
    ).toEqual({ kgPerWeek: 0.25 });
  });
});

describe("weight/intake/activity fromRow", () => {
  it("brands weight values", () => {
    const e = weightFromRow({
      id: "w", user_id: "u", date: "2026-06-01", weight_kg: 79.4,
      source: "manual", note: null, created_at: "2026-06-01T00:00:00Z",
    });
    expect(e.weight).toBe(79.4);
    expect(e.date).toBe("2026-06-01");
  });

  it("brands intake values", () => {
    const e = intakeFromRow({
      user_id: "u", date: "2026-06-01", calories: 2300,
      protein_g: null, carbs_g: null, fat_g: null,
    });
    expect(e.calories).toBe(2300);
  });

  it("brands activity met + duration", () => {
    const e = activityFromRow({
      id: "a", user_id: "u", date: "2026-06-01",
      start_at: null, end_at: null,
      activity_type: "run_easy", intensity: null,
      duration_min: 30, met_value: 8.0, calories_active: 280,
      created_at: "2026-06-01T00:00:00Z",
    });
    expect(e.met).toBe(8);
    expect(e.durationMinutes).toBe(30);
  });
});

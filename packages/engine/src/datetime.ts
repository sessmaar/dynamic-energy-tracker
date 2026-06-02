import { type IsoDate, isoDate } from "./types";

/**
 * Local-day helpers. A user in PST logging dinner at 21:00 must see
 * that meal land on the same calendar date everywhere — Command screen,
 * weekly TDEE windows, weight trend buckets. `new Date().toISOString()`
 * uses UTC and silently rolls the date over, which would put their
 * dinner on "tomorrow" in the database.
 *
 * We pin every "what is today" call to the profile's IANA timezone
 * (e.g. "America/Los_Angeles"). The trick is `Intl.DateTimeFormat`
 * with the `en-CA` locale — its short date format is YYYY-MM-DD, so
 * formatting in the user's TZ and slicing gives the right ISO date
 * without manual offset math.
 */
export const localDateInTimezone = (timezone: string, at: Date = new Date()): IsoDate => {
  // `en-CA` happens to produce ISO 8601 short dates by default. If it
  // ever doesn't (some Node runtimes), the fallback path below assembles
  // the date from formatted parts.
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const formatted = formatter.format(at);
  if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return isoDate(formatted);

  const parts = formatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return isoDate(`${get("year")}-${get("month")}-${get("day")}`);
};

/** UTC fallback. Use only when a profile-bound timezone isn't available yet. */
export const todayUtc = (): IsoDate => isoDate(new Date().toISOString().slice(0, 10));

/**
 * Compute the user's current age (whole years) from a DOB in YYYY-MM-DD,
 * evaluated in their timezone so birthdays don't flip a day early/late.
 */
export const ageFromDob = (dob: IsoDate, timezone: string, at: Date = new Date()): number => {
  const today = localDateInTimezone(timezone, at);
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = dob.split("-").map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
};

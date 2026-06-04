import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Session is stored in localStorage by supabase-js, not cookies.
// Route protection is handled by each page's own useEffect session guard.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

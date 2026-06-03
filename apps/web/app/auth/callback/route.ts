import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth callback handler.
 * After Google authenticates the user, Supabase redirects here with
 * either ?code= (PKCE) or a hash fragment containing the access_token.
 *
 * For the PKCE flow we exchange the code server-side. For the implicit
 * flow the token lives in the hash and is handled client-side by
 * supabase-js automatically — so we just redirect to /dashboard and
 * let the client pick it up.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(`${origin}/sign-in?error=oauth_callback_failed`);
  }

  // No code param — implicit flow, tokens are in the URL hash.
  // Redirect to dashboard and let supabase-js handle the hash client-side.
  return NextResponse.redirect(`${origin}${next}`);
}

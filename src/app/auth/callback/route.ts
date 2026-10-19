import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase redirects here after Google sign-in with a one-time `code`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const loginWithError = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return loginWithError(providerError);
  }

  const code = searchParams.get("code");
  if (!code) {
    return loginWithError("Sign-in link is missing its code. Please try again.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginWithError(error.message);
  }

  // The admin layout decides whether this account may enter.
  return NextResponse.redirect(`${origin}/`);
}

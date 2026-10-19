import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// The signed-in user and whether they're a superadmin, looked up once per request.
export const getAdminSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  return { supabase, user, isSuperadmin: isSuperadmin === true };
});

// Use at the top of every admin page and Server Action. Signed-out users go to /login;
// signed-in users without profiles.is_superadmin go to /not-authorized.
export async function requireSuperadmin() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.isSuperadmin) {
    redirect("/not-authorized");
  }
  return session;
}

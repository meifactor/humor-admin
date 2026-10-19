import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getAdminSession } from "@/lib/admin";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getAdminSession();
  if (session) {
    redirect(session.isSuperadmin ? "/" : "/not-authorized");
  }

  const { error } = await searchParams;

  return (
    <AuthCard title="Staff only beyond this point">
      <p className="mt-2 text-sm text-ink-2">
        Sign in with Google. Only accounts marked as superadmin can enter the
        control center.
      </p>
      {typeof error === "string" && (
        <p role="alert" className="mt-4 rounded-md border border-mta-red p-3 text-sm text-red-300">
          Sign-in failed: {error}
        </p>
      )}
      <div className="mt-6">
        <GoogleSignInButton />
      </div>
    </AuthCard>
  );
}

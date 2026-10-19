import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { AuthCard } from "@/components/auth-card";
import { secondaryButtonClass } from "@/components/ui";
import { getAdminSession } from "@/lib/admin";

export default async function NotAuthorizedPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }
  if (session.isSuperadmin) {
    redirect("/");
  }

  return (
    <AuthCard title="⛔ Not authorized">
      <p className="mt-2 text-sm text-ink-2">
        You&apos;re signed in as <strong className="text-white">{session.user.email}</strong>,
        but this account isn&apos;t a superadmin. Ask an existing admin to grant access.
      </p>
      <form action={signOut} className="mt-6">
        <button type="submit" className={`${secondaryButtonClass} w-full`}>
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}

import Link from "next/link";
import { signOut } from "@/app/actions";
import { AdminNav } from "@/components/admin-nav";
import { requireSuperadmin } from "@/lib/admin";

// Layouts aren't re-run on every navigation, so each admin page and Server Action also
// calls requireSuperadmin() itself, and RLS enforces it again in the database.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSuperadmin();

  return (
    <>
      <header className="border-b border-edge bg-black">
        <div className="mx-auto w-full max-w-6xl px-6 pt-2 pb-3">
          <div className="mb-3 h-[3px] bg-white" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight">Humor Project</span>
              <span className="text-xs font-bold tracking-widest text-mta-orange uppercase">
                Control Center
              </span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-ink-3 sm:inline">{user.email}</span>
              <form action={signOut}>
                <button type="submit" className="font-bold text-ink-2 hover:text-white">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <div className="mt-3">
            <AdminNav />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}

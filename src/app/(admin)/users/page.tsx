import type { Metadata } from "next";
import Image from "next/image";
import { inputClass, panelClass, secondaryButtonClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { avatarUrl, fullName } from "@/lib/storage";

export const metadata: Metadata = { title: "Users · Control Center" };

type UserRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  is_superadmin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  generation_count: number;
  reaction_count: number;
};

// Read-only list of every account (emails come from auth.users via admin_list_users()).
export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { supabase } = await requireSuperadmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";

  const { data, error } = await supabase.rpc("admin_list_users");
  const users = ((data as UserRow[] | null) ?? []).filter(
    (u) =>
      !query ||
      fullName(u).toLowerCase().includes(query) ||
      (u.email ?? "").toLowerCase().includes(query),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-ink-3">
            {users.length} {users.length === 1 ? "account" : "accounts"}
            {query && ` matching “${query}”`} · read-only
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="text-sm font-bold text-ink-2">
            Search
            <input name="q" defaultValue={query} placeholder="Name or email" className={`${inputClass} w-64`} />
          </label>
          <button type="submit" className={secondaryButtonClass}>
            Search
          </button>
        </form>
      </div>

      {error ? (
        <p className="rounded-md border border-mta-red p-4 text-red-300">Could not load users: {error.message}</p>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-panel-2 text-ink-2">
              <tr className="[&_th]:px-4 [&_th]:py-2.5">
                <th>User</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Last sign-in</th>
                <th className="text-right">Photos</th>
                <th className="text-right">Reactions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const avatar = avatarUrl(u.avatar_path);
                return (
                  <tr key={u.id} className="border-t border-edge [&_td]:px-4 [&_td]:py-3">
                    <td>
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <Image src={avatar} alt="" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-panel-2 font-bold">
                            {fullName(u).charAt(0)}
                          </span>
                        )}
                        <span className="font-bold">{fullName(u)}</span>
                        {u.is_superadmin && (
                          <span className="rounded-full bg-mta-orange px-2 py-0.5 text-xs font-bold text-black">Superadmin</span>
                        )}
                      </div>
                    </td>
                    <td className="text-ink-2">{u.email ?? "—"}</td>
                    <td className="text-ink-2">{formatDateTime(u.created_at)}</td>
                    <td className="text-ink-2">{formatDateTime(u.last_sign_in_at)}</td>
                    <td className="text-right font-bold tabular-nums">{u.generation_count}</td>
                    <td className="text-right font-bold tabular-nums">{u.reaction_count}</td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-3">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

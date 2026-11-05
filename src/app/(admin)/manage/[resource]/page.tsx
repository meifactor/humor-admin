import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { panelClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { getResource, type Field } from "@/lib/resources";
import { deleteRecord } from "../actions";
import { RecordForm } from "./record-form";

export async function generateMetadata({ params }: PageProps<"/manage/[resource]">): Promise<Metadata> {
  const { resource } = await params;
  return { title: `${getResource(resource)?.title ?? "Manage"} · Control Center` };
}

type Row = { id: string } & Record<string, unknown>;

function displayValue(field: Field, value: unknown, providers: Map<string, string>) {
  if (field.type === "boolean") return value ? "✅ Yes" : "— No";
  if (field.type === "provider") return providers.get(String(value)) ?? "Unknown";
  if (field.type === "select") return field.options?.find((o) => o.value === (value ?? ""))?.label ?? String(value ?? "");
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

// Generic create/read/update/delete screen for every table in src/lib/resources.ts.
export default async function ManagePage({ params }: PageProps<"/manage/[resource]">) {
  const { supabase } = await requireSuperadmin();
  const resource = getResource((await params).resource);
  if (!resource) {
    notFound();
  }

  const needsProviders = resource.fields.some((f) => f.type === "provider");
  const [{ data, error }, providerResult] = await Promise.all([
    supabase.from(resource.table).select("*").order(resource.orderBy.column, { ascending: resource.orderBy.ascending }),
    needsProviders ? supabase.from("llm_providers").select("id, name").order("name") : Promise.resolve({ data: [] }),
  ]);
  const rows = (data as Row[] | null) ?? [];
  const providers = (providerResult.data as { id: string; name: string }[] | null) ?? [];
  const providerNames = new Map(providers.map((p) => [p.id, p.name]));
  const columns = resource.columns.map((name) => resource.fields.find((f) => f.name === name)!);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{resource.title}</h1>
        <p className="mt-1 max-w-3xl text-ink-3">{resource.description}</p>
      </div>

      <details className={`${panelClass} p-5`}>
        <summary className="cursor-pointer font-bold">+ Add {resource.singular}</summary>
        <div className="mt-4">
          <RecordForm resourceKey={resource.key} fields={resource.fields} providers={providers} submitLabel={`Add ${resource.singular}`} />
        </div>
      </details>

      {error ? (
        <p className="rounded-md border border-mta-red p-4 text-red-300">
          Could not load {resource.title.toLowerCase()}: {error.message}. Has <code>supabase/observability.sql</code> been run?
        </p>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-panel-2 text-ink-2">
              <tr className="[&_th]:px-4 [&_th]:py-2.5">
                {columns.map((field) => (
                  <th key={field.name}>{field.label}</th>
                ))}
                <th className="w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-edge align-top [&_td]:px-4 [&_td]:py-3">
                  {columns.map((field) => (
                    <td key={field.name} className={field.type === "textarea" ? "max-w-md" : ""}>
                      {displayValue(field, row[field.name], providerNames)}
                    </td>
                  ))}
                  <td className="text-right">
                    <details className="group inline-block text-left">
                      <summary className="cursor-pointer list-none font-bold text-ink-2 hover:text-white">Edit</summary>
                      <div className="mt-3 w-[min(36rem,80vw)] rounded-md border border-edge bg-background p-4 shadow-xl">
                        <RecordForm
                          resourceKey={resource.key}
                          fields={resource.fields}
                          providers={providers}
                          record={row}
                          submitLabel="Save changes"
                        />
                        <form action={deleteRecord} className="mt-4 border-t border-edge pt-4">
                          <input type="hidden" name="resource" value={resource.key} />
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmButton label={`Delete ${resource.singular}`} confirmText={`Delete this ${resource.singular}? This can't be undone.`} compact />
                        </form>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-ink-3">
                    Nothing here yet.
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

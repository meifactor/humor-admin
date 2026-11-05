"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/admin";
import { getResource, type Resource } from "@/lib/resources";

export type FormState = { status: "idle" | "success" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Values = Record<string, string | number | boolean | null>;

// Turn submitted form fields into column values, checking each against the resource config.
function parseFields(resource: Resource, formData: FormData): { values: Values } | { error: string } {
  const values: Values = {};

  for (const field of resource.fields) {
    const raw = formData.get(field.name);

    if (field.type === "boolean") {
      values[field.name] = raw === "on";
      continue;
    }

    let text = typeof raw === "string" ? raw.trim() : "";
    if (field.lowercase) text = text.toLowerCase();

    if (!text) {
      if (field.required) return { error: `${field.label} is required.` };
      values[field.name] = null;
      continue;
    }

    if (field.type === "number") {
      const number = Number(text);
      if (!Number.isInteger(number)) return { error: `${field.label} must be a whole number.` };
      if ((field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) {
        return { error: `${field.label} must be between ${field.min} and ${field.max}.` };
      }
      values[field.name] = number;
      continue;
    }

    if (field.type === "select" && !field.options?.some((option) => option.value === text)) {
      return { error: `Pick a valid ${field.label.toLowerCase()}.` };
    }
    if (field.type === "provider" && !UUID.test(text)) {
      return { error: "Pick a provider." };
    }
    if (field.maxLength && text.length > field.maxLength) {
      return { error: `${field.label} must be ${field.maxLength} characters or fewer.` };
    }
    if (field.pattern && !new RegExp(field.pattern).test(text)) {
      return { error: `${field.label} must be ${field.patternHint ?? "valid"}.` };
    }
    values[field.name] = text;
  }

  return { values };
}

function friendlyError(error: { code?: string; message: string }, resource: Resource) {
  if (error.code === "23505") return `That ${resource.singular} already exists.`;
  if (error.code === "23503") return `This ${resource.singular} is still in use.`;
  return `Couldn't save: ${error.message}`;
}

function resourcePath(resource: Resource) {
  return `/manage/${resource.key}`;
}

export async function createRecord(resourceKey: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const resource = getResource(resourceKey);
  if (!resource) return { status: "error", message: "Unknown table." };

  const parsed = parseFields(resource, formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };

  const { error } = await supabase.from(resource.table).insert(parsed.values);
  if (error) return { status: "error", message: friendlyError(error, resource) };

  revalidatePath(resourcePath(resource));
  return { status: "success", message: `Added ${resource.singular}.` };
}

export async function updateRecord(resourceKey: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const resource = getResource(resourceKey);
  const id = formData.get("id");
  if (!resource || typeof id !== "string" || !UUID.test(id)) return { status: "error", message: "Unknown record." };

  const parsed = parseFields(resource, formData);
  if ("error" in parsed) return { status: "error", message: parsed.error };

  const values = resource.hasUpdatedAt ? { ...parsed.values, updated_at: new Date().toISOString() } : parsed.values;
  const { error } = await supabase.from(resource.table).update(values).eq("id", id);
  if (error) return { status: "error", message: friendlyError(error, resource) };

  revalidatePath(resourcePath(resource));
  return { status: "success", message: "Saved." };
}

export async function deleteRecord(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const resource = getResource(String(formData.get("resource")));
  const id = formData.get("id");
  if (!resource || typeof id !== "string" || !UUID.test(id)) return;

  const { error } = await supabase.from(resource.table).delete().eq("id", id);
  if (error) console.error(`Deleting from ${resource.table} failed`, error);

  revalidatePath(resourcePath(resource));
}

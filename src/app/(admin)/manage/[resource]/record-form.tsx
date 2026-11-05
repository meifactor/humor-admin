"use client";

import { useActionState } from "react";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { Field } from "@/lib/resources";
import { createRecord, updateRecord, type FormState } from "../actions";

type RecordFormProps = {
  resourceKey: string;
  fields: Field[];
  providers: { id: string; name: string }[];
  // When editing: the row's id and current values.
  record?: { id: string } & Record<string, unknown>;
  submitLabel: string;
};

function FieldInput({ field, value, providers }: { field: Field; value: unknown; providers: RecordFormProps["providers"] }) {
  const defaultValue = value ?? field.defaultValue ?? "";

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm font-bold text-ink-2">
        <input type="checkbox" name={field.name} defaultChecked={Boolean(value ?? field.defaultValue)} className="h-4 w-4 accent-white" />
        {field.label}
      </label>
    );
  }

  let input;
  if (field.type === "textarea") {
    input = (
      <textarea name={field.name} defaultValue={String(defaultValue)} required={field.required} maxLength={field.maxLength} rows={2} className={inputClass} />
    );
  } else if (field.type === "select" || field.type === "provider") {
    const options =
      field.type === "provider"
        ? [{ value: "", label: "Choose a provider" }, ...providers.map((p) => ({ value: p.id, label: p.name }))]
        : (field.options ?? []);
    input = (
      <select name={field.name} defaultValue={String(defaultValue)} required={field.required} className={inputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    input = (
      <input
        name={field.name}
        type={field.type === "number" ? "number" : "text"}
        defaultValue={String(defaultValue)}
        required={field.required}
        maxLength={field.maxLength}
        min={field.min}
        max={field.max}
        pattern={field.pattern}
        title={field.patternHint}
        placeholder={field.placeholder}
        className={inputClass}
      />
    );
  }

  return (
    <label className={labelClass}>
      {field.label}
      {!field.required && <span className="font-normal text-ink-3"> (optional)</span>}
      {input}
    </label>
  );
}

export function RecordForm({ resourceKey, fields, providers, record, submitLabel }: RecordFormProps) {
  const action = record ? updateRecord.bind(null, resourceKey) : createRecord.bind(null, resourceKey);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { status: "idle" });

  return (
    <form action={formAction} className="space-y-3">
      {record && <input type="hidden" name="id" value={record.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : field.type === "boolean" ? "self-end pb-2" : ""}>
            <FieldInput field={field} value={record?.[field.name]} providers={providers} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={record ? secondaryButtonClass : primaryButtonClass}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.message && (
          <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-red-300" : "text-sm text-green-400"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

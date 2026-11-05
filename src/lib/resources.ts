// Tables managed with full create/read/update/delete screens in the admin area.
// Plain data (no functions) so it can be shared by server pages, client forms and actions.

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "provider";
  required?: boolean;
  options?: { value: string; label: string }[];
  // Store the value lowercased (emails, domains).
  lowercase?: boolean;
  pattern?: string;
  patternHint?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  help?: string;
};

export type Resource = {
  key: string;
  table: string;
  title: string;
  singular: string;
  description: string;
  fields: Field[];
  // Columns shown in the list (field names, in order).
  columns: string[];
  orderBy: { column: string; ascending: boolean };
  hasUpdatedAt: boolean;
};

const VIBE_OPTIONS = [
  { value: "", label: "Any vibe" },
  { value: "genz", label: "🤪 Unhinged Gen-Z" },
  { value: "dad", label: "👴 Dad joke" },
  { value: "newyorker", label: "🗽 Jaded New Yorker" },
  { value: "core", label: "📚 Core Curriculum nerd" },
];

export const RESOURCES: Resource[] = [
  {
    key: "terms",
    table: "terms",
    title: "Terms",
    singular: "term",
    description: "Columbia, NYC and slang terms added to every caption prompt, so the AI gets local references right.",
    fields: [
      { name: "term", label: "Term", type: "text", required: true, maxLength: 60, placeholder: "e.g. Butler" },
      { name: "definition", label: "Meaning", type: "textarea", required: true, maxLength: 300 },
      {
        name: "category",
        label: "Category",
        type: "select",
        required: true,
        defaultValue: "columbia",
        options: [
          { value: "columbia", label: "Columbia" },
          { value: "nyc", label: "NYC" },
          { value: "slang", label: "Slang" },
        ],
      },
      { name: "is_active", label: "Used in prompts", type: "boolean", defaultValue: true },
    ],
    columns: ["term", "definition", "category", "is_active"],
    orderBy: { column: "term", ascending: true },
    hasUpdatedAt: true,
  },
  {
    key: "examples",
    table: "generation_examples",
    title: "AI generation examples",
    singular: "example",
    description: "Example photo → caption pairs shown to the AI so it learns each vibe (up to 4 matching ones per prompt).",
    fields: [
      { name: "vibe", label: "Vibe", type: "select", options: VIBE_OPTIONS, defaultValue: "" },
      { name: "scene", label: "What's in the photo", type: "text", required: true, maxLength: 200 },
      { name: "caption", label: "Example caption", type: "text", required: true, maxLength: 200 },
      { name: "is_active", label: "Used in prompts", type: "boolean", defaultValue: true },
    ],
    columns: ["vibe", "scene", "caption", "is_active"],
    orderBy: { column: "created_at", ascending: true },
    hasUpdatedAt: true,
  },
  {
    key: "models",
    table: "llm_models",
    title: "LLM models",
    singular: "model",
    description:
      "Models the caption pipeline tries, lowest priority number first; it falls back to the next one when a model is busy, out of quota or retired. Only Google (Gemini API) models are called.",
    fields: [
      { name: "provider_id", label: "Provider", type: "provider", required: true },
      {
        name: "model_id",
        label: "Model ID",
        type: "text",
        required: true,
        maxLength: 100,
        pattern: "^[a-z0-9.\\-]+$",
        patternHint: "lowercase letters, numbers, dots and dashes",
        placeholder: "e.g. gemini-flash-latest",
      },
      { name: "display_name", label: "Display name", type: "text", required: true, maxLength: 100 },
      { name: "priority", label: "Priority", type: "number", required: true, min: 0, max: 1000, defaultValue: 100 },
      {
        name: "timeout_ms",
        label: "Timeout (ms)",
        type: "number",
        required: true,
        min: 5000,
        max: 120000,
        defaultValue: 45000,
      },
      { name: "supports_images", label: "Supports images", type: "boolean", defaultValue: true },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true },
    ],
    columns: ["priority", "model_id", "display_name", "provider_id", "timeout_ms", "is_active"],
    orderBy: { column: "priority", ascending: true },
    hasUpdatedAt: true,
  },
  {
    key: "providers",
    table: "llm_providers",
    title: "LLM providers",
    singular: "provider",
    description: "Companies whose models can be used. Turning a provider off skips all of its models.",
    fields: [
      {
        name: "slug",
        label: "Slug",
        type: "text",
        required: true,
        maxLength: 40,
        lowercase: true,
        pattern: "^[a-z0-9-]+$",
        patternHint: "lowercase letters, numbers and dashes",
        placeholder: "e.g. google",
      },
      { name: "name", label: "Name", type: "text", required: true, maxLength: 100 },
      { name: "api_base_url", label: "API base URL", type: "text", maxLength: 200, pattern: "^https://.+", patternHint: "an https:// URL" },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true },
    ],
    columns: ["slug", "name", "api_base_url", "is_active"],
    orderBy: { column: "name", ascending: true },
    hasUpdatedAt: true,
  },
  {
    key: "domains",
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    singular: "domain",
    description:
      "New accounts must use an email at one of these domains (or a subdomain), or be whitelisted. Enforced by the database when Google sign-in creates the account. Existing accounts aren't affected.",
    fields: [
      {
        name: "domain",
        label: "Domain",
        type: "text",
        required: true,
        maxLength: 100,
        lowercase: true,
        pattern: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$",
        patternHint: "a domain like columbia.edu",
        placeholder: "columbia.edu",
      },
      { name: "note", label: "Note", type: "text", maxLength: 200 },
    ],
    columns: ["domain", "note"],
    orderBy: { column: "domain", ascending: true },
    hasUpdatedAt: false,
  },
  {
    key: "emails",
    table: "whitelisted_emails",
    title: "Whitelisted emails",
    singular: "email",
    description: "Individual addresses allowed to sign up even if their domain isn't on the allowed list.",
    fields: [
      {
        name: "email",
        label: "Email",
        type: "text",
        required: true,
        maxLength: 200,
        lowercase: true,
        pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
        patternHint: "an email address",
        placeholder: "someone@gmail.com",
      },
      { name: "note", label: "Note", type: "text", maxLength: 200 },
    ],
    columns: ["email", "note"],
    orderBy: { column: "email", ascending: true },
    hasUpdatedAt: false,
  },
];

export function getResource(key: string) {
  return RESOURCES.find((resource) => resource.key === key);
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

export function formatDateTime(iso: string | null) {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

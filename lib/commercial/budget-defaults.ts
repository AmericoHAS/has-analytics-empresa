import { billingFields } from "./billing";
// Only used when opening a NEW proposal. Saved proposal snapshots always win,
// including intentionally cleared fields, and are never merged with newer profile data.
export function budgetClientDefaults(
  billing: Record<string, string> | null,
  profile: Record<string, string> | null,
  request: Record<string, unknown> | null,
) {
  const intake = (request?.intake ?? {}) as Record<string, string>;
  const fallback: Record<string, string> = {
    legal_name: String(request?.name || profile?.full_name || ""),
    email: String(request?.email || profile?.email || ""),
    phone: String(request?.phone || profile?.phone || ""),
    institution: intake.institution || "",
  };
  return Object.fromEntries(
    billingFields.map(([key]) => [key, billing?.[key] ?? fallback[key] ?? ""]),
  );
}

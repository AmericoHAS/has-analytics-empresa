import { z } from "zod";
export function splitProjectTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;\n]/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}
const schema = z.object({
  project_type: z.string().trim().max(80),
  publication_status: z.string().trim().max(120),
  availability: z.string().trim().max(200),
  researchers: z.array(z.string().min(2).max(180)).max(40),
});
export function parseProjectMetadata(form: FormData) {
  return schema.safeParse({
    project_type: String(form.get("projectType") ?? ""),
    publication_status: String(form.get("publicationStatus") ?? ""),
    availability: String(form.get("availability") ?? ""),
    researchers: splitProjectTags(String(form.get("researchers") ?? "")),
  });
}
export function safeProjectUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

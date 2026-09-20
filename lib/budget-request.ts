import { z } from "zod";

export const budgetServices = [
  "Consultoria estatística",
  "Ciência de dados e indicadores",
  "Desenvolvimento digital",
  "Comunicação e educação",
  "Quero orientação sobre meu projeto",
] as const;

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export const budgetRequestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) =>
        !value ||
        (/^[+()\d\s.-]+$/.test(value) && value.replace(/\D/g, "").length >= 10),
    ),
  service_type: z.enum(budgetServices),
  title: z.string().trim().min(5).max(180),
  description: z.string().trim().min(30).max(5000),
  desired_date: z.string().refine(validDate),
  intake: z.object({research_area:z.string().max(250).optional(),data_status:z.string().max(250).optional(),urgency:z.string().max(250).optional(),purpose:z.string().max(250).optional(),delivery_model:z.string().max(250).optional(),department:z.string().max(250).optional()}).default({}),
  consent: z.literal(true),
  website: z.string().max(0),
});

export function budgetRequestRecord(
  input: z.infer<typeof budgetRequestSchema>,
) {
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    service_type: input.service_type,
    title: input.title,
    description: `${input.description}\n\n[Solicita orçamento e acesso à área do cliente. Autoriza contato sobre esta demanda.]`,
    desired_date: input.desired_date || null,
    intake: input.intake,
    status: "nova",
  };
}

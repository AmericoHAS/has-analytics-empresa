import { z } from "zod";
export const budgetInput = z.object({
  publicationPartnership: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  requestId: z.union([z.string().uuid(), z.literal("")]).default(""),
  paymentTerms: z.string().max(3000).default(""),
  finalDueDate: z.union([z.string().date(), z.literal("")]).default(""),
  dataAssessment: z.string().max(3000).default(""),
  complexity: z.string().max(200).default(""),
  internalNotes: z.string().max(15000).default(""),
  department: z.string().max(250).default(""),
  estimatedHours: z.coerce.number().min(0).max(100000).default(0),
  baseValue: z.coerce.number().min(0).max(10000000).default(0),
  additions: z.coerce.number().min(0).max(10000000).default(0),
  clientId: z.string().uuid(),
  projectId: z.union([z.string().uuid(), z.literal("")]),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(15000),
  notes: z.string().max(15000),
  validUntil: z.union([z.string().date(), z.literal("")]),
  discountPercent: z.coerce.number().finite().min(0).max(100),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(3000),
        quantity: z.number().finite().positive().max(100000).multipleOf(0.01),
        unitPrice: z.number().finite().min(0).max(1000000).multipleOf(0.01),
      }),
    )
    .min(1)
    .max(100),
});

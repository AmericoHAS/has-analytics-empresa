import { z } from "zod";
export const billingFields = [["legal_name","Nome completo / razão social"],["tax_id","CPF / CNPJ"],["email","E-mail para documentos"],["phone","WhatsApp"],["address","Endereço completo (rua, número e complemento)"],["city","Cidade"],["state","UF"],["postal_code","CEP"],["institution","Instituição (opcional)"],["representative","Representante legal, se aplicável (opcional)"]] as const;
export const billingSchema = z.object({
 legal_name:z.string().trim().min(2).max(180), tax_id:z.string().transform(s=>s.replace(/\D/g," ").replace(/ /g,"")).refine(s=>s.length===11 || s.length===14,"Informe CPF ou CNPJ"),
 email:z.string().trim().email().max(254),phone:z.string().trim().min(10).max(30),address:z.string().trim().min(5).max(350),city:z.string().trim().min(2).max(120),state:z.string().trim().length(2).transform(s=>s.toUpperCase()),postal_code:z.string().transform(s=>s.replace(/\D/g,"")).refine(s=>s.length===8),institution:z.string().trim().max(200),representative:z.string().trim().max(180),
});
export type Billing = z.infer<typeof billingSchema>;

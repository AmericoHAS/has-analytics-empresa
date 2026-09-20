"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { billingSchema } from "@/lib/commercial/billing";
export async function saveBilling(clientId:string,form:FormData) {
 try {
  z.string().uuid().parse(clientId);
  const data=billingSchema.parse(Object.fromEntries(form));
  const db=await createClient(); const {data:{user}}=await db.auth.getUser();
  if(!user) throw Error("Entre novamente.");
  if(user.id!==clientId){const {data:p}=await db.from("profiles").select("role").eq("id",user.id).single();if(p?.role!=="admin")throw Error("Acesso restrito.");}
  const {error}=await db.from("client_billing_profiles").upsert({...data,client_id:clientId,updated_at:new Date().toISOString()});
  if(error)throw Error("Não foi possível salvar. Confira se a atualização comercial foi aplicada no Supabase.");
  return {success:true,message:"Dados para documentos atualizados."};
 }catch(e){return {success:false,message:e instanceof z.ZodError?"Confira nome, CPF/CNPJ, contato e endereço.":e instanceof Error?e.message:"Não foi possível salvar."};}
}

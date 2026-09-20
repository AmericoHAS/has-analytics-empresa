"use client";
import { useEffect,useState } from "react";
import { supabase } from "@/lib/supabase";
import { billingFields } from "@/lib/commercial/billing";
import { saveBilling } from "@/app/admin/billing-actions";
export default function ClientProfile({clientId,admin=false,expanded=false}:{clientId:string;admin?:boolean;expanded?:boolean}) {
 const [data,setData]=useState<Record<string,string>|null>(null),[ready,setReady]=useState(false),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let alive=true; supabase.from("client_billing_profiles").select("*").eq("client_id",clientId).maybeSingle().then(({data,error})=>{if(!alive)return;setReady(true);if(error)setMessage("Cadastro para documentos indisponível. A atualização comercial do Supabase precisa ser aplicada.");else{setData(data);setEditing(!data&&!admin);}});return()=>{alive=false};},[clientId,admin]);
 if(!ready)return <p>Conferindo cadastro para documentos…</p>;
 if(!expanded&&!editing&&data)return null;
 return <section className="workspace-card stack">
 <h2>Dados para orçamentos e contratos</h2>
 <p>Informe seus dados de identificação e contato. Eles ficam na sua área privada e serão usados nos documentos do atendimento.</p>
 {!data&&!editing&&!expanded&&<button className="btn" onClick={()=>setEditing(true)}>Completar cadastro do cliente</button>}
 {(expanded||editing)&&<form className="stack" onSubmit={async e=>{e.preventDefault();setBusy(true);const form=new FormData(e.currentTarget);try{const result=await saveBilling(clientId,form);setMessage(result.message);if(result.success){setData(Object.fromEntries(form) as Record<string,string>);setEditing(false);}}catch{setMessage("Falha de conexão. Tente novamente.");}finally{setBusy(false);}}}>
 <div className="form-grid">{billingFields.map(([key,label])=><label key={key}>{label}<input name={key} type={key==="email"?"email":"text"} required={!["institution","representative"].includes(key)} maxLength={key==="state"?2:key==="tax_id"?18:350} autoComplete={key==="email"?"email":key==="phone"?"tel":undefined} defaultValue={data?.[key]??""}/></label>)}</div>
 <button className="btn primary" disabled={busy}>{busy?"Salvando…":"Salvar dados"}</button>
 {!expanded&&<button type="button" className="btn" onClick={()=>setEditing(false)}>Preencher depois</button>}
 </form>}
 <p role="status">{message}</p>
 </section>;
}

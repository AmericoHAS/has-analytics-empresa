import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Footer, PageNumber } from "docx";
export type DocumentSnapshot = {
 reference:string;kind:"orcamento"|"contrato";title:string;body:string;created:string;
 client:Record<string,string>;provider:Record<string,string>;
 budget:{number:string;description:string;notes:string;subtotal:number;discount:number;total:number;payment:string;due:string;validity:string;};
 items:{description:string;quantity:number;unit_price:number}[];
};
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const dateLabel=(value:string)=> /^\d{4}-\d{2}-\d{2}$/.test(value)?value.split("-").reverse().join("/"):value;
export function documentLines(s:DocumentSnapshot) {
 return [s.kind==="contrato"?"CONTRATO DE PRESTAÇÃO DE SERVIÇOS":"PROPOSTA COMERCIAL",s.title,`Referência: ${s.budget.number} | Versão: ${s.reference}`,`Emissão: ${s.created}`,"",
 "PRESTADOR",`${s.provider.provider_name||"HAS Analytics — identificação a completar"}`,`CPF/CNPJ: ${s.provider.provider_tax_id||"A completar"}`,s.provider.provider_address||"Endereço a completar",s.provider.provider_contact||"","",
 "CLIENTE",s.client.legal_name,`CPF/CNPJ: ${s.client.tax_id}`,`${s.client.address} — ${s.client.city}/${s.client.state} — CEP ${s.client.postal_code}`,`${s.client.email} | ${s.client.phone}`,s.client.institution||"",s.client.representative?`Representante: ${s.client.representative}`:"","",
 "ESCOPO E ITENS",s.budget.description,...s.items.map((item,i)=>`${i+1}. ${item.description}
Quantidade: ${item.quantity} | Unitário: ${money(item.unit_price)} | Item: ${money(Math.round(item.quantity*item.unit_price*100)/100)}`),"",
 `Subtotal: ${money(s.budget.subtotal)}`,`Desconto: ${s.budget.discount}%`, `VALOR FINAL: ${money(s.budget.total)}`,`Pagamento: ${s.budget.payment||"A combinar"}`,`Prazo final: ${dateLabel(s.budget.due)||"A combinar"}`,`Validade da proposta: ${dateLabel(s.budget.validity)||"A combinar"}`,"",
 "CONDIÇÕES E OBSERVAÇÕES",s.budget.notes,s.body,"",
 ...(s.kind==="contrato"?["ASSINATURAS","Prestador: __________________________________________","Cliente / representante: ______________________________","A assinatura eletrônica deve ser realizada sobre este PDF. Não altere o arquivo após a assinatura."]:[])
 ].flatMap(line=>line.split(/\r?\n/));
}
export async function renderCommercial(s:DocumentSnapshot) {
 const lines=documentLines(s);
 const pdf=await PDFDocument.create();
 pdf.setTitle(s.title);pdf.setAuthor("HAS Analytics");
 const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 for(const line of lines){try{font.encodeText(line);}catch{throw Error("Há um caractere não compatível no texto do PDF. Remova emojis ou símbolos especiais e gere novamente.");}}
 let page=pdf.addPage([595.28,841.89]),y=760;
 const header=()=>{page.drawRectangle({x:0,y:792,width:595.28,height:50,color:rgb(.02,.12,.24)});page.drawText("HAS Analytics",{x:45,y:811,size:18,font:bold,color:rgb(1,1,1)});};header();
 for(const line of lines){
  const heading=line.length>0&&line===line.toUpperCase()&&line.length<65;
  const face=heading?bold:font,size=heading?11:10.5;
  let chunk=""; const chunks:string[]=[];
  // Character wrapping also handles long URLs / identifiers without overflowing.
  for(const char of line){if(face.widthOfTextAtSize(chunk+char,size)>500&&chunk){const cut=chunk.lastIndexOf(" ");if(cut>20){chunks.push(chunk.slice(0,cut));chunk=chunk.slice(cut+1)+char;}else{chunks.push(chunk);chunk=char;}}else chunk+=char;}
  chunks.push(chunk);
  for(const text of chunks){if(y<65){page=pdf.addPage([595.28,841.89]);y=760;header();}if(text)page.drawText(text,{x:45,y,size,font:face,color:rgb(.04,.15,.25)});y-=16;}
  y-=4;
 }
 const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText(`HAS Analytics | ${s.reference} | ${i+1}/${pages.length}`,{x:45,y:30,size:8,font,color:rgb(.35,.42,.48)}));
 const word=new Document({creator:"HAS Analytics",title:s.title,sections:[{properties:{page:{margin:{top:900,right:900,bottom:900,left:900}}},footers:{default:new Footer({children:[new Paragraph({children:[new TextRun("HAS Analytics | "),new TextRun({children:[PageNumber.CURRENT]})]})]})},children:lines.map((line,i)=>new Paragraph({heading:i===0?HeadingLevel.TITLE:line&&line===line.toUpperCase()&&line.length<65?HeadingLevel.HEADING_2:undefined,spacing:{after:140},children:[new TextRun({text:line,font:"Calibri",size:22})]}))}]});
 return {pdf:Buffer.from(await pdf.save()),word:await Packer.toBuffer(word)};
}

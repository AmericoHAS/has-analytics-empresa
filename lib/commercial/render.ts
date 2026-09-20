import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Footer,
  PageNumber,
} from "docx";
export type DocumentSnapshot = {
  reference: string;
  kind: "orcamento" | "contrato";
  title: string;
  body: string;
  created: string;
  client: Record<string, string>;
  provider: Record<string, string>;
  budget: {
    number: string;
    description: string;
    notes: string;
    subtotal: number;
    discount: number;
    total: number;
    payment: string;
    due: string;
    validity: string;
  };
  items: { description: string; quantity: number; unit_price: number }[];
};
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
const dateLabel = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join("/")
    : value;
export function documentLines(s: DocumentSnapshot) {
  return [
    s.kind === "contrato"
      ? "CONTRATO DE PRESTAÇÃO DE SERVIÇOS"
      : "PROPOSTA COMERCIAL",
    s.title,
    `Referência: ${s.budget.number} | Versão: ${s.reference}`,
    `Emissão: ${s.created}`,
    "",
    "PRESTADOR",
    `${s.provider.provider_name || "HAS Analytics — identificação a completar"}`,
    `CPF/CNPJ: ${s.provider.provider_tax_id || "A completar"}`,
    s.provider.provider_address || "Endereço a completar",
    s.provider.provider_contact || "",
    "",
    "CLIENTE",
    s.client.legal_name,
    `CPF/CNPJ: ${s.client.tax_id}`,
    `${s.client.address} — ${s.client.city}/${s.client.state} — CEP ${s.client.postal_code}`,
    `${s.client.email} | ${s.client.phone}`,
    s.client.institution || "",
    s.client.representative ? `Representante: ${s.client.representative}` : "",
    "",
    "ESCOPO E ITENS",
    s.budget.description,
    ...s.items.map(
      (item, i) => `${i + 1}. ${item.description}
Quantidade: ${item.quantity} | Unitário: ${money(item.unit_price)} | Item: ${money(Math.round(item.quantity * item.unit_price * 100) / 100)}`,
    ),
    "",
    `Subtotal: ${money(s.budget.subtotal)}`,
    `Desconto: ${s.budget.discount}%`,
    `VALOR FINAL: ${money(s.budget.total)}`,
    `Pagamento: ${s.budget.payment || "A combinar"}`,
    `Prazo final: ${dateLabel(s.budget.due) || "A combinar"}`,
    `Validade da proposta: ${dateLabel(s.budget.validity) || "A combinar"}`,
    "",
    "CONDIÇÕES E OBSERVAÇÕES",
    s.budget.notes,
    s.body,
    "",
    ...[
      "ASSINATURAS",
      "Prestador: __________________________________________",
      "Cliente / representante: ______________________________",
      "A assinatura eletrônica deve ser realizada sobre este PDF. Não altere o arquivo após a assinatura.",
    ],
  ].flatMap((line) => line.split(/\r?\n/));
}
export async function renderCommercial(s: DocumentSnapshot) {
  const lines = documentLines(s);
  const pdf = await PDFDocument.create();
  pdf.setTitle(s.title);
  pdf.setAuthor("HAS Analytics");
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const line of lines) {
    try {
      font.encodeText(line);
    } catch {
      throw Error(
        "Há um caractere não compatível no texto do PDF. Remova emojis ou símbolos especiais e gere novamente.",
      );
    }
  }
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  try {
    logo = await pdf.embedPng(
      await readFile(join(process.cwd(), "public", "logo-has.analytics.png")),
    );
  } catch {
    /* Text identity remains when an optional brand asset is unavailable. */
  }
  const navy = rgb(0.025, 0.105, 0.2),
    cyan = rgb(0, 0.62, 0.76),
    ink = rgb(0.08, 0.18, 0.27),
    muted = rgb(0.36, 0.45, 0.53);
  let page = pdf.addPage([595.28, 841.89]),
    y = 718;
  const header = () => {
    page.drawRectangle({
      x: 0,
      y: 756,
      width: 595.28,
      height: 86,
      color: navy,
    });
    page.drawRectangle({ x: 0, y: 753, width: 595.28, height: 3, color: cyan });
    if (logo) page.drawImage(logo, { x: 42, y: 767, width: 62, height: 62 });
    page.drawText("HAS Analytics", {
      x: logo ? 118 : 45,
      y: 803,
      size: 21,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText("Estatística | Bioestatística | Ciência de Dados", {
      x: logo ? 118 : 45,
      y: 782,
      size: 9,
      font,
      color: rgb(0.65, 0.83, 0.91),
    });
  };
  header();
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    y = 718;
    header();
  };
  const wrap = (text: string, size: number, width = 495, face = font) => {
    let chunk = "";
    const chunks: string[] = [];
    for (const char of text) {
      if (face.widthOfTextAtSize(chunk + char, size) > width && chunk) {
        const cut = chunk.lastIndexOf(" ");
        if (cut > 15) {
          chunks.push(chunk.slice(0, cut));
          chunk = chunk.slice(cut + 1) + char;
        } else {
          chunks.push(chunk);
          chunk = char;
        }
      } else chunk += char;
    }
    chunks.push(chunk);
    return chunks;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line) {
      y -= 8;
      continue;
    }
    const total = line.startsWith("VALOR FINAL:"),
      section = [
        "PRESTADOR",
        "CLIENTE",
        "ESCOPO E ITENS",
        "CONDIÇÕES E OBSERVAÇÕES",
        "ASSINATURAS",
      ].includes(line);
    const heading = index === 0 || section;
    const face = heading || total ? bold : font,
      size = index === 0 ? 18 : total ? 16 : section ? 10 : 10;
    const chunks = wrap(line, size, 485, face);
    const needed = chunks.length * 14 + (section ? 32 : total ? 35 : 6);
    if (y - Math.min(needed, 650) < 62 || (section && y < 150)) newPage();
    if (section) {
      y -= 8;
      page.drawRectangle({
        x: 42,
        y: y - 9,
        width: 510,
        height: 28,
        color: rgb(0.93, 0.96, 0.98),
      });
      page.drawRectangle({
        x: 42,
        y: y - 9,
        width: 3,
        height: 28,
        color: cyan,
      });
    }
    if (total) {
      y -= 24;
      page.drawRectangle({
        x: 42,
        y: y - 12,
        width: 510,
        height: 38,
        color: navy,
      });
    }
    for (const text of chunks) {
      if (y < 62) newPage();
      page.drawText(text, {
        x: section || total ? 55 : 45,
        y,
        size,
        font: face,
        color: total ? rgb(1, 1, 1) : index === 2 || index === 3 ? muted : ink,
      });
      y -= 14;
    }
    if (section) y -= 17;
    else if (total) y -= 19;
    else y += 0;
    if (line.startsWith("Quantidade:")) {
      page.drawLine({
        start: { x: 45, y: y - 3 },
        end: { x: 550, y: y - 3 },
        thickness: 0.5,
        color: rgb(0.85, 0.9, 0.94),
      });
      y -= 13;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`HAS Analytics | ${s.reference} | ${i + 1}/${pages.length}`, {
      x: 45,
      y: 30,
      size: 8,
      font,
      color: rgb(0.35, 0.42, 0.48),
    }),
  );
  const word = new Document({
    creator: "HAS Analytics",
    title: s.title,
    sections: [
      {
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun("HAS Analytics | "),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: lines.map(
          (line, i) =>
            new Paragraph({
              heading:
                i === 0
                  ? HeadingLevel.TITLE
                  : line && line === line.toUpperCase() && line.length < 65
                    ? HeadingLevel.HEADING_2
                    : undefined,
              spacing: { after: 140 },
              children: [
                new TextRun({ text: line, font: "Calibri", size: 22 }),
              ],
            }),
        ),
      },
    ],
  });
  return {
    pdf: Buffer.from(await pdf.save()),
    word: await Packer.toBuffer(word),
  };
}

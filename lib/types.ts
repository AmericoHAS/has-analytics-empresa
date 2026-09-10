export type Project = { id?: string; titulo: string; categoria: string; grupo: string; data: string; status: string; tipo: string; imagem: string; seloImagem?: string; descricao: string; detalhes: string; tecnologias: string[]; link: string; textoLink: string };
export type Comment = { id: string; author_name: string; author_role?: string; content: string; created_at: string };
export type ClientDocument = { id: string; title: string; kind: "orcamento"|"contrato"|"recibo"|"relatorio"|"arquivo"; status: string; file_url?: string; created_at: string };

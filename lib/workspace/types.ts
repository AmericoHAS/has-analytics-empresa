export type AnalysisProject = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  stage: string;
  deliverables: string | null;
  client_due_date: string | null;
};
export type Task = {
  id: string;
  project_id: string;
  title: string;
  done: boolean;
  display_order: number;
};
export type PrivateProject = {
  project_id: string;
  admin_notes: string;
  department: string;
  research_area: string;
  data_assessment: string;
  complexity: string;
  estimated_hours: number;
  responsible: string;
};
export type Doc = {
  id: string;
  client_id: string;
  project_id: string | null;
  title: string;
  kind: string;
  status: string;
  storage_path: string | null;
  created_at: string;
  uploaded_by: string | null;
  uploader_role: string;
  original_name: string | null;
  file_size: number | null;
  requires_signature: boolean;
  signed_at: string | null;
};
export const projectColumns =
  "id,client_id,title,description,status,progress,start_date,due_date,created_at,updated_at,stage,deliverables,client_due_date";
export const stages = [
  "Recebimento e escopo",
  "Organização do banco",
  "Análise estatística",
  "Relatório e revisão",
  "Entrega e suporte",
];
export const statusLabels: Record<string, string> = {
  solicitado: "Solicitado",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  em_revisao: "Em revisão",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

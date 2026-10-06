import type {
  Cargo, CanalVenda, EtapaLead, OrigemLead, StatusCliente, StatusDevolucao, StatusEvento,
  StatusReclamacao, TipoCliente, TipoEvento, FormatoCriativo, Prioridade, StatusCampanha, StatusPedido,
} from './types'

export const CARGO: Record<Cargo, string> = {
  vendedora: 'Vendedora',
  representante: 'Representante',
  analista: 'Analista Comercial',
}

export const STATUS_CLIENTE: Record<StatusCliente, string> = {
  ativa: 'Ativa',
  em_queda: 'Vai cair',
  encerrada: 'Encerrada',
}

export const TIPO_CLIENTE: Record<TipoCliente, string> = {
  revenda: 'Revenda',
  loja_multimarca: 'Loja multimarca',
  consultora: 'Consultora',
}

export const CANAL: Record<CanalVenda, string> = {
  showroom: 'Showroom',
  representante: 'Representante',
  online: 'Online / WhatsApp',
  evento: 'Evento',
}

export const STATUS_PEDIDO: Record<StatusPedido, string> = {
  faturado: 'Faturado',
  pendente: 'Pendente',
  cancelado: 'Cancelado',
}

export const STATUS_DEVOLUCAO: Record<StatusDevolucao, string> = {
  solicitada: 'Solicitada',
  em_analise: 'Em análise',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  concluida: 'Concluída',
}

export const STATUS_RECLAMACAO: Record<StatusReclamacao, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  resolvida: 'Resolvida',
}

export const PRIORIDADE: Record<Prioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

export const TIPO_EVENTO: Record<TipoEvento, string> = {
  lancamento: 'Lançamento de coleção',
  feira: 'Feira / Pop-up',
  workshop: 'Workshop / Treinamento',
  encontro_revendas: 'Encontro de revendas',
  live: 'Live / Digital',
  atendimento_vip: 'Atendimento VIP',
  outro: 'Outro',
}

export const STATUS_EVENTO: Record<StatusEvento, string> = {
  planejado: 'Planejado',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const ORIGEM_LEAD: Record<OrigemLead, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  prospeccao: 'Prospecção fria',
  indicacao: 'Indicação',
  evento: 'Evento',
  organico: 'Orgânico / Site',
}

export const ETAPA_LEAD: Record<EtapaLead, string> = {
  novo: 'Novo lead',
  contato: 'Primeiro contato',
  qualificado: 'Qualificado',
  proposta: 'Proposta / Catálogo',
  negociacao: 'Negociação',
  ganho: 'Virou revenda',
  perdido: 'Perdido',
}

export const ETAPAS_FUNIL: EtapaLead[] = ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'ganho']

export const STATUS_CAMPANHA: Record<StatusCampanha, string> = { ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' }

export const FORMATO: Record<FormatoCriativo, string> = {
  imagem: 'Imagem estática',
  carrossel: 'Carrossel',
  video: 'Vídeo',
  reels: 'Reels',
  stories: 'Stories',
  pesquisa: 'Pesquisa (texto)',
  display: 'Display',
}

export const MOTIVOS_DEVOLUCAO = [
  'Defeito de fabricação',
  'Banho / oxidação',
  'Peça trocada no envio',
  'Avaria no transporte',
  'Baixo giro (troca de mix)',
  'Arrependimento',
]

export const CATEGORIAS_RECLAMACAO = [
  'Qualidade da peça',
  'Prazo de entrega',
  'Atendimento',
  'Cobrança / financeiro',
  'Embalagem',
  'Divergência no pedido',
]

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export const REGIOES = [
  'Capital SP — Zona Sul',
  'Capital SP — Zona Oeste',
  'Capital SP — Zona Norte',
  'Capital SP — Zona Leste',
  'Capital SP — Centro',
  'Grande SP',
  'Campinas e região',
  'Vale do Paraíba / Litoral Norte',
  'Baixada Santista',
  'Interior — Ribeirão Preto',
  'Interior — Sorocaba',
  'Interior — Oeste Paulista',
  'Sul de Minas',
  'Outros estados',
]

// Modelo de dados da plataforma de gestão do Showroom Maria Dolores SP.
// Todas as datas são strings ISO (AAAA-MM-DD) para facilitar persistência e exportação.

export type Cargo = 'vendedora' | 'representante' | 'analista'

export interface Colaborador {
  id: string
  nome: string
  cargo: Cargo
  regiao: string
  email: string
  telefone: string
  metaMensal: number // meta de faturamento mensal (R$)
  metaAtivacao: number // fração da carteira a ativar (0.7 = 70%)
  ativo: boolean
}

export type StatusCliente = 'ativa' | 'em_queda' | 'encerrada'
export type TipoCliente = 'revenda' | 'loja_multimarca' | 'consultora'
export type Curva = 'A' | 'B' | 'C'

export interface Cliente {
  id: string
  codigo?: string // código no sistema B2B (usado para atualizar sem duplicar)
  nome: string // nome fantasia / da revenda
  responsavelNome: string // pessoa de contato
  documento: string
  tipo: TipoCliente
  cidade: string
  uf: string
  regiao: string
  telefone: string
  email: string
  instagram: string
  responsavelId: string // colaborador que atende
  status: StatusCliente
  dataCadastro: string
  aniversario?: string // MM-DD, para ações de relacionamento
  limiteCredito: number
  // Revenda que vai "cair" (encerramento previsto)
  quedaData?: string
  quedaMotivo?: string
  /** Mantida apesar de estar sem compra: não entra na queda automática até esta data. */
  quedaDispensadaAte?: string
  observacoes?: string
  /** Endereço da loja (referência para o raio de atuação). */
  endereco?: string
  /** Localização "lat, lng" ou link do Google Maps — base do raio de atuação na capital. */
  localizacao?: string
  /** Data exata da última compra vinda do BI (os pedidos importados do BI são mensais). */
  ultimaCompraBI?: string
  // Ficha da revendedora (para ninguém chegar ao showroom sem ser conhecida)
  publicoFinal?: string
  oQueGira?: string
  preferencias?: string
  proximoPasso?: string
}

export type CanalVenda = 'showroom' | 'representante' | 'online' | 'evento'
export type StatusPedido = 'faturado' | 'pendente' | 'cancelado'

export interface Pedido {
  id: string
  codigo?: string // código no sistema B2B (usado para atualizar sem duplicar)
  clienteId: string
  responsavelId: string
  data: string
  valor: number
  pecas: number
  canal: CanalVenda
  colecao: string
  eventoId?: string
  status: StatusPedido
}

export type StatusDevolucao = 'solicitada' | 'em_analise' | 'aprovada' | 'recusada' | 'concluida'

export interface Devolucao {
  id: string
  codigo?: string // código no sistema B2B (usado para atualizar sem duplicar)
  clienteId: string
  pedidoId?: string
  data: string
  valor: number
  pecas: number
  motivo: string
  status: StatusDevolucao
  observacoes?: string
}

export type StatusReclamacao = 'aberta' | 'em_andamento' | 'resolvida'
export type Prioridade = 'baixa' | 'media' | 'alta'

export interface Reclamacao {
  id: string
  clienteId: string
  data: string
  categoria: string
  descricao: string
  prioridade: Prioridade
  status: StatusReclamacao
  responsavelId: string
  resolvidaEm?: string
  solucao?: string
}

export interface Titulo {
  id: string
  codigo?: string // código no sistema B2B (usado para atualizar sem duplicar)
  clienteId: string
  pedidoId?: string
  emissao: string
  vencimento: string
  valor: number
  valorPago: number
  formaPagamento: string
  observacoes?: string
}

export interface Brinde {
  id: string
  nome: string
  categoria: string
  estoque: number
  estoqueMinimo: number
  custoUnitario: number
  regraConcessao: string
}

export interface MovimentoBrinde {
  id: string
  brindeId: string
  data: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  clienteId?: string
  eventoId?: string
  motivo: string
}

export type TipoEvento = 'lancamento' | 'feira' | 'workshop' | 'encontro_revendas' | 'live' | 'atendimento_vip' | 'outro'
export type StatusEvento = 'planejado' | 'confirmado' | 'realizado' | 'cancelado'

export interface Evento {
  id: string
  titulo: string
  tipo: TipoEvento
  dataInicio: string
  dataFim: string
  horario: string
  local: string
  colecao: string
  responsavelId: string
  status: StatusEvento
  metaFaturamento: number
  metaClientes: number
  custo: number // investimento total (buffet, decoração, brindes, convites)
  convidados: number
  // Resultado (preenchido após o evento)
  clientesPresentes?: number
  revendasIds?: string[] // revendas que compraram/participaram
  novosCadastros?: number
  leadsGerados?: number
  faturamentoEvento?: number // vendas fechadas no evento (pedidos não lançados no sistema)
  pecasVendidas?: number
  nps?: number // 0-10
  aprendizados?: string
}

export type OrigemLead = 'meta' | 'google' | 'prospeccao' | 'indicacao' | 'evento' | 'organico'
export type EtapaLead = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'negociacao' | 'ganho' | 'perdido'

export interface Lead {
  id: string
  codigo?: string // código no sistema B2B (usado para atualizar sem duplicar)
  nome: string
  empresa: string
  cidade: string
  uf: string
  telefone: string
  email: string
  origem: OrigemLead
  campanhaId?: string
  criativoId?: string
  etapa: EtapaLead
  responsavelId: string
  dataEntrada: string
  ultimaInteracao: string
  proximoPasso?: string
  valorPotencial: number
  motivoPerda?: string
  rdStationId?: string
  endereco?: string
  /** Localização "lat, lng" ou link do Google Maps (verificação do raio na capital). */
  localizacao?: string
}

export type Plataforma = 'meta' | 'google'
export type StatusCampanha = 'ativa' | 'pausada' | 'encerrada'

export interface Campanha {
  id: string
  nome: string
  plataforma: Plataforma
  objetivo: string
  publico: string
  status: StatusCampanha
  inicio: string
  fim?: string
  orcamentoMensal: number
}

export type FormatoCriativo = 'imagem' | 'carrossel' | 'video' | 'reels' | 'stories' | 'pesquisa' | 'display'

export interface Criativo {
  id: string
  campanhaId: string
  nome: string
  formato: FormatoCriativo
  headline: string
  copy: string
  link?: string // link do criativo (Drive, Meta Ads Library, etc.)
  impressoes: number
  cliques: number
  leads: number
  conversoes: number // leads que viraram revenda
  investido: number
  ativo: boolean
}

export interface TerritorioBloqueio {
  id: string
  cidade: string
  uf: string
  regiao: string
  tipo: 'bloqueada' | 'reservada' | 'prioritaria'
  motivo: string
  ate?: string
}

export interface Visita {
  id: string
  clienteId?: string
  leadId?: string
  nomeVisitante: string
  data: string
  horario: string
  responsavelId: string
  objetivo: string
  status: 'agendada' | 'realizada' | 'cancelada' | 'no_show'
  resultado?: string
}

export interface Tarefa {
  id: string
  titulo: string
  responsavelId: string
  prazo: string
  concluida: boolean
  relacionado?: string
}

export interface Configuracoes {
  nomeUnidade: string
  metaFaturamentoMensal: number
  metaAtivacao: number
  investimentoMidiaMensal: number
  divisaoMeta: number // fração do investimento para Meta (0.5)
  diasInatividadeAlerta: number
  raioExclusividadeKm: number
  /** Dias sem compra para a revenda perder a exclusividade (queda automática). */
  diasSemCompraQueda?: number
  colecaoAtual: string
  // Raio de atuação em SP capital, revisto pelas compras dos últimos meses fechados
  raioCapitalCheioKm?: number
  raioCapitalMedioKm?: number
  raioCapitalMinimoKm?: number
  raioCapitalLimiteMedio?: number
  raioCapitalLimiteCheio?: number
  raioCapitalMeses?: number
}

export type TipoAtendimento = 'showroom' | 'whatsapp' | 'ligacao' | 'visita_rep' | 'evento' | 'email'
export type ResultadoAtendimento = 'pedido' | 'sem_pedido' | 'agendou' | 'sem_retorno'

/** Registro de contato com a revendedora. O próximo contato vira o follow-up. */
export interface Atendimento {
  id: string
  clienteId: string
  responsavelId: string
  data: string
  tipo: TipoAtendimento
  resultado: ResultadoAtendimento
  resumo: string
  proximoContato?: string
  proximoPasso?: string
}

export interface Database {
  config: Configuracoes
  colaboradores: Colaborador[]
  clientes: Cliente[]
  pedidos: Pedido[]
  devolucoes: Devolucao[]
  reclamacoes: Reclamacao[]
  titulos: Titulo[]
  brindes: Brinde[]
  movBrindes: MovimentoBrinde[]
  eventos: Evento[]
  leads: Lead[]
  campanhas: Campanha[]
  criativos: Criativo[]
  territorios: TerritorioBloqueio[]
  visitas: Visita[]
  tarefas: Tarefa[]
  atendimentos: Atendimento[]
}

export type Colecao = Exclude<keyof Database, 'config'>

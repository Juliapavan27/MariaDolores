// Leitura da carteira por grupos de revendedoras, prioridades da semana e
// indicadores de relacionamento (follow-up, conversão, reativação, concentração).
import type { Atendimento, Cliente, Database, Pedido } from '../data/types'
import { addDays, diffDays, inRange, today, type Periodo } from './dates'
import { carteira, pedidosValidos } from './metrics'
import { safeDiv } from './format'

export type Grupo = 'recorrente' | 'potencial' | 'risco' | 'inativa' | 'nova'

/** O que fazer com cada grupo — a mesma régua para toda a equipe. */
export const GRUPOS: Record<Grupo, { titulo: string; verbo: string; objetivo: string; cadencia: string; dono: string; indicador: string; acoes: string[] }> = {
  recorrente: {
    titulo: 'Compram com frequência', verbo: 'Proteger e aprofundar', objetivo: 'Crescer junto, sem tratá-la como garantida',
    cadencia: 'Antes de cada lançamento e 15 dias após o pedido', dono: 'Vendedora dona da carteira', indicador: 'Recorrência, ticket e mix',
    acoes: ['Pré-seleção pelo histórico', 'Acesso antecipado às novidades', 'Peças de maior valor quando fazem sentido', 'Atenção a sinais de esfriamento'],
  },
  potencial: {
    titulo: 'Potencial, ticket baixo', verbo: 'Entender e desenvolver', objetivo: 'Descobrir por que compra pouco antes de oferecer mais',
    cadencia: 'Plano individual, contato quinzenal', dono: 'Vendedora, com acompanhamento da coordenação', indicador: 'Ticket, frequência e mix',
    acoes: ['Conhecer a loja e o público final', 'Identificar o que trava a compra', 'Sugestão de mix com argumento de giro', 'Apoio à venda na ponta'],
  },
  risco: {
    titulo: 'Esfriando (60 a 90 dias)', verbo: 'Agir antes de perder', objetivo: 'Retomar o contato antes que vire inativa',
    cadencia: 'Contato pessoal nesta semana', dono: 'Quem conhece a história dela', indicador: 'Clientes em risco que voltaram a comprar',
    acoes: ['Rever a última compra antes de ligar', 'Perguntar como as peças giraram', 'Levar pré-seleção da coleção atual', 'Combinar a data do próximo contato'],
  },
  inativa: {
    titulo: 'Mais de 90 dias', verbo: 'Priorizar e reconquistar', objetivo: 'Entender por que parou e voltar com um bom motivo',
    cadencia: 'Contato pessoal, nunca em massa', dono: 'Quem conhece a história dela', indicador: 'Funil de reativação',
    acoes: ['Ordenar por valor histórico e potencial', 'Rever a última compra antes do contato', 'Perguntar o que mudou e registrar', 'Convite com pré-seleção da nova coleção'],
  },
  nova: {
    titulo: 'Novas revendedoras', verbo: 'Acolher e fidelizar', objetivo: 'Fazer a primeira compra virar parceria',
    cadencia: 'Onboarding de 90 dias', dono: 'Vendedora desde o 1º atendimento', indicador: 'Segunda compra em até 90 dias',
    acoes: ['Boas-vindas com a história da marca', 'Primeira compra com curadoria', 'Conversa sobre giro em 15 e 30 dias', 'Convite para a próxima coleção'],
  },
}

export const ORDEM_GRUPOS: Grupo[] = ['recorrente', 'potencial', 'risco', 'inativa', 'nova']

export interface LeituraCliente {
  cliente: Cliente
  grupo: Grupo
  ultima?: string
  diasSemCompra: number
  pedidos: number
  fat12: number
  ticket: number
  intervaloMedio?: number
  segundaCompra: boolean
  ultimoAtendimento?: Atendimento
  followUpVencido?: Atendimento
}

function porCliente(pedidos: Pedido[]) {
  const m = new Map<string, Pedido[]>()
  pedidos.forEach((p) => m.set(p.clienteId, [...(m.get(p.clienteId) || []), p]))
  m.forEach((xs) => xs.sort((a, b) => a.data.localeCompare(b.data)))
  return m
}

export function lerCarteira(db: Database, colaboradorId?: string): LeituraCliente[] {
  const hoje = today()
  const ini12 = addDays(hoje, -365)
  const ped = porCliente(pedidosValidos(db.pedidos))
  const atend = new Map<string, Atendimento[]>()
  db.atendimentos.forEach((a) => atend.set(a.clienteId, [...(atend.get(a.clienteId) || []), a]))
  atend.forEach((xs) => xs.sort((a, b) => a.data.localeCompare(b.data)))

  const base = carteira(db, colaboradorId)
  const linhas = base.map((c) => {
    const ps = ped.get(c.id) || []
    const ultPed = ps[ps.length - 1]?.data
    const ult = c.ultimaCompraBI && (!ultPed || c.ultimaCompraBI > ultPed) ? c.ultimaCompraBI : ultPed
    const ps12 = ps.filter((p) => p.data >= ini12)
    const fat12 = ps12.reduce((s, p) => s + p.valor, 0)
    const intervalos = ps.slice(1).map((p, i) => diffDays(p.data, ps[i].data)).filter((d) => d > 0)
    const ats = atend.get(c.id) || []
    const ultAt = ats[ats.length - 1]
    return {
      cliente: c, ultima: ult, diasSemCompra: ult ? diffDays(hoje, ult) : 9999, pedidos: ps.length, fat12,
      ticket: safeDiv(fat12, ps12.length), intervaloMedio: intervalos.length ? safeDiv(intervalos.reduce((s, d) => s + d, 0), intervalos.length) : undefined,
      segundaCompra: ps.length >= 2, ultimoAtendimento: ultAt,
      followUpVencido: ultAt?.proximoContato && ultAt.proximoContato < hoje ? ultAt : undefined,
      grupo: 'recorrente' as Grupo,
    }
  })
  // ticket de referência: média das revendas ativas
  const ativas = linhas.filter((l) => l.diasSemCompra <= 60 && l.ticket > 0)
  const ticketMedio = safeDiv(ativas.reduce((s, l) => s + l.ticket, 0), ativas.length)
  linhas.forEach((l) => {
    const novata = diffDays(hoje, l.cliente.dataCadastro) <= 90
    l.grupo = novata ? 'nova'
      : l.diasSemCompra > 90 ? 'inativa'
      : l.diasSemCompra > 60 ? 'risco'
      : l.ticket < ticketMedio * 0.7 ? 'potencial'
      : 'recorrente'
  })
  return linhas
}

/** Lista de contatos da semana, na ordem combinada com a equipe. */
export function ordemDaSemana(linhas: LeituraCliente[], limite = 30) {
  const hoje = today()
  const pontos = (l: LeituraCliente) => {
    if (l.followUpVencido) return 0
    if (l.grupo === 'risco') return 1
    if (l.grupo === 'nova' && !l.segundaCompra) return 2
    if (l.grupo === 'recorrente') return 3
    if (l.grupo === 'potencial') return 4
    return 5
  }
  const motivo = (l: LeituraCliente) => {
    if (l.followUpVencido) return `Follow-up combinado para ${l.followUpVencido.proximoContato!.split('-').reverse().join('/')}: ${l.followUpVencido.proximoPasso || 'retomar contato'}`
    if (l.grupo === 'risco') return `Esfriando: ${l.diasSemCompra} dias sem comprar`
    if (l.grupo === 'nova') return l.pedidos ? 'Nova revendedora: conduzir a 2ª compra' : 'Nova revendedora: ainda não fez a 1ª compra'
    if (l.grupo === 'recorrente') return 'Recorrente: pré-seleção do próximo lançamento'
    if (l.grupo === 'potencial') return 'Potencial: entender o que trava o ticket'
    return `Inativa há ${l.diasSemCompra > 900 ? 'muito tempo' : l.diasSemCompra + ' dias'}: reconquistar com um bom motivo`
  }
  // contato recente (últimos 7 dias) sem follow-up vencido sai da lista da semana
  const recente = (l: LeituraCliente) => !!l.ultimoAtendimento && diffDays(hoje, l.ultimoAtendimento.data) <= 7 && !l.followUpVencido
  return linhas
    .filter((l) => !recente(l))
    .sort((a, b) => pontos(a) - pontos(b) || b.fat12 - a.fat12)
    .slice(0, limite)
    .map((l) => ({ ...l, motivo: motivo(l), prioridade: pontos(l) }))
}

export interface IndicadoresCarteira {
  base: number
  ativas: number
  risco: number
  inativas: number
  novas: number
  concentracaoTop10: number
  intervaloMedio: number
  reativacoes: number
  segundaCompraNovas: number
  followUpNoPrazo: number
  followUpsVencidos: number
  conversao: number
  atendimentos: number
}

export function indicadoresCarteira(db: Database, periodo: Periodo, colaboradorId?: string): IndicadoresCarteira {
  const linhas = lerCarteira(db, colaboradorId)
  const ids = new Set(linhas.map((l) => l.cliente.id))
  const ped = pedidosValidos(db.pedidos).filter((p) => ids.has(p.clienteId))
  const porCli = porCliente(ped)

  // reativação: comprou no período depois de mais de 90 dias parada
  let reativacoes = 0
  porCli.forEach((ps) => {
    const i = ps.findIndex((p) => inRange(p.data, periodo))
    if (i > 0 && diffDays(ps[i].data, ps[i - 1].data) > 90) reativacoes++
  })
  const fats = linhas.map((l) => l.fat12).sort((a, b) => b - a)
  const total = fats.reduce((s, v) => s + v, 0)
  const novas = linhas.filter((l) => diffDays(today(), l.cliente.dataCadastro) <= 180)
  const intervalos = linhas.map((l) => l.intervaloMedio).filter((x): x is number => x !== undefined)

  // follow-up no prazo: contatos combinados que venceram no período e foram feitos até 2 dias depois
  const ats = db.atendimentos.filter((a) => ids.has(a.clienteId))
  const devidos = ats.filter((a) => a.proximoContato && inRange(a.proximoContato, periodo) && a.proximoContato <= today())
  const feitos = devidos.filter((a) => ats.some((b) => b.clienteId === a.clienteId && b.data > a.data && b.data <= addDays(a.proximoContato!, 2)))
  const noPeriodo = ats.filter((a) => inRange(a.data, periodo))

  return {
    base: linhas.length,
    ativas: linhas.filter((l) => l.diasSemCompra <= 60).length,
    risco: linhas.filter((l) => l.grupo === 'risco').length,
    inativas: linhas.filter((l) => l.grupo === 'inativa').length,
    novas: linhas.filter((l) => l.grupo === 'nova').length,
    concentracaoTop10: safeDiv(fats.slice(0, 10).reduce((s, v) => s + v, 0), total),
    intervaloMedio: safeDiv(intervalos.reduce((s, v) => s + v, 0), intervalos.length),
    reativacoes,
    segundaCompraNovas: safeDiv(novas.filter((l) => l.segundaCompra).length, novas.length),
    followUpNoPrazo: safeDiv(feitos.length, devidos.length),
    followUpsVencidos: linhas.filter((l) => l.followUpVencido).length,
    conversao: safeDiv(noPeriodo.filter((a) => a.resultado === 'pedido').length, noPeriodo.length),
    atendimentos: noPeriodo.length,
  }
}

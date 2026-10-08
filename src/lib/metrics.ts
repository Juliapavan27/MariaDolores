import type { Cliente, Configuracoes, Curva, Database, Lead, Pedido, Titulo } from '../data/types'
import { addDays, addMonths, diffDays, inRange, mesesNoPeriodo, monthsBetween, startOfMonth, today, ym, type Periodo } from './dates'
import { CIDADES_ALVO } from '../data/seed'
import { ehCapitalSP, regiaoPorUF } from '../data/labels'
import { date, safeDiv } from './format'

export const pedidosValidos = (pedidos: Pedido[]) => pedidos.filter((p) => p.status === 'faturado')

export const somaValor = <T extends { valor: number }>(xs: T[]) => xs.reduce((s, x) => s + x.valor, 0)

export function pedidosNoPeriodo(db: Database, p: Periodo, colaboradorId?: string) {
  return pedidosValidos(db.pedidos).filter((x) => inRange(x.data, p) && (!colaboradorId || x.responsavelId === colaboradorId))
}

/** Carteira = revendas que ainda contam para a base (ativas + que vão cair). */
export function carteira(db: Database, colaboradorId?: string) {
  return db.clientes.filter((c) => c.status !== 'encerrada' && (!colaboradorId || c.responsavelId === colaboradorId))
}

export function ativacao(db: Database, p: Periodo, colaboradorId?: string) {
  const base = carteira(db, colaboradorId)
  const compraram = new Set(pedidosNoPeriodo(db, p).map((x) => x.clienteId))
  const ativos = base.filter((c) => compraram.has(c.id))
  return { base: base.length, ativos: ativos.length, taxa: safeDiv(ativos.length, base.length), inativos: base.filter((c) => !compraram.has(c.id)) }
}

export function metaDoPeriodo(metaMensal: number, p: Periodo) {
  return metaMensal * mesesNoPeriodo(p)
}

export function devolucoesValidas(db: Database) {
  return db.devolucoes.filter((d) => d.status === 'aprovada' || d.status === 'concluida')
}

export function ultimaCompraMap(db: Database) {
  const m = new Map<string, string>()
  pedidosValidos(db.pedidos).forEach((p) => {
    const cur = m.get(p.clienteId)
    if (!cur || p.data > cur) m.set(p.clienteId, p.data)
  })
  // a data exata do BI prevalece quando é mais recente que a do pedido mensal
  db.clientes.forEach((c) => {
    const cur = m.get(c.id)
    if (c.ultimaCompraBI && (!cur || c.ultimaCompraBI > cur)) m.set(c.id, c.ultimaCompraBI)
  })
  return m
}

/** Curva ABC pelo faturamento dos últimos 12 meses (A = 80%, B = 15%, C = 5%). */
export function curvaABC(db: Database): Map<string, Curva> {
  const ini = addMonths(today(), -12)
  const total = new Map<string, number>()
  pedidosValidos(db.pedidos).filter((p) => p.data >= ini).forEach((p) => total.set(p.clienteId, (total.get(p.clienteId) || 0) + p.valor))
  const ordered = db.clientes.map((c) => [c.id, total.get(c.id) || 0] as const).sort((a, b) => b[1] - a[1])
  const soma = ordered.reduce((s, [, v]) => s + v, 0)
  const out = new Map<string, Curva>()
  let acc = 0
  ordered.forEach(([id, v]) => {
    acc += v
    const share = safeDiv(acc - v, soma)
    out.set(id, v === 0 ? 'C' : share < 0.8 ? 'A' : share < 0.95 ? 'B' : 'C')
  })
  return out
}

export function faturamento12m(db: Database, clienteId: string) {
  const ini = addMonths(today(), -12)
  return somaValor(pedidosValidos(db.pedidos).filter((p) => p.clienteId === clienteId && p.data >= ini))
}

// ---------- Débitos ----------
export const saldo = (t: Titulo) => Math.max(0, t.valor - t.valorPago)
export const statusTitulo = (t: Titulo, hoje = today()) =>
  saldo(t) <= 0.009 ? 'pago' : t.vencimento < hoje ? 'vencido' : 'a_vencer'

export function aging(titulos: Titulo[], hoje = today()) {
  const faixas = { '1-15': 0, '16-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  titulos.forEach((t) => {
    if (statusTitulo(t, hoje) !== 'vencido') return
    const d = diffDays(hoje, t.vencimento)
    const s = saldo(t)
    if (d <= 15) faixas['1-15'] += s
    else if (d <= 30) faixas['16-30'] += s
    else if (d <= 60) faixas['31-60'] += s
    else if (d <= 90) faixas['61-90'] += s
    else faixas['90+'] += s
  })
  return faixas
}

export function debitosPorCliente(db: Database) {
  const m = new Map<string, { vencido: number; aVencer: number; maiorAtraso: number }>()
  const hoje = today()
  db.titulos.forEach((t) => {
    const st = statusTitulo(t, hoje)
    if (st === 'pago') return
    const cur = m.get(t.clienteId) || { vencido: 0, aVencer: 0, maiorAtraso: 0 }
    if (st === 'vencido') {
      cur.vencido += saldo(t)
      cur.maiorAtraso = Math.max(cur.maiorAtraso, diffDays(hoje, t.vencimento))
    } else cur.aVencer += saldo(t)
    m.set(t.clienteId, cur)
  })
  return m
}

// ---------- Séries mensais ----------
export function serieMensal(db: Database, meses = 12, colaboradorId?: string) {
  const fim = today()
  const ini = addMonths(startOfMonth(fim), -(meses - 1))
  const keys = monthsBetween(ini, fim)
  const fat = new Map(keys.map((k) => [k, 0]))
  const dev = new Map(keys.map((k) => [k, 0]))
  pedidosValidos(db.pedidos).forEach((p) => {
    if (colaboradorId && p.responsavelId !== colaboradorId) return
    const k = ym(p.data)
    if (fat.has(k)) fat.set(k, fat.get(k)! + p.valor)
  })
  devolucoesValidas(db).forEach((d) => {
    const k = ym(d.data)
    if (dev.has(k)) dev.set(k, dev.get(k)! + d.valor)
  })
  const metaMensal = colaboradorId ? db.colaboradores.find((c) => c.id === colaboradorId)?.metaMensal || 0 : db.config.metaFaturamentoMensal
  return keys.map((k) => ({ mes: k, faturamento: fat.get(k)!, devolucoes: dev.get(k)!, meta: metaMensal }))
}

// ---------- Revendas que vão cair ----------
export interface QuedaPrevista {
  cliente: Cliente
  /** Data em que a região fica livre. */
  data: string
  motivo: string
  /** true: prevista pela regra de dias sem compra; false: marcada pela equipe. */
  automatica: boolean
  diasSemCompra?: number
}

export const diasParaQueda = (c: Configuracoes) => c.diasSemCompraQueda ?? 180
/** Antecedência com que a queda automática aparece. */
const AVISO_QUEDA_DIAS = 90

/**
 * Revendas que vão cair: as marcadas pela equipe ("vai cair", com data) e as que estão há muito tempo
 * sem comprar. Pela regra, a revenda perde a exclusividade quando completa N dias sem compra
 * (Configurações) e aparece aqui 90 dias antes disso.
 */
export function quedasPrevistas(db: Database, hoje = today()): QuedaPrevista[] {
  const limite = diasParaQueda(db.config)
  const ult = ultimaCompraMap(db)
  const lista: QuedaPrevista[] = []
  db.clientes.forEach((c) => {
    if (c.status === 'em_queda') {
      lista.push({ cliente: c, data: c.quedaData || hoje, motivo: c.quedaMotivo || 'Marcada pela equipe', automatica: false })
      return
    }
    if (c.status !== 'ativa' || (c.quedaDispensadaAte && c.quedaDispensadaAte >= hoje)) return
    const ultima = ult.get(c.id)
    const base = ultima || c.dataCadastro
    if (!base) return
    const dias = diffDays(hoje, base)
    if (dias <= Math.max(0, limite - AVISO_QUEDA_DIAS)) return
    lista.push({
      cliente: c,
      data: addDays(base, limite),
      motivo: ultima ? `Sem compra desde ${date(ultima)} (${dias} dias)` : `Nenhuma compra desde o cadastro (${dias} dias)`,
      automatica: true,
      diasSemCompra: dias,
    })
  })
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

// ---------- Territórios ----------
/** `por_raio`: São Paulo capital, onde a exclusividade é pelo raio em volta do endereço da revenda. */
export type StatusTerritorio = 'ocupada' | 'vai_liberar' | 'disponivel' | 'bloqueada' | 'reservada' | 'prioritaria' | 'por_raio'

export interface LinhaTerritorio {
  chave: string
  cidade: string
  uf: string
  regiao: string
  status: StatusTerritorio
  revendas: Cliente[]
  liberaEm?: string
  motivo?: string
  leadsAbertos: number
}

const chaveCidade = (cidade: string, uf: string) => `${cidade.trim().toLowerCase()}|${uf}`

export function territorios(db: Database): LinhaTerritorio[] {
  const hoje = today()
  const linhas = new Map<string, LinhaTerritorio>()
  const garantir = (cidade: string, uf: string, regiao: string) => {
    const k = chaveCidade(cidade, uf)
    if (!linhas.has(k)) linhas.set(k, { chave: k, cidade, uf, regiao, status: 'disponivel', revendas: [], leadsAbertos: 0 })
    return linhas.get(k)!
  }
  CIDADES_ALVO.forEach(([c, uf, r]) => garantir(c, uf, r))
  db.clientes.filter((c) => c.cidade).forEach((c) => garantir(c.cidade, c.uf, c.regiao).revendas.push(c))
  db.territorios.forEach((t) => garantir(t.cidade, t.uf, t.regiao))
  db.leads.forEach((l) => {
    if (l.etapa === 'ganho' || l.etapa === 'perdido') return
    const k = chaveCidade(l.cidade, l.uf)
    if (linhas.has(k)) linhas.get(k)!.leadsAbertos++
    else garantir(l.cidade, l.uf, regiaoPorUF(l.cidade, l.uf)).leadsAbertos++
  })

  const previstas = new Map(quedasPrevistas(db, hoje).map((q) => [q.cliente.id, q]))
  linhas.forEach((linha) => {
    // queda marcada com data já passada: a região está livre; queda automática vencida espera a equipe confirmar
    const vigentes = linha.revendas.filter((c) => c.status === 'ativa' || (c.status === 'em_queda' && (!c.quedaData || c.quedaData > hoje)))
    const firmes = vigentes.filter((c) => !previstas.has(c.id))
    const caindo = vigentes.filter((c) => previstas.has(c.id))
    if (ehCapitalSP(linha.cidade, linha.uf)) linha.status = 'por_raio'
    else if (firmes.length) linha.status = 'ocupada'
    else if (caindo.length) {
      linha.status = 'vai_liberar'
      linha.liberaEm = caindo.map((c) => previstas.get(c.id)!.data).sort().reverse()[0]
      linha.motivo = caindo.map((c) => previstas.get(c.id)!.motivo).join('; ')
    } else linha.status = 'disponivel'

    const bloqueio = db.territorios.find((t) => chaveCidade(t.cidade, t.uf) === linha.chave && (!t.ate || t.ate >= hoje))
    if (bloqueio && linha.status !== 'ocupada') {
      linha.status = bloqueio.tipo === 'bloqueada' ? 'bloqueada' : bloqueio.tipo === 'reservada' ? 'reservada' : linha.status === 'disponivel' ? 'prioritaria' : linha.status
      linha.motivo = bloqueio.motivo
    } else if (bloqueio && bloqueio.tipo === 'bloqueada') {
      linha.motivo = bloqueio.motivo
    }
  })
  return Array.from(linhas.values()).sort((a, b) => a.regiao.localeCompare(b.regiao) || a.cidade.localeCompare(b.cidade))
}

export function cidadeDoLeadDisponivel(db: Database, lead: Lead, mapa = territorios(db)) {
  return mapa.find((t) => t.chave === chaveCidade(lead.cidade, lead.uf))
}

// ---------- Tráfego ----------
export function metricasCriativo(c: { impressoes: number; cliques: number; leads: number; investido: number; conversoes: number }) {
  return {
    ctr: safeDiv(c.cliques, c.impressoes),
    cpc: safeDiv(c.investido, c.cliques),
    cpl: safeDiv(c.investido, c.leads),
    taxaLead: safeDiv(c.leads, c.cliques),
    cac: safeDiv(c.investido, c.conversoes),
  }
}

export function leadsNoPeriodo(db: Database, p: Periodo) {
  return db.leads.filter((l) => inRange(l.dataEntrada, p))
}

export const leadParado = (l: Lead, dias = 7) =>
  l.etapa !== 'ganho' && l.etapa !== 'perdido' && diffDays(today(), l.ultimaInteracao) > dias

export const proximosDias = (iso: string, dias: number) => iso >= today() && iso <= addDays(today(), dias)

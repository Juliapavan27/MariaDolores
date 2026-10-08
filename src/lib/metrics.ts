import type { Cliente, Colaborador, Configuracoes, Curva, Database, Fechamento, Lead, Pedido, Titulo } from '../data/types'
import { addDays, addMonths, diffDays, endOfMonth, inRange, mesesNoPeriodo, monthsBetween, startOfMonth, today, ym, type Periodo } from './dates'
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
  const inativos = base.filter((c) => !compraram.has(c.id))
  // mês com fechamento do BI: base de abertura e "realizado" oficiais da vendedora
  const meses = monthsBetween(p.inicio, p.fim)
  const fech = meses.length === 1 && mesInteiro(meses[0], p) ? mapaFechamentos(db).get(meses[0]) : undefined
  if (fech) {
    const doMes = colaboradorId ? [fech.get(colaboradorId)].filter(Boolean) as Fechamento[] : db.colaboradores.map((c) => fech.get(c.id)).filter(Boolean) as Fechamento[]
    const b = doMes.reduce((s, f) => s + f.baseAbertura, 0)
    const a = doMes.reduce((s, f) => s + f.realizado, 0)
    return { base: b, ativos: a, taxa: safeDiv(a, b), inativos, fonteBI: true }
  }
  return { base: base.length, ativos: ativos.length, taxa: safeDiv(ativos.length, base.length), inativos, fonteBI: false }
}

// ---------- Fechamento mensal do BI ----------
const mesInteiro = (mes: string, p: Periodo) => `${mes}-01` >= p.inicio && endOfMonth(`${mes}-01`) <= p.fim

/** mês → (pessoa → fechamento) */
export function mapaFechamentos(db: Database) {
  const m = new Map<string, Map<string, Fechamento>>()
  ;(db.fechamentos || []).forEach((f) => {
    if (!m.has(f.mes)) m.set(f.mes, new Map())
    m.get(f.mes)!.set(f.colaboradorId, f)
  })
  return m
}

/**
 * Faturamento líquido como o BI mostra. Nos meses com fechamento, vale o fechamento (pela vendedora
 * que fez a venda); nos demais, pedidos faturados menos devoluções. Sem pessoa, soma a equipe da base.
 */
export function faturamentoBI(db: Database, p: Periodo, colaboradorId?: string) {
  const fechamentos = mapaFechamentos(db)
  const dono = new Map(db.clientes.map((c) => [c.id, c.responsavelId]))
  const pedidos = pedidosNoPeriodo(db, p, colaboradorId)
  const devs = devolucoesValidas(db).filter((d) => inRange(d.data, p) && (!colaboradorId || dono.get(d.clienteId) === colaboradorId))
  return monthsBetween(p.inicio, p.fim).reduce((total, mes) => {
    const fech = fechamentos.get(mes)
    if (fech && mesInteiro(mes, p)) {
      return total + (colaboradorId ? fech.get(colaboradorId)?.faturamento || 0 : db.colaboradores.reduce((s, c) => s + (fech.get(c.id)?.faturamento || 0), 0))
    }
    return total + somaValor(pedidos.filter((x) => ym(x.data) === mes)) - somaValor(devs.filter((x) => ym(x.data) === mes))
  }, 0)
}

/** Meses do período cobertos pelo fechamento do BI (para avisar na tela de onde vem o número). */
export const mesesComFechamento = (db: Database, p: Periodo) => {
  const f = mapaFechamentos(db)
  return monthsBetween(p.inicio, p.fim).filter((m) => f.has(m) && mesInteiro(m, p))
}

/** Meta do período: soma mês a mês, usando a meta específica do mês quando existe. */
export function metaDoPeriodo(metaMensal: number, p: Periodo, porMes?: Record<string, number>) {
  if (!porMes) return metaMensal * mesesNoPeriodo(p)
  return monthsBetween(p.inicio, p.fim).reduce((s, m) => s + (porMes[m] ?? metaMensal), 0)
}
export const metaDoMes = (metaMensal: number, porMes: Record<string, number> | undefined, mes: string) => porMes?.[mes] ?? metaMensal
export const metaPessoa = (c: Colaborador, p: Periodo) => metaDoPeriodo(c.metaMensal, p, c.metasMes)
/**
 * Meta do time no período: em cada mês, a soma das metas mensais da equipe quando há metas por pessoa
 * cadastradas para o mês (assim vale para um showroom, os dois ou uma vendedora); senão, a meta da configuração.
 */
export function metaTimeMes(db: Database, m: string) {
  const porPessoa = db.colaboradores.some((c) => c.metasMes?.[m] !== undefined)
  return porPessoa ? db.colaboradores.reduce((t, c) => t + (c.metasMes?.[m] ?? 0), 0) : metaDoMes(db.config.metaFaturamentoMensal, db.config.metasMes, m)
}
export const metaShowroom = (db: Database, p: Periodo) => monthsBetween(p.inicio, p.fim).reduce((s, m) => s + metaTimeMes(db, m), 0)

/** Metas por mês em texto editável: uma linha "09/2026: 360000" por mês. */
export const metasParaTexto = (porMes?: Record<string, number>) =>
  Object.entries(porMes || {}).sort().map(([m, v]) => `${m.slice(5, 7)}/${m.slice(0, 4)}: ${v}`).join('\n')
export function textoParaMetas(texto?: string): Record<string, number> | undefined {
  const out: Record<string, number> = {}
  ;(texto || '').split(/\n|;/).forEach((linha) => {
    const m = linha.match(/(\d{1,2})\s*\/\s*(\d{4})\s*[:=]\s*(?:R\$)?\s*([\d.,]+)/i)
    if (!m) return
    const valor = Number(m[3].includes(',') ? m[3].replace(/\./g, '').replace(',', '.') : m[3].replace(/\.(?=\d{3}(\D|$))/g, ''))
    if (Number.isFinite(valor)) out[`${m[2]}-${m[1].padStart(2, '0')}`] = valor
  })
  return Object.keys(out).length ? out : undefined
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
  // meses com fechamento do BI: o líquido oficial (por vendedora da venda), sem devoluções à parte
  const fechamentos = mapaFechamentos(db)
  keys.forEach((k) => {
    const f = fechamentos.get(k)
    if (!f) return
    fat.set(k, colaboradorId ? f.get(colaboradorId)?.faturamento || 0 : db.colaboradores.reduce((s, c) => s + (f.get(c.id)?.faturamento || 0), 0))
    dev.set(k, 0)
  })
  const pessoa = colaboradorId ? db.colaboradores.find((c) => c.id === colaboradorId) : undefined
  const meta = (k: string) => colaboradorId ? metaDoMes(pessoa?.metaMensal || 0, pessoa?.metasMes, k) : metaTimeMes(db, k)
  return keys.map((k) => ({ mes: k, faturamento: fat.get(k)!, devolucoes: dev.get(k)!, meta: meta(k) }))
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

/** Chave da cidade sem acento nem caixa: "Araçatuba" e "Aracatuba" são a mesma cidade. */
export const chaveCidade = (cidade: string, uf: string) =>
  `${(cidade || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')}|${(uf || '').toUpperCase()}`

export function territorios(db: Database): LinhaTerritorio[] {
  const hoje = today()
  const linhas = new Map<string, LinhaTerritorio>()
  const garantir = (cidade: string, uf: string, regiao: string) => {
    const k = chaveCidade(cidade, uf)
    if (!linhas.has(k)) linhas.set(k, { chave: k, cidade, uf, regiao, status: 'disponivel', revendas: [], leadsAbertos: 0 })
    return linhas.get(k)!
  }
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

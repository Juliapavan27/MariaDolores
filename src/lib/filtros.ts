// Filtro global da plataforma (vendedora, unidade e região), aplicado sobre a base da área.
// Todas as abas leem a base já filtrada; telas de exclusividade (Expansão, raio da capital)
// calculam a ocupação com a base inteira e só filtram o que mostram.
import type { Cliente, Database } from '../data/types'
import { ehCapitalSP, macroRegiao, regiaoPorUF, REGIOES } from '../data/labels'

export interface Filtros {
  showroom?: string
  vendedora?: string
  unidade?: string
  regiao?: string
}

export const filtroAtivo = (f: Filtros) => !!(f.showroom || f.vendedora || f.unidade || f.regiao)

/** Showrooms (times) cadastrados na equipe. */
export const showrooms = (db: Database) => Array.from(new Set(db.colaboradores.map((c) => c.time).filter(Boolean) as string[])).sort()

export const chaveUnidade = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/** Unidades (filial/loja/time) a partir do campo "região/carteira" da equipe, sem duplicar grafias. */
export function unidades(db: Database, showroom?: string) {
  const m = new Map<string, string>()
  db.colaboradores.forEach((c) => {
    if (!c.regiao || (showroom && c.time !== showroom)) return
    const k = chaveUnidade(c.regiao)
    if (!m.has(k)) m.set(k, c.regiao)
  })
  return Array.from(m.entries()).map(([valor, label]) => ({ valor, label })).sort((a, b) => a.label.localeCompare(b.label))
}

/** Regiões: macrorregiões, capital e as regiões que aparecem nos cadastros. */
export function regioes(db: Database) {
  const usadas = new Set(db.clientes.map((c) => c.regiao).filter(Boolean))
  db.leads.forEach((l) => { const m = macroRegiao(l.uf); if (m) usadas.add(m) })
  const detalhe = Array.from(usadas).filter((r) => !['Sudeste', 'Nordeste', 'Capital SP'].includes(r))
    .sort((a, b) => (REGIOES.indexOf(a) + 1 || 999) - (REGIOES.indexOf(b) + 1 || 999) || a.localeCompare(b))
  return ['Sudeste', 'Nordeste', 'Capital SP', ...detalhe]
}

export function noLocal(regiao: string, cidade: string, uf: string, regiaoCadastro?: string) {
  if (!regiao) return true
  if (regiao === 'Sudeste' || regiao === 'Nordeste') return macroRegiao(uf) === regiao
  if (regiao === 'Capital SP') return ehCapitalSP(cidade, uf) || (regiaoCadastro || '').startsWith('Capital SP')
  return regiaoCadastro === regiao
}

/** Ids das pessoas da equipe que passam no filtro de vendedora e de unidade (null = todas). */
export function equipeFiltrada(db: Database, f: Filtros): Set<string> | null {
  if (!f.vendedora && !f.unidade && !f.showroom) return null
  return new Set(db.colaboradores
    .filter((c) => (!f.vendedora || c.id === f.vendedora) && (!f.unidade || chaveUnidade(c.regiao || '') === f.unidade) && (!f.showroom || c.time === f.showroom))
    .map((c) => c.id))
}

export function passaCliente(c: Cliente, f: Filtros, equipe: Set<string> | null) {
  return (!equipe || equipe.has(c.responsavelId)) && noLocal(f.regiao || '', c.cidade, c.uf, c.regiao)
}

function metaDaEquipe(config: Database['config'], pessoas: Database['colaboradores']): Database['config'] {
  const meses = new Set(pessoas.flatMap((c) => Object.keys(c.metasMes || {})))
  const metasMes: Record<string, number> = {}
  meses.forEach((m) => { metasMes[m] = pessoas.reduce((s, c) => s + (c.metasMes?.[m] ?? c.metaMensal), 0) })
  return { ...config, metaFaturamentoMensal: pessoas.reduce((s, c) => s + c.metaMensal, 0), metasMes: meses.size ? metasMes : undefined }
}

export function aplicarFiltros(db: Database, f: Filtros): Database {
  if (!filtroAtivo(f)) return db
  const equipe = equipeFiltrada(db, f)
  const regiaoDe = new Map(db.clientes.map((c) => [c.id, c]))
  const clienteNoLocal = (id: string) => { const c = regiaoDe.get(id); return !f.regiao || (!!c && noLocal(f.regiao, c.cidade, c.uf, c.regiao)) }
  // vendas: da pessoa que vendeu ou da dona da carteira
  const pedidos = db.pedidos.filter((p) =>
    clienteNoLocal(p.clienteId) && (!equipe || equipe.has(p.responsavelId) || equipe.has(regiaoDe.get(p.clienteId)?.responsavelId || '')))
  const comVenda = new Set(pedidos.map((p) => p.clienteId))
  const clientes = db.clientes.filter((c) => passaCliente(c, f, equipe) || comVenda.has(c.id))
  const ids = new Set(clientes.map((c) => c.id))
  const doCliente = <T extends { clienteId?: string }>(xs: T[]) => xs.filter((x) => !x.clienteId || ids.has(x.clienteId))
  const daEquipe = <T extends { responsavelId: string }>(xs: T[]) => (equipe ? xs.filter((x) => equipe.has(x.responsavelId)) : xs)
  const colaboradores = equipe ? db.colaboradores.filter((c) => equipe.has(c.id)) : db.colaboradores
  return {
    ...db,
    // com vendedora ou unidade escolhida, a meta do showroom vira a soma das metas de quem ficou no filtro
    config: equipe ? metaDaEquipe(db.config, colaboradores) : db.config,
    colaboradores,
    clientes,
    pedidos,
    devolucoes: doCliente(db.devolucoes),
    reclamacoes: doCliente(db.reclamacoes),
    titulos: doCliente(db.titulos),
    movBrindes: doCliente(db.movBrindes),
    atendimentos: doCliente(db.atendimentos),
    visitas: daEquipe(doCliente(db.visitas)),
    tarefas: daEquipe(db.tarefas),
    leads: daEquipe(db.leads).filter((l) => noLocal(f.regiao || '', l.cidade, l.uf, regiaoPorUF(l.cidade, l.uf))),
    // o fechamento do BI é por vendedora: não dá para recortar por região
    fechamentos: f.regiao ? [] : equipe ? (db.fechamentos || []).filter((x) => equipe.has(x.colaboradorId)) : db.fechamentos,
    territorios: db.territorios.filter((t) => noLocal(f.regiao || '', t.cidade, t.uf, t.regiao)),
  }
}

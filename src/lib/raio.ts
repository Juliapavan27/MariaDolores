// Raio de atuação das revendas em São Paulo capital.
// Na capital a exclusividade é por endereço: cada revenda protege um raio em volta da loja,
// e esse raio diminui quando ela compra pouco nos últimos meses fechados.
import type { Cliente, Configuracoes, Database } from '../data/types'
import { ehCapitalSP } from '../data/labels'
import { addDays, addMonths, startOfMonth, today } from './dates'
import { pedidosValidos } from './metrics'

export interface Ponto { lat: number; lng: number }

export interface RegraRaio {
  cheio: number
  medio: number
  minimo: number
  limiteMedio: number
  limiteCheio: number
  meses: number
}

export function regraRaio(c: Configuracoes): RegraRaio {
  return {
    cheio: c.raioCapitalCheioKm ?? 3,
    medio: c.raioCapitalMedioKm ?? 1.5,
    minimo: c.raioCapitalMinimoKm ?? 1,
    limiteMedio: c.raioCapitalLimiteMedio ?? 10000,
    limiteCheio: c.raioCapitalLimiteCheio ?? 15000,
    meses: c.raioCapitalMeses ?? 3,
  }
}

/**
 * Lê "lat, lng" ou um link do Google Maps (formatos @lat,lng · !3dlat!4dlng · q=lat,lng · ll=lat,lng).
 * Só aceita coordenadas plausíveis para o Brasil, para pegar inversões e erros de digitação.
 */
export function lerLocalizacao(texto?: string): Ponto | null {
  if (!texto) return null
  const t = decodeURIComponent(texto.trim())
  const padroes = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/,
  ]
  for (const re of padroes) {
    const m = t.match(re)
    if (!m) continue
    const lat = Number(m[1].replace(',', '.'))
    const lng = Number(m[2].replace(',', '.'))
    if (lat >= -34 && lat <= 6 && lng >= -74 && lng <= -34) return { lat, lng } // dentro do Brasil
  }
  return null
}

/** Distância em km (fórmula de haversine). */
export function distanciaKm(a: Ponto, b: Ponto) {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Meses fechados usados na revisão (em outubro, com 3 meses: julho, agosto e setembro). */
export function janelaRaio(regra: RegraRaio, hoje = today()) {
  const inicio = startOfMonth(addMonths(startOfMonth(hoje), -regra.meses))
  const fim = addDays(startOfMonth(hoje), -1)
  return { inicio, fim }
}

export interface RaioRevenda {
  cliente: Cliente
  ponto: Ponto | null
  raioKm: number
  compras: number
  /** Ainda não completou o período de revisão: mantém o raio cheio. */
  implantacao: boolean
  faixa: 'cheio' | 'medio' | 'minimo'
  /** Quanto falta para passar do limite da faixa seguinte (0 se já está no raio cheio). */
  faltaProxima: number
  proximoRaioKm?: number
}

export const revendaVigente = (c: Cliente, hoje = today()) =>
  c.status === 'ativa' || (c.status === 'em_queda' && (!c.quedaData || c.quedaData > hoje))

export function raiosCapital(db: Database, hoje = today()): RaioRevenda[] {
  const regra = regraRaio(db.config)
  const { inicio, fim } = janelaRaio(regra, hoje)
  const capital = db.clientes.filter((c) => ehCapitalSP(c.cidade, c.uf) && revendaVigente(c, hoje))
  const ids = new Set(capital.map((c) => c.id))
  const compras = new Map<string, number>()
  const primeira = new Map<string, string>()
  pedidosValidos(db.pedidos).forEach((p) => {
    if (!ids.has(p.clienteId)) return
    if (!primeira.has(p.clienteId) || p.data < primeira.get(p.clienteId)!) primeira.set(p.clienteId, p.data)
    if (p.data >= inicio && p.data <= fim) compras.set(p.clienteId, (compras.get(p.clienteId) || 0) + p.valor)
  })
  return capital.map((cliente) => {
    const valor = compras.get(cliente.id) || 0
    const comeco = [cliente.dataCadastro, primeira.get(cliente.id)].filter(Boolean).sort()[0]
    // a revenda começa com o raio cheio até ter um período completo de compras para avaliar
    const implantacao = !comeco || comeco > inicio
    const faixa = implantacao || valor > regra.limiteCheio ? 'cheio' : valor > regra.limiteMedio ? 'medio' : 'minimo'
    const raioKm = faixa === 'cheio' ? regra.cheio : faixa === 'medio' ? regra.medio : regra.minimo
    const alvo = faixa === 'minimo' ? regra.limiteMedio : faixa === 'medio' ? regra.limiteCheio : 0
    return {
      cliente,
      ponto: lerLocalizacao(cliente.localizacao),
      raioKm,
      compras: valor,
      implantacao,
      faixa,
      faltaProxima: alvo ? Math.max(0, alvo - valor) : 0,
      proximoRaioKm: faixa === 'minimo' ? regra.medio : faixa === 'medio' ? regra.cheio : undefined,
    }
  })
}

export interface Conflito { raio: RaioRevenda; distanciaKm: number }

/** Verifica se um ponto da capital cai dentro do raio de alguma revenda. */
export function verificarPonto(raios: RaioRevenda[], ponto: Ponto, ignorarId?: string) {
  const comPonto = raios.filter((r) => r.ponto && r.cliente.id !== ignorarId)
  const medidas = comPonto.map((r) => ({ raio: r, distanciaKm: distanciaKm(ponto, r.ponto!) })).sort((a, b) => a.distanciaKm - b.distanciaKm)
  return {
    conflitos: medidas.filter((m) => m.distanciaKm < m.raio.raioKm),
    proximas: medidas.filter((m) => m.distanciaKm >= m.raio.raioKm).slice(0, 3),
    semLocalizacao: raios.filter((r) => !r.ponto && r.cliente.id !== ignorarId).length,
  }
}

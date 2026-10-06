export const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => toISO(new Date())
export const addDays = (iso: string, n: number) => {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const addMonths = (iso: string, n: number) => {
  const d = parse(iso)
  d.setMonth(d.getMonth() + n)
  return toISO(d)
}
export const diffDays = (a: string, b: string) =>
  Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000)
export const ym = (iso: string) => iso.slice(0, 7)
export const startOfMonth = (iso: string) => iso.slice(0, 7) + '-01'
export const endOfMonth = (iso: string) => {
  const d = parse(startOfMonth(iso))
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return toISO(d)
}
export const inRange = (iso: string | undefined, p: Periodo) => !!iso && iso >= p.inicio && iso <= p.fim

/** Lista de AAAA-MM entre duas datas (inclusive). */
export const monthsBetween = (inicio: string, fim: string) => {
  const out: string[] = []
  let cur = startOfMonth(inicio)
  while (cur <= fim) {
    out.push(ym(cur))
    cur = addMonths(cur, 1)
  }
  return out
}

export interface Periodo {
  chave: PresetPeriodo
  inicio: string
  fim: string
  label: string
}

export type PresetPeriodo = 'mes' | 'mes_anterior' | 'trimestre' | 'semestre' | 'ano' | '12m'

export const PRESETS: { chave: PresetPeriodo; label: string }[] = [
  { chave: 'mes', label: 'Mês atual' },
  { chave: 'mes_anterior', label: 'Mês anterior' },
  { chave: 'trimestre', label: 'Trimestre atual' },
  { chave: 'semestre', label: 'Semestre atual' },
  { chave: 'ano', label: 'Ano atual' },
  { chave: '12m', label: 'Últimos 12 meses' },
]

export function periodo(chave: PresetPeriodo, ref = today()): Periodo {
  const d = parse(ref)
  const y = d.getFullYear()
  const m = d.getMonth()
  const label = PRESETS.find((p) => p.chave === chave)!.label
  switch (chave) {
    case 'mes':
      return { chave, label, inicio: startOfMonth(ref), fim: endOfMonth(ref) }
    case 'mes_anterior': {
      const prev = addMonths(startOfMonth(ref), -1)
      return { chave, label, inicio: prev, fim: endOfMonth(prev) }
    }
    case 'trimestre': {
      const q = Math.floor(m / 3) * 3
      const ini = `${y}-${pad(q + 1)}-01`
      return { chave, label, inicio: ini, fim: endOfMonth(addMonths(ini, 2)) }
    }
    case 'semestre': {
      const s = m < 6 ? 0 : 6
      const ini = `${y}-${pad(s + 1)}-01`
      return { chave, label, inicio: ini, fim: endOfMonth(addMonths(ini, 5)) }
    }
    case 'ano':
      return { chave, label, inicio: `${y}-01-01`, fim: `${y}-12-31` }
    case '12m':
      return { chave, label, inicio: addMonths(startOfMonth(ref), -11), fim: endOfMonth(ref) }
  }
}

/** Número de meses cobertos pelo período (para proporcionalizar metas mensais). */
export const mesesNoPeriodo = (p: Periodo) => monthsBetween(p.inicio, p.fim).length

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
const num = new Intl.NumberFormat('pt-BR')
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export const money = (v: number) => brl.format(Number.isFinite(v) ? v : 0)
export const money2 = (v: number) => brl2.format(Number.isFinite(v) ? v : 0)
export const km = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
export const int = (v: number) => num.format(Math.round(Number.isFinite(v) ? v : 0))
export const short = (v: number) => compact.format(Number.isFinite(v) ? v : 0)
export const moneyShort = (v: number) => 'R$ ' + compact.format(Number.isFinite(v) ? v : 0)
export const pct = (v: number, digits = 0) =>
  `${(Number.isFinite(v) ? v * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`

export const date = (iso?: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MESES[Number(m) - 1]}/${y.slice(2)}`
}
export const dayMonth = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d} ${MESES[Number(m) - 1]}`
}

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

export const safeDiv = (a: number, b: number) => (b ? a / b : 0)

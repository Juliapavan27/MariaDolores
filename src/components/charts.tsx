import { useEffect, useState, type ReactNode } from 'react'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps,
} from 'recharts'
import { money, monthLabel, short, int } from '../lib/format'

/** Lê os tokens de cor atuais (respeita tema claro/escuro). */
export function useChartColors() {
  const read = () => {
    const s = getComputedStyle(document.documentElement)
    const g = (n: string) => s.getPropertyValue(n).trim()
    return { s1: g('--s1'), s2: g('--s2'), s3: g('--s3'), s4: g('--s4'), grid: g('--grid'), axis: g('--axis'), muted: g('--muted'), ink: g('--ink'), surface: g('--surface') }
  }
  const [c, setC] = useState(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = () => setC(read())
    mq.addEventListener('change', h)
    return () => { obs.disconnect(); mq.removeEventListener('change', h) }
  }, [])
  return c
}

type Fmt = (v: number) => string

function Tip({ active, payload, label, fmt, labelFmt }: TooltipProps<number, string> & { fmt: Fmt; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="t">{labelFmt ? labelFmt(String(label)) : label}</div>
      {payload.map((p) => (
        <div className="row" key={String(p.dataKey)}>
          <span className="sw" style={{ background: p.color }} />
          <span>{p.name}</span>
          <b style={{ marginLeft: 'auto', paddingLeft: 12 }}>{fmt(Number(p.value))}</b>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; line?: boolean; dashed?: boolean }[] }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.label}>
          <i className={i.line ? '' : 'box'} style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

const axisProps = (c: ReturnType<typeof useChartColors>) => ({
  tick: { fill: c.muted, fontSize: 10.5, letterSpacing: 0.4 },
  axisLine: { stroke: c.axis },
  tickLine: false,
})

/** Faturamento mensal (barras) com a meta como linha tracejada — mesma unidade, um só eixo. */
export function RevenueChart({ data, height = 260 }: { data: { mes: string; faturamento: number; meta: number; devolucoes?: number }[]; height?: number }) {
  const c = useChartColors()
  return (
    <>
      <Legend items={[{ label: 'Faturamento', color: c.s1 }, { label: 'Meta', color: c.ink, line: true, dashed: true }]} />
      <div style={{ height }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} barCategoryGap="38%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="mes" tickFormatter={monthLabel} {...axisProps(c)} />
            <YAxis tickFormatter={(v) => short(v)} {...axisProps(c)} axisLine={false} width={60} />
            <Tooltip content={<Tip fmt={money} labelFmt={monthLabel} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
            <Bar dataKey="faturamento" name="Faturamento" fill={c.s1} radius={[2, 2, 0, 0]} maxBarSize={30} />
            <Line dataKey="meta" name="Meta" stroke={c.ink} strokeDasharray="3 4" strokeWidth={1.25} dot={false} type="linear" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function MultiLine({ data, series, xKey, xFmt, fmt = int, height = 240 }: {
  data: Record<string, string | number>[]; series: { key: string; label: string; color: string }[]; xKey: string; xFmt?: (s: string) => string; fmt?: Fmt; height?: number
}) {
  const c = useChartColors()
  return (
    <>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color, line: true }))} />
      <div style={{ height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey={xKey} tickFormatter={xFmt} {...axisProps(c)} />
            <YAxis tickFormatter={(v) => fmt(v)} {...axisProps(c)} axisLine={false} width={48} allowDecimals={false} />
            <Tooltip content={<Tip fmt={fmt} labelFmt={xFmt} />} cursor={{ stroke: c.axis }} />
            {series.map((s) => (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: s.color, stroke: c.surface, strokeWidth: 2 }} type="monotone" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function SimpleBars({ data, xKey, yKey, label, color, fmt = int, xFmt, height = 220 }: {
  data: Record<string, string | number>[]; xKey: string; yKey: string; label: string; color: string; fmt?: Fmt; xFmt?: (s: string) => string; height?: number
}) {
  const c = useChartColors()
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey={xKey} tickFormatter={xFmt} {...axisProps(c)} interval={0} />
          <YAxis tickFormatter={(v) => fmt(v)} {...axisProps(c)} axisLine={false} width={64} />
          <Tooltip content={<Tip fmt={fmt} labelFmt={xFmt} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
          <Bar dataKey={yKey} name={label} fill={color} radius={[2, 2, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras horizontais em HTML (rankings) — rótulo e valor sempre visíveis. */
export function HBars({ rows, fmt = int, color }: { rows: { label: ReactNode; value: number; key: string; extra?: ReactNode }[]; fmt?: Fmt; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="funnel">
      {rows.map((r) => (
        <div className="funnel-row" key={r.key} title={`${fmt(r.value)}`}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div className="funnel-bar">
            <span style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          <span className="v">{fmt(r.value)}{r.extra}</span>
        </div>
      ))}
    </div>
  )
}

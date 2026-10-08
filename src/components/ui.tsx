import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { initials, pct } from '../lib/format'
import { useStore } from '../data/store'
import { useFoco } from '../lib/router'

export function PageHead({ eyebrow, title, desc, actions }: { eyebrow?: string; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Card({ title, sub, right, children, className = '' }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="card-head">
          {title && <h3>{title}</h3>}
          {sub && <span className="sub">{sub}</span>}
          {right && <div className="right">{right}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, foot, children, onClick, acao = 'ver lista' }: { label: ReactNode; value: ReactNode; foot?: ReactNode; children?: ReactNode; onClick?: () => void; acao?: string }) {
  const corpo = (
    <>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {children}
      {foot && <div className="kpi-foot">{foot}</div>}
      {onClick && <div className="kpi-acao">{acao} →</div>}
    </>
  )
  // indicador clicável: leva para a lista do que ele conta
  if (onClick) return <button type="button" className="card kpi clicavel" onClick={onClick}>{corpo}</button>
  return <div className="card kpi">{corpo}</div>
}

/** Barra de progresso com marcador de meta. `target` é a fração onde fica a linha da meta. */
export function Meter({ value, target = 1, tone }: { value: number; target?: number; tone?: 'good' | 'bad' | 'warn' }) {
  const scale = Math.max(1, target, value)
  const t = tone ?? (value >= target ? 'good' : '')
  return (
    <div className={`meter ${t}`} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${(Math.max(0, value) / scale) * 100}%` }} />
      {target < scale && <i className="target" style={{ left: `${(target / scale) * 100}%` }} title={`Meta ${pct(target)}`} />}
      {target >= scale && <i className="target" style={{ left: 'calc(100% - 2px)' }} title={`Meta ${pct(target)}`} />}
    </div>
  )
}

export function Badge({ tone, children, plain }: { tone?: 'good' | 'warn' | 'bad' | 'info' | 'gold'; children: ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone || ''} ${plain ? 'plain' : ''}`}>{children}</span>
}

export function Avatar({ name, lg }: { name: string; lg?: boolean }) {
  return <span className={`avatar ${lg ? 'lg' : ''}`}>{initials(name)}</span>
}

export function Person({ id, sub }: { id: string; sub?: ReactNode }) {
  const { db } = useStore()
  const c = db.colaboradores.find((x) => x.id === id)
  if (!c) return <span className="muted">—</span>
  return (
    <span className="person">
      <Avatar name={c.nome} />
      <span className="meta">
        <div className="name">{c.nome}</div>
        {sub && <div className="small muted">{sub}</div>}
      </span>
    </span>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------- Tabela de dados ----------------
export interface Column<T> {
  key: string
  label: ReactNode
  render?: (row: T) => ReactNode
  value?: (row: T) => string | number | undefined // usado para ordenar e buscar
  num?: boolean
  className?: string
}

export function DataTable<T extends { id: string }>({
  rows, columns, onRowClick, empty = 'Nenhum registro encontrado.', initialSort, pageSize = 25,
}: {
  rows: T[]; columns: Column<T>[]; onRowClick?: (r: T) => void; empty?: string; initialSort?: { key: string; dir: 1 | -1 }; pageSize?: number
}) {
  const [sort, setSort] = useState(initialSort)
  const [limit, setLimit] = useState(pageSize)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.value) return rows
    return [...rows].sort((a, b) => {
      const va = col.value!(a) ?? ''
      const vb = col.value!(b) ?? ''
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
    })
  }, [rows, sort, columns])
  useEffect(() => setLimit(pageSize), [rows, pageSize])
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.num ? 'num' : ''} ${c.value ? 'sortable' : ''}`}
                onClick={() => c.value && setSort((s) => ({ key: c.key, dir: s?.key === c.key ? ((-s.dir) as 1 | -1) : -1 }))}
              >
                {c.label}
                {sort?.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, limit).map((r) => (
            <tr key={r.id} className={onRowClick ? 'clickable' : ''} onClick={() => onRowClick?.(r)}>
              {columns.map((c) => (
                <td key={c.key} className={`${c.num ? 'num' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : String(c.value?.(r) ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="empty">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
      {sorted.length > limit && (
        <div className="more-row">
          <button className="btn sm" onClick={() => setLimit((l) => l + pageSize * 2)}>
            Ver mais · {sorted.length - limit}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------- Formulário genérico ----------------
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'multiselect' | 'email' | 'tel' | 'url'

export interface Field {
  name: string
  label: string
  type?: FieldType
  options?: { value: string; label: string }[]
  full?: boolean
  required?: boolean
  placeholder?: string
  step?: string
  help?: string
}

export function FormModal<T extends object>({
  title, fields, initial, onSave, onClose, onDelete, wide, validate,
}: {
  title: string; fields: Field[]; initial: T; onSave: (v: T) => void; onClose: () => void; onDelete?: () => void; wide?: boolean
  /** Regra de negócio: devolve a mensagem que impede salvar. */
  validate?: (v: T) => string | undefined
}) {
  const [v, setV] = useState<Record<string, unknown>>(initial as Record<string, unknown>)
  const [err, setErr] = useState('')
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }))
  const submit = () => {
    const missing = fields.filter((f) => f.required && (v[f.name] === undefined || v[f.name] === ''))
    if (missing.length) return setErr(`Preencha: ${missing.map((m) => m.label).join(', ')}`)
    const bloqueio = validate?.(v as T)
    if (bloqueio) return setErr(bloqueio)
    onSave(v as T)
  }
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide={wide}
      footer={
        <>
          {onDelete && (
            <ConfirmButton className="btn danger" style={{ marginRight: 'auto' }} onConfirm={onDelete} confirmLabel="Confirmar exclusão">
              Excluir
            </ConfirmButton>
          )}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={submit}>Salvar</button>
        </>
      }
    >
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); submit() }}>
        {fields.map((f) => {
          const val = v[f.name]
          const common = { id: `f-${f.name}`, className: 'input', placeholder: f.placeholder }
          let input: ReactNode
          switch (f.type) {
            case 'select':
              input = (
                <select {...common} value={(val as string) ?? ''} onChange={(e) => set(f.name, e.target.value || undefined)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )
              break
            case 'multiselect': {
              const arr = (val as string[]) || []
              input = (
                <select {...common} multiple size={6} value={arr} onChange={(e) => set(f.name, Array.from(e.target.selectedOptions).map((o) => o.value))}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )
              break
            }
            case 'textarea':
              input = <textarea {...common} value={(val as string) ?? ''} onChange={(e) => set(f.name, e.target.value)} />
              break
            case 'checkbox':
              input = (
                <label className="check">
                  <input type="checkbox" checked={!!val} onChange={(e) => set(f.name, e.target.checked)} /> {f.placeholder || 'Sim'}
                </label>
              )
              break
            case 'number':
              input = (
                <input {...common} type="number" step={f.step || 'any'} value={val === undefined || val === null ? '' : String(val)}
                  onChange={(e) => set(f.name, e.target.value === '' ? undefined : Number(e.target.value))} />
              )
              break
            default:
              input = <input {...common} type={f.type || 'text'} value={(val as string) ?? ''} onChange={(e) => set(f.name, e.target.value)} />
          }
          return (
            <div key={f.name} className={`field ${f.full || f.type === 'textarea' || f.type === 'multiselect' ? 'full' : ''}`}>
              <label htmlFor={`f-${f.name}`}>{f.label}{f.required && ' *'}</label>
              {input}
              {f.help && <span className="small muted">{f.help}</span>}
            </div>
          )
        })}
        <button type="submit" hidden />
      </form>
      {err && <div className="alert bad mt"><span className="ico">!</span>{err}</div>}
    </Modal>
  )
}

export const opts = (rec: Record<string, string>) => Object.entries(rec).map(([value, label]) => ({ value, label }))

export function useSearch<T>(rows: T[], text: (r: T) => string) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (!s) return rows
    return rows.filter((r) => text(r).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(s))
  }, [rows, q, text])
  return { q, setQ, filtered }
}

/** Faixa no topo da tela quando ela foi aberta por um alerta da visão geral. */
export function FocoAviso() {
  const { foco, limpar } = useFoco()
  if (!foco) return null
  return (
    <div className="alert info" style={{ marginBottom: 16, alignItems: 'center' }}>
      <span className="ico">i</span>
      <span style={{ flex: 1 }}>Mostrando só o que o alerta aponta: <b>{foco.titulo}</b>.</span>
      <button type="button" className="btn sm" onClick={limpar}>Ver tudo</button>
    </div>
  )
}

export function StatRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** Botão de ação destrutiva: o primeiro clique pede confirmação na própria tela, o segundo executa. */
export function ConfirmButton({ children, confirmLabel = 'Confirmar', onConfirm, className = 'btn', style }: {
  children: ReactNode; confirmLabel?: string; onConfirm: () => void; className?: string; style?: CSSProperties
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button type="button" className={`${className} ${armed ? 'armed' : ''}`} style={style} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmLabel : children}
    </button>
  )
}

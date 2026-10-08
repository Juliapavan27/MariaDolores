import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useStore } from '../data/store'
import { Card, Meter, PageHead, StatRow, pessoasAtivas } from '../components/ui'
import { carteira, pedidosNoPeriodo, somaValor, metaDoMes } from '../lib/metrics'
import { lerCarteira } from '../lib/carteira'
import { periodo as criarPeriodo } from '../lib/dates'
import { money, pct, int, safeDiv, MESES_LONGOS } from '../lib/format'

/** Preenchimento da régua até o valor atual. */
const trilho = (f: number) => ({ '--pct': `${Math.max(0, Math.min(1, f)) * 100}%` }) as CSSProperties

/** Quanto vale uma carteira ativa: clientes comprando × ticket médio, mais reativações. */
export default function Simulador() {
  const { db } = useStore()
  const [quem, setQuem] = useState('')

  // Ponto de partida: o último mês fechado
  const ref = useMemo(() => {
    const p = criarPeriodo('mes_anterior')
    const ped = pedidosNoPeriodo(db, p, quem || undefined)
    const clientes = new Set(ped.map((x) => x.clienteId)).size
    const fat = somaValor(ped)
    const base = carteira(db, quem || undefined).length
    const inativas = lerCarteira(db, quem || undefined).filter((l) => l.grupo === 'inativa' || l.grupo === 'risco').length
    const pessoa = quem ? db.colaboradores.find((c) => c.id === quem) : undefined
    const mesRef = p.inicio.slice(0, 7)
    const meta = quem ? metaDoMes(pessoa?.metaMensal || 0, pessoa?.metasMes, mesRef) : metaDoMes(db.config.metaFaturamentoMensal, db.config.metasMes, mesRef)
    const mes = MESES_LONGOS[Number(p.inicio.slice(5, 7)) - 1].toLowerCase()
    return { clientes, fat, ticket: Math.round(safeDiv(fat, clientes) / 100) * 100 || 5000, base: Math.max(base, clientes, 1), inativas, meta, mes }
  }, [db, quem])

  const [n, setN] = useState(ref.clientes)
  const [ticket, setTicket] = useState(ref.ticket)
  const [reat, setReat] = useState(0)
  const [pReat, setPReat] = useState(60)
  // ao trocar de carteira, volta ao ponto de partida dela
  useEffect(() => { setN(ref.clientes); setTicket(ref.ticket); setReat(0) }, [ref])

  const fatEstimado = n * ticket + reat * ticket * (pReat / 100)
  const delta = fatEstimado - ref.fat
  const ativos = Math.min(ref.base, n + reat)
  const metaAt = db.config.metaAtivacao
  const clientesParaMeta = Math.ceil(safeDiv(ref.meta, ticket))
  const ticketParaMeta = safeDiv(ref.meta, n + reat * (pReat / 100))
  const tMin = Math.max(500, Math.round(ref.ticket * 0.4 / 100) * 100)
  const tMax = Math.round(ref.ticket * 1.8 / 100) * 100

  const cenarios = [
    { nome: `Como foi em ${ref.mes}`, n: ref.clientes, t: ref.ticket },
    { nome: `${pct(metaAt)} da base comprando, mesmo ticket`, n: Math.ceil(ref.base * metaAt), t: ref.ticket },
    { nome: 'Mesma base, ticket 10% maior', n: ref.clientes, t: ref.ticket * 1.1 },
    { nome: `${pct(metaAt)} da base e ticket 10% maior`, n: Math.ceil(ref.base * metaAt), t: ref.ticket * 1.1 },
  ]

  return (
    <>
      <PageHead
        eyebrow="Gestão à vista"
        title="Simulador"
        desc="Arraste as réguas para ver o faturamento esperado. O ponto de partida é o último mês fechado; a meta e a base vêm da carteira escolhida."
        actions={
          <select className="input" style={{ width: 'auto' }} value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Carteira">
            <option value="">Showroom inteiro</option>
            {pessoasAtivas(db, { semAnalista: true }).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        }
      />

      <div className="card sim">
        <div className="sim-ctrls">
          <div className="regua">
            <label htmlFor="sim-n">Clientes comprando no mês <b>{int(n)} de {int(ref.base)}</b></label>
            <input id="sim-n" style={trilho(safeDiv(n, ref.base))} type="range" min={0} max={ref.base} value={n} onChange={(e) => setN(+e.target.value)} />
            <span className="small muted">Em {ref.mes}: {int(ref.clientes)} · ativação simulada: {pct(safeDiv(ativos, ref.base))} (meta {pct(metaAt)})</span>
          </div>
          <div className="regua">
            <label htmlFor="sim-t">Ticket médio por cliente <b>{money(ticket)}</b></label>
            <input id="sim-t" style={trilho(safeDiv(ticket - tMin, tMax - tMin))} type="range" min={tMin} max={tMax} step={100} value={ticket} onChange={(e) => setTicket(+e.target.value)} />
            <span className="small muted">Em {ref.mes}: {money(ref.ticket)}</span>
          </div>
          <div className="regua">
            <label htmlFor="sim-r">Inativas ou em risco que voltam a comprar <b>{int(reat)}</b></label>
            <input id="sim-r" style={trilho(safeDiv(reat, Math.max(ref.inativas, 1)))} type="range" min={0} max={Math.max(ref.inativas, 1)} value={reat} onChange={(e) => setReat(+e.target.value)} />
            <span className="small muted">{int(ref.inativas)} revendas sem comprar há mais de 60 dias nesta carteira</span>
          </div>
          <div className="regua">
            <label htmlFor="sim-p">Ticket das reativadas, sobre a média <b>{pReat}%</b></label>
            <input id="sim-p" style={trilho(safeDiv(pReat - 30, 70))} type="range" min={30} max={100} step={5} value={pReat} onChange={(e) => setPReat(+e.target.value)} />
            <span className="small muted">Quem volta costuma recomeçar com pedidos menores</span>
          </div>
          <button className="btn sm ghost" onClick={() => { setN(ref.clientes); setTicket(ref.ticket); setReat(0); setPReat(60) }}>Voltar ao último mês</button>
        </div>
        <div className="sim-out">
          <span className="kpi-label">Faturamento mensal estimado</span>
          <b className="sim-valor">{money(fatEstimado)}</b>
          <span className="sim-delta" style={{ color: delta >= 0 ? 'var(--good)' : 'var(--bad)' }}>{delta >= 0 ? '+' : '−'} {money(Math.abs(delta))} sobre {ref.mes}</span>
          <div style={{ marginTop: 22 }}>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Meta mensal {money(ref.meta)}</span><b>{pct(safeDiv(fatEstimado, ref.meta))}</b></div>
            <Meter value={safeDiv(fatEstimado, ref.meta)} />
          </div>
          <div style={{ marginTop: 18 }}>
            <StatRow label={`Para bater a meta com ticket de ${money(ticket)}`} value={`${int(clientesParaMeta)} clientes comprando`} />
            <StatRow label={`Com ${int(n + reat)} clientes comprando, o ticket precisa ser`} value={money(ticketParaMeta)} />
          </div>
        </div>
      </div>

      <Card className="mt" title="Cenários de referência" sub="clique para levar às réguas">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Cenário</th><th className="num">Clientes</th><th className="num">Ticket</th><th className="num">Faturamento</th><th className="num">da meta</th></tr></thead>
            <tbody>
              {cenarios.map((c) => (
                <tr key={c.nome} className="clickable" onClick={() => { setN(Math.min(ref.base, c.n)); setTicket(Math.round(c.t / 100) * 100); setReat(0) }}>
                  <td>{c.nome}</td>
                  <td className="num">{int(c.n)}</td>
                  <td className="num">{money(c.t)}</td>
                  <td className="num">{money(c.n * c.t)}</td>
                  <td className="num">{pct(safeDiv(c.n * c.t, ref.meta))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Leitura: subir o número de revendas comprando costuma pesar mais do que subir o ticket, e reduz a dependência de poucas clientes.</p>
      </Card>
    </>
  )
}

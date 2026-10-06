import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { Badge, Card, Kpi, Meter, PageHead, Person } from '../components/ui'
import { RevenueChart } from '../components/charts'
import {
  ativacao, aging, carteira, curvaABC, debitosPorCliente, devolucoesValidas, leadParado, leadsNoPeriodo, metaDoPeriodo,
  pedidosNoPeriodo, serieMensal, somaValor, ultimaCompraMap,
} from '../lib/metrics'
import { dayMonth, money, pct, safeDiv, int, date } from '../lib/format'
import { addDays, diffDays, inRange, today } from '../lib/dates'
import { TIPO_EVENTO } from '../data/labels'

export default function Dashboard() {
  const { db, periodo } = useStore()

  const d = useMemo(() => {
    const hoje = today()
    const ped = pedidosNoPeriodo(db, periodo)
    const fat = somaValor(ped)
    const meta = metaDoPeriodo(db.config.metaFaturamentoMensal, periodo)
    const at = ativacao(db, periodo)
    const dev = somaValor(devolucoesValidas(db).filter((x) => inRange(x.data, periodo)))
    const recAbertas = db.reclamacoes.filter((r) => r.status !== 'resolvida')
    const ag = aging(db.titulos)
    const vencido = Object.values(ag).reduce((s, v) => s + v, 0)
    const vendedores = db.colaboradores.filter((c) => c.cargo !== 'analista' && c.ativo)
    const equipe = vendedores.map((c) => {
      const f = somaValor(pedidosNoPeriodo(db, periodo, c.id))
      const m = metaDoPeriodo(c.metaMensal, periodo)
      const a = ativacao(db, periodo, c.id)
      return { c, f, m, a }
    }).sort((a, b) => safeDiv(b.f, b.m) - safeDiv(a.f, a.m))

    const eventos = db.eventos.filter((e) => e.dataInicio >= hoje && e.status !== 'cancelado').sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)).slice(0, 4)
    const caindo = db.clientes.filter((c) => c.status === 'em_queda' && c.quedaData && c.quedaData >= hoje).sort((a, b) => a.quedaData!.localeCompare(b.quedaData!)).slice(0, 5)

    const leads = leadsNoPeriodo(db, periodo)
    const ganhos = leads.filter((l) => l.etapa === 'ganho').length
    const invest = metaDoPeriodo(db.config.investimentoMidiaMensal, periodo)
    const pagos = leads.filter((l) => l.origem === 'meta' || l.origem === 'google').length

    // Alertas de gestão
    const ult = ultimaCompraMap(db)
    const abc = curvaABC(db)
    const deb = debitosPorCliente(db)
    const curvaASemCompra = carteira(db).filter((c) => abc.get(c.id) === 'A' && diffDays(hoje, ult.get(c.id) || '2000-01-01') > db.config.diasInatividadeAlerta)
    const debitos30 = Array.from(deb.entries()).filter(([, v]) => v.maiorAtraso > 30)
    const brindesBaixos = db.brindes.filter((b) => b.estoque < b.estoqueMinimo)
    const leadsParados = db.leads.filter((l) => leadParado(l))
    const recAlta = recAbertas.filter((r) => r.prioridade === 'alta')
    const tarefasHoje = db.tarefas.filter((t) => !t.concluida && t.prazo <= addDays(hoje, 1))

    return { ped, fat, meta, at, dev, recAbertas, vencido, equipe, eventos, caindo, leads, ganhos, invest, pagos, curvaASemCompra, debitos30, brindesBaixos, leadsParados, recAlta, tarefasHoje, serie: serieMensal(db, 12) }
  }, [db, periodo])

  const metaAt = db.config.metaAtivacao
  const ticket = safeDiv(d.fat, d.ped.length)

  return (
    <>
      <PageHead
        eyebrow={db.config.nomeUnidade}
        title="Visão geral"
        desc={<>Gestão à vista do showroom — {periodo.label.toLowerCase()}. Coleção atual: <b>{db.config.colecaoAtual}</b>.</>}
      />

      <div className="grid g-5">
        <Kpi label="Faturamento" value={money(d.fat)} foot={<><b>{pct(safeDiv(d.fat, d.meta))}</b> da meta de {money(d.meta)}</>}>
          <Meter value={safeDiv(d.fat, d.meta)} target={1} />
        </Kpi>
        <Kpi label="Ativação da base" value={pct(d.at.taxa)} foot={<>{d.at.ativos} de {d.at.base} revendas · meta {pct(metaAt)}</>}>
          <Meter value={d.at.taxa} target={metaAt} />
        </Kpi>
        <Kpi label="Ticket médio" value={money(ticket)} foot={<>{int(d.ped.length)} pedidos faturados</>} />
        <Kpi label="Devoluções" value={money(d.dev)} foot={<>{pct(safeDiv(d.dev, d.fat), 1)} do faturamento</>} />
        <Kpi label="Débitos vencidos" value={money(d.vencido)} foot={<Link to="/financeiro">{d.debitos30.length} revendas com atraso &gt; 30 dias</Link>} />
      </div>

      <div className="grid g-2-1 mt">
        <Card title="Faturamento x meta" sub="últimos 12 meses">
          <RevenueChart data={d.serie} height={400} />
        </Card>
        <Card title="Atenção hoje" sub="o que pede ação">
          <div className="list" style={{ gap: 8 }}>
            {d.tarefasHoje.length > 0 && <Alerta tone="info" to="/agenda">{d.tarefasHoje.length} tarefa(s) vencendo até amanhã</Alerta>}
            {d.caindo.filter((c) => c.quedaData! <= addDays(today(), 15)).length > 0 && (
              <Alerta tone="bad" to="/expansao">{d.caindo.filter((c) => c.quedaData! <= addDays(today(), 15)).length} revenda(s) caem nos próximos 15 dias — prepare a reposição da região</Alerta>
            )}
            {d.curvaASemCompra.length > 0 && <Alerta tone="warn" to="/carteira">{d.curvaASemCompra.length} revenda(s) curva A sem comprar há +{db.config.diasInatividadeAlerta} dias</Alerta>}
            {d.recAlta.length > 0 && <Alerta tone="bad" to="/pos-venda">{d.recAlta.length} reclamação(ões) de prioridade alta em aberto</Alerta>}
            {d.debitos30.length > 0 && <Alerta tone="warn" to="/financeiro">{d.debitos30.length} revenda(s) com débito vencido há +30 dias</Alerta>}
            {d.leadsParados.length > 0 && <Alerta tone="info" to="/leads">{d.leadsParados.length} lead(s) sem interação há +7 dias</Alerta>}
            {d.brindesBaixos.length > 0 && <Alerta tone="warn" to="/brindes">{d.brindesBaixos.length} brinde(s) abaixo do estoque mínimo</Alerta>}
            {d.at.taxa < metaAt && (
              <Alerta tone="warn" to="/carteira">Faltam {Math.max(0, Math.ceil(d.at.base * metaAt) - d.at.ativos)} revendas comprando para bater {pct(metaAt)} de ativação</Alerta>
            )}
          </div>
        </Card>
      </div>

      <Card title="Equipe — meta de faturamento e ativação" sub={periodo.label} className="mt" right={<Link to="/equipe" className="small">Ver detalhes →</Link>}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Pessoa</th><th className="num">Faturado</th><th className="num">Meta</th><th style={{ width: '22%' }}>Atingimento</th><th className="num">Ativação</th><th style={{ width: '18%' }}>Base ativa (meta {pct(metaAt)})</th></tr>
            </thead>
            <tbody>
              {d.equipe.map(({ c, f, m, a }) => (
                <tr key={c.id}>
                  <td><Person id={c.id} sub={c.cargo === 'vendedora' ? 'Vendedora' : 'Representante'} /></td>
                  <td className="num strong">{money(f)}</td>
                  <td className="num muted">{money(m)}</td>
                  <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div style={{ flex: 1 }}><Meter value={safeDiv(f, m)} /></div><b className="small">{pct(safeDiv(f, m))}</b></div></td>
                  <td className="num"><b>{pct(a.taxa)}</b> <span className="muted small">({a.ativos}/{a.base})</span></td>
                  <td><Meter value={a.taxa} target={c.metaAtivacao} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g-3 mt">
        <Card title="Próximos eventos" right={<Link to="/eventos" className="small">Calendário →</Link>}>
          <div className="list">
            {d.eventos.map((e) => (
              <div className="list-item" key={e.id}>
                <div className="date-chip"><div className="d">{e.dataInicio.slice(8, 10)}</div><div className="m">{dayMonth(e.dataInicio).split(' ')[1]}</div></div>
                <div className="grow">
                  <div className="strong">{e.titulo}</div>
                  <div className="small muted">{TIPO_EVENTO[e.tipo]} · meta {money(e.metaFaturamento)}</div>
                </div>
              </div>
            ))}
            {!d.eventos.length && <div className="empty">Nenhum evento agendado.</div>}
          </div>
        </Card>
        <Card title="Revendas que vão cair" right={<Link to="/expansao" className="small">Expansão →</Link>}>
          <div className="list">
            {d.caindo.map((c) => {
              const dias = diffDays(c.quedaData!, today())
              return (
                <div className="list-item" key={c.id}>
                  <div className="grow">
                    <div className="strong">{c.nome}</div>
                    <div className="small muted">{c.cidade}/{c.uf} · {c.quedaMotivo}</div>
                  </div>
                  <Badge tone={dias <= 15 ? 'bad' : 'warn'}>{date(c.quedaData)} · {dias}d</Badge>
                </div>
              )
            })}
            {!d.caindo.length && <div className="empty">Nenhuma revenda com encerramento previsto.</div>}
          </div>
        </Card>
        <Card title="Leads & tráfego" sub={periodo.label} right={<Link to="/leads" className="small">Funil →</Link>}>
          <div className="grid g-2" style={{ gap: 10 }}>
            <MiniStat label="Leads recebidos" value={int(d.leads.length)} />
            <MiniStat label="Viraram revenda" value={int(d.ganhos)} />
            <MiniStat label="Conversão" value={pct(safeDiv(d.ganhos, d.leads.length), 1)} />
            <MiniStat label="CPL mídia paga" value={money(safeDiv(d.invest, d.pagos))} />
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>Investimento de referência: {money(db.config.investimentoMidiaMensal)}/mês ({pct(db.config.divisaoMeta)} Meta · {pct(1 - db.config.divisaoMeta)} Google).</p>
        </Card>
      </div>
    </>
  )
}

function Alerta({ tone, to, children }: { tone: 'bad' | 'warn' | 'info' | 'good'; to: string; children: React.ReactNode }) {
  const icon = tone === 'bad' ? '!' : tone === 'warn' ? '△' : 'i'
  return (
    <Link to={to} className={`alert ${tone}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className="ico" aria-label={tone === 'bad' ? 'Crítico' : tone === 'warn' ? 'Atenção' : 'Informação'}>{icon}</span>
      <span>{children}</span>
    </Link>
  )
}

export function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '10px 12px' }}>
      <div className="small muted">{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

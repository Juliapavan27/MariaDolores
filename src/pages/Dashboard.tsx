import { useMemo, type ReactNode } from 'react'
import { Link } from '../lib/router'
import { useStore } from '../data/store'
import { Badge, Card, Kpi, Meter, Person } from '../components/ui'
import { RevenueChart } from '../components/charts'
import {
  ativacao, aging, carteira, curvaABC, debitosPorCliente, devolucoesValidas, leadParado, leadsNoPeriodo, metaDoPeriodo,
  pedidosNoPeriodo, serieMensal, somaValor, ultimaCompraMap,
} from '../lib/metrics'
import { dayMonth, money, pct, safeDiv, int, date } from '../lib/format'
import { addDays, diffDays, inRange, today } from '../lib/dates'
import { TIPO_EVENTO } from '../data/labels'
import { lerCarteira } from '../lib/carteira'

const saudacao = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

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
    const vencido = Object.values(aging(db.titulos)).reduce((s, v) => s + v, 0)
    const equipe = db.colaboradores
      .filter((c) => c.cargo !== 'analista' && c.ativo)
      .map((c) => ({ c, f: somaValor(pedidosNoPeriodo(db, periodo, c.id)), m: metaDoPeriodo(c.metaMensal, periodo), a: ativacao(db, periodo, c.id) }))
      .sort((a, b) => safeDiv(b.f, b.m) - safeDiv(a.f, a.m))

    const eventos = db.eventos.filter((e) => e.dataInicio >= hoje && e.status !== 'cancelado').sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)).slice(0, 4)
    const caindo = db.clientes.filter((c) => c.status === 'em_queda' && c.quedaData && c.quedaData >= hoje).sort((a, b) => a.quedaData!.localeCompare(b.quedaData!))

    const leads = leadsNoPeriodo(db, periodo)
    const ganhos = leads.filter((l) => l.etapa === 'ganho').length
    const invest = metaDoPeriodo(db.config.investimentoMidiaMensal, periodo)
    const pagos = leads.filter((l) => l.origem === 'meta' || l.origem === 'google').length

    const ult = ultimaCompraMap(db)
    const abc = curvaABC(db)
    const deb = debitosPorCliente(db)
    const pend: { tone: 'bad' | 'warn' | 'info'; n: number; txt: string; to: string }[] = []
    const add = (tone: 'bad' | 'warn' | 'info', n: number, [um, varios]: [string, string], to: string) => {
      if (n > 0) pend.push({ tone, n, txt: n === 1 ? um : varios, to })
    }
    add('bad', caindo.filter((c) => c.quedaData! <= addDays(hoje, 15)).length, ['revenda cai nos próximos 15 dias', 'revendas caem nos próximos 15 dias'], '/expansao')
    add('bad', recAbertas.filter((r) => r.prioridade === 'alta').length, ['reclamação de prioridade alta em aberto', 'reclamações de prioridade alta em aberto'], '/pos-venda')
    add('warn', carteira(db).filter((c) => abc.get(c.id) === 'A' && diffDays(hoje, ult.get(c.id) || '2000-01-01') > db.config.diasInatividadeAlerta).length, [`revenda curva A sem comprar há mais de ${db.config.diasInatividadeAlerta} dias`, `revendas curva A sem comprar há mais de ${db.config.diasInatividadeAlerta} dias`], '/carteira')
    add('warn', Array.from(deb.values()).filter((v) => v.maiorAtraso > 30).length, ['revenda com débito vencido há mais de 30 dias', 'revendas com débito vencido há mais de 30 dias'], '/financeiro')
    add('warn', db.brindes.filter((b) => b.estoque < b.estoqueMinimo).length, ['brinde abaixo do estoque mínimo', 'brindes abaixo do estoque mínimo'], '/brindes')
    add('bad', lerCarteira(db).filter((l) => l.followUpVencido).length, ['follow-up combinado está vencido', 'follow-ups combinados estão vencidos'], '/semana')
    add('info', db.tarefas.filter((t) => !t.concluida && t.prazo <= addDays(hoje, 1)).length, ['tarefa vencendo até amanhã', 'tarefas vencendo até amanhã'], '/agenda')
    add('info', db.leads.filter((l) => leadParado(l)).length, ['lead sem interação há mais de 7 dias', 'leads sem interação há mais de 7 dias'], '/leads')

    return { ped, fat, meta, at, dev, vencido, equipe, eventos, caindo, leads, ganhos, invest, pagos, pend, serie: serieMensal(db, 12) }
  }, [db, periodo])

  const metaAt = db.config.metaAtivacao
  const faltam = Math.max(0, Math.ceil(d.at.base * metaAt) - d.at.ativos)

  return (
    <>
      <header className="hello">
        <div>
          <div className="eyebrow">{db.config.nomeUnidade} · {db.config.colecaoAtual}</div>
          <h1>{saudacao()}, <em>equipe.</em></h1>
          <p>
            {faltam > 0
              ? <>Faltam <b>{faltam} revendas</b> comprando para chegar a {pct(metaAt)} de ativação, e <b>{money(Math.max(0, d.meta - d.fat))}</b> para a meta de faturamento — {periodo.label.toLowerCase()}.</>
              : <>Meta de ativação atingida em {periodo.label.toLowerCase()}. Faltam <b>{money(Math.max(0, d.meta - d.fat))}</b> para a meta de faturamento.</>}
          </p>
        </div>
        <div className="right">
          <div className="big">{pct(safeDiv(d.fat, d.meta))}</div>
          <div className="cap">da meta do período</div>
        </div>
      </header>

      <div className="kpi-strip k5">
        <Kpi label="Faturamento" value={money(d.fat)} foot={<>meta {money(d.meta)}</>}>
          <Meter value={safeDiv(d.fat, d.meta)} target={1} />
        </Kpi>
        <Kpi label="Ativação da base" value={pct(d.at.taxa)} foot={<>{d.at.ativos} de {d.at.base} revendas · meta {pct(metaAt)}</>}>
          <Meter value={d.at.taxa} target={metaAt} />
        </Kpi>
        <Kpi label="Ticket médio" value={money(safeDiv(d.fat, d.ped.length))} foot={<>{int(d.ped.length)} pedidos faturados</>} />
        <Kpi label="Devoluções" value={money(d.dev)} foot={<>{pct(safeDiv(d.dev, d.fat), 1)} do faturamento</>} />
        <Kpi label="Débitos vencidos" value={money(d.vencido)} foot={<Link to="/financeiro">ver cobrança</Link>} />
      </div>

      <div className="grid g-2-1 mt">
        <Card title="Faturamento e meta" sub="últimos 12 meses">
          <RevenueChart data={d.serie} height={330} />
        </Card>
        <Card title="Atenção hoje">
          <div className="todo">
            {d.pend.map((p) => (
              <Link key={p.txt} to={p.to}>
                <span className="dot" style={{ background: `var(--${p.tone === 'info' ? 'line-strong' : p.tone})` }} aria-label={p.tone === 'bad' ? 'Crítico' : p.tone === 'warn' ? 'Atenção' : 'Informação'} />
                <span><span className="num">{p.n}</span>{p.txt}</span>
                <span className="arrow">→</span>
              </Link>
            ))}
            {!d.pend.length && <div className="empty">Nada pendente. Tudo em ordem.</div>}
          </div>
        </Card>
      </div>

      <Card title="Equipe" sub={`faturamento e ativação · ${periodo.label}`} className="mt" right={<Link to="/equipe">Detalhes</Link>}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Pessoa</th><th className="num">Faturado</th><th className="num">Meta</th><th style={{ width: '22%' }}>Atingimento</th><th className="num">Ativação</th><th style={{ width: '18%' }}>Base ativa · meta {pct(metaAt)}</th></tr>
            </thead>
            <tbody>
              {d.equipe.map(({ c, f, m, a }) => (
                <tr key={c.id}>
                  <td><Person id={c.id} sub={c.cargo === 'vendedora' ? 'Vendedora' : 'Representante'} /></td>
                  <td className="num">{money(f)}</td>
                  <td className="num muted">{money(m)}</td>
                  <td><Bar value={safeDiv(f, m)} /></td>
                  <td className="num">{pct(a.taxa)} <span className="muted small">{a.ativos}/{a.base}</span></td>
                  <td><Meter value={a.taxa} target={c.metaAtivacao} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g-3 mt">
        <Card title="Próximos eventos" right={<Link to="/eventos">Calendário</Link>}>
          <div className="list">
            {d.eventos.map((e) => (
              <div className="list-item" key={e.id}>
                <div className="date-chip"><div className="d">{e.dataInicio.slice(8, 10)}</div><div className="m">{dayMonth(e.dataInicio).split(' ')[1]}</div></div>
                <div className="grow">
                  <div>{e.titulo}</div>
                  <div className="small muted">{TIPO_EVENTO[e.tipo]} · meta {money(e.metaFaturamento)}</div>
                </div>
              </div>
            ))}
            {!d.eventos.length && <div className="empty">Nenhum evento agendado.</div>}
          </div>
        </Card>
        <Card title="Revendas que vão cair" right={<Link to="/expansao">Expansão</Link>}>
          <div className="list">
            {d.caindo.slice(0, 5).map((c) => {
              const dias = diffDays(c.quedaData!, today())
              return (
                <div className="list-item" key={c.id}>
                  <div className="grow">
                    <div>{c.nome}</div>
                    <div className="small muted">{c.cidade}/{c.uf}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="small">{date(c.quedaData)}</div>
                    <Badge tone={dias <= 15 ? 'bad' : 'warn'}>em {dias} dias</Badge>
                  </div>
                </div>
              )
            })}
            {!d.caindo.length && <div className="empty">Nenhuma revenda com encerramento previsto.</div>}
          </div>
        </Card>
        <Card title="Leads & tráfego" sub={periodo.label} right={<Link to="/leads">Funil</Link>}>
          <div className="grid g-2" style={{ gap: '18px 20px' }}>
            <MiniStat label="Leads" value={int(d.leads.length)} />
            <MiniStat label="Viraram revenda" value={int(d.ganhos)} />
            <MiniStat label="Conversão" value={pct(safeDiv(d.ganhos, d.leads.length), 1)} />
            <MiniStat label="Custo por lead" value={money(safeDiv(d.invest, d.pagos))} />
          </div>
          <p className="small muted" style={{ margin: '20px 0 0', lineHeight: 1.6 }}>Verba de {money(db.config.investimentoMidiaMensal)}/mês — {pct(db.config.divisaoMeta)} Meta, {pct(1 - db.config.divisaoMeta)} Google.</p>
        </Card>
      </div>
    </>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ flex: 1 }}><Meter value={value} /></div>
      <span className="small" style={{ width: 38, textAlign: 'right' }}>{pct(value)}</span>
    </div>
  )
}

export function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mini-stat">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
    </div>
  )
}

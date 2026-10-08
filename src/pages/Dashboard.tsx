import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from '../lib/router'
import { useStore } from '../data/store'
import { Badge, Card, Kpi, Meter, Person } from '../components/ui'
import { RevenueChart } from '../components/charts'
import { faturamentoBI, mesesComFechamento, metaPessoa, metaShowroom, quedasPrevistas,
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
  const navigate = useNavigate()

  const d = useMemo(() => {
    const hoje = today()
    const ped = pedidosNoPeriodo(db, periodo)
    const fat = faturamentoBI(db, periodo)
    const meta = metaShowroom(db, periodo)
    const at = ativacao(db, periodo)
    const dev = somaValor(devolucoesValidas(db).filter((x) => inRange(x.data, periodo)))
    const recAbertas = db.reclamacoes.filter((r) => r.status !== 'resolvida')
    const vencido = Object.values(aging(db.titulos)).reduce((s, v) => s + v, 0)
    const equipe = db.colaboradores
      .filter((c) => c.cargo !== 'analista' && c.ativo)
      .map((c) => ({ c, f: faturamentoBI(db, periodo, c.id), m: metaPessoa(c, periodo), a: ativacao(db, periodo, c.id) }))
      .sort((a, b) => safeDiv(b.f, b.m) - safeDiv(a.f, a.m))

    const eventos = db.eventos.filter((e) => e.dataInicio >= hoje && e.status !== 'cancelado').sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)).slice(0, 4)
    const caindo = quedasPrevistas(db, hoje).filter((q) => q.data >= hoje)

    const leads = leadsNoPeriodo(db, periodo)
    const ganhos = leads.filter((l) => l.etapa === 'ganho').length
    const invest = metaDoPeriodo(db.config.investimentoMidiaMensal, periodo)
    const pagos = leads.filter((l) => l.origem === 'meta' || l.origem === 'google').length

    const ult = ultimaCompraMap(db)
    const abc = curvaABC(db)
    const deb = debitosPorCliente(db)
    const pend: { tone: 'bad' | 'warn' | 'info'; n: number; txt: string; to: string; ids: string[] }[] = []
    const add = (tone: 'bad' | 'warn' | 'info', ids: string[], [um, varios]: [string, string], to: string) => {
      const n = ids.length
      if (n > 0) pend.push({ tone, n, txt: n === 1 ? um : varios, to, ids })
    }
    add('bad', caindo.filter((q) => q.data <= addDays(hoje, 15)).map((q) => q.cliente.id), ['revenda cai nos próximos 15 dias', 'revendas caem nos próximos 15 dias'], '/expansao')
    add('bad', recAbertas.filter((r) => r.prioridade === 'alta').map((r) => r.id), ['reclamação de prioridade alta em aberto', 'reclamações de prioridade alta em aberto'], '/pos-venda')
    add('warn', carteira(db).filter((c) => abc.get(c.id) === 'A' && diffDays(hoje, ult.get(c.id) || '2000-01-01') > db.config.diasInatividadeAlerta).map((c) => c.id), [`revenda curva A sem comprar há mais de ${db.config.diasInatividadeAlerta} dias`, `revendas curva A sem comprar há mais de ${db.config.diasInatividadeAlerta} dias`], '/carteira')
    add('warn', Array.from(deb.entries()).filter(([, v]) => v.maiorAtraso > 30).map(([id]) => id), ['revenda com débito vencido há mais de 30 dias', 'revendas com débito vencido há mais de 30 dias'], '/financeiro')
    add('warn', db.brindes.filter((b) => b.estoque < b.estoqueMinimo).map((b) => b.id), ['brinde abaixo do estoque mínimo', 'brindes abaixo do estoque mínimo'], '/brindes')
    add('bad', lerCarteira(db).filter((l) => l.followUpVencido).map((l) => l.cliente.id), ['follow-up combinado está vencido', 'follow-ups combinados estão vencidos'], '/semana')
    add('info', db.tarefas.filter((t) => !t.concluida && t.prazo <= addDays(hoje, 1)).map((t) => t.id), ['tarefa vencendo até amanhã', 'tarefas vencendo até amanhã'], '/agenda')
    add('info', db.leads.filter((l) => leadParado(l)).map((l) => l.id), ['lead sem interação há mais de 7 dias', 'leads sem interação há mais de 7 dias'], '/leads')

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
            {!d.at.base
              ? <>Base vazia por enquanto. Siga o roteiro abaixo para cadastrar a equipe e trazer as revendas.</>
              : faltam > 0
              ? <>Faltam <b>{faltam} revendas</b> comprando para chegar a {pct(metaAt)} de ativação, e <b>{money(Math.max(0, d.meta - d.fat))}</b> para a meta de faturamento — {periodo.label.toLowerCase()}.</>
              : <>Meta de ativação atingida em {periodo.label.toLowerCase()}. Faltam <b>{money(Math.max(0, d.meta - d.fat))}</b> para a meta de faturamento.</>}
          </p>
        </div>
        <div className="right">
          <div className="big">{pct(safeDiv(d.fat, d.meta))}</div>
          <div className="cap">da meta do período</div>
        </div>
      </header>

      {(!db.colaboradores.length || !db.clientes.length) && <ComeceAqui />}

      <div className="kpi-strip k5">
        <Kpi label="Faturamento líquido" value={money(d.fat)} foot={<>meta {money(d.meta)}{mesesComFechamento(db, periodo).length ? ' · fechamento do BI' : ''}</>} onClick={() => navigate('/faturamento')} acao="ver faturamento">
          <Meter value={safeDiv(d.fat, d.meta)} target={1} />
        </Kpi>
        <Kpi label="Ativação da base" value={pct(d.at.taxa)} foot={<>{d.at.ativos} de {d.at.base} revendas · meta {pct(metaAt)}</>} onClick={d.at.inativos.length ? () => navigate('/carteira', { titulo: `${d.at.inativos.length} revendas da carteira sem compra no período`, ids: d.at.inativos.map((c) => c.id) }) : undefined} acao="ver quem não comprou">
          <Meter value={d.at.taxa} target={metaAt} />
        </Kpi>
        <Kpi label="Ticket médio" value={money(safeDiv(d.fat, d.ped.length))} foot={<>{int(d.ped.length)} pedidos faturados</>} onClick={() => navigate('/faturamento')} acao="ver pedidos" />
        <Kpi label="Devoluções" value={money(d.dev)} foot={<>{pct(safeDiv(d.dev, d.fat), 1)} do faturamento</>} onClick={() => navigate('/pos-venda')} acao="ver devoluções" />
        <Kpi label="Débitos vencidos" value={money(d.vencido)} foot="títulos em atraso" onClick={() => navigate('/financeiro')} acao="ver cobrança" />
      </div>

      <div className="grid g-2-1 mt">
        <Card title="Faturamento e meta" sub="últimos 12 meses">
          <RevenueChart data={d.serie} height={330} />
        </Card>
        <Card title="Atenção hoje">
          <div className="todo">
            {d.pend.map((p) => (
              <Link key={p.txt} to={p.to} foco={{ titulo: `${p.n} ${p.txt}`, ids: p.ids }}>
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
        <Card title="Revendas que vão cair" right={<Link to="/expansao" foco={d.caindo.length ? { titulo: `${d.caindo.length} revendas com queda prevista`, ids: d.caindo.map((q) => q.cliente.id) } : undefined}>Expansão</Link>}>
          <div className="list">
            {d.caindo.slice(0, 5).map(({ cliente: c, data, automatica }) => {
              const dias = diffDays(data, today())
              return (
                <div className="list-item" key={c.id}>
                  <div className="grow">
                    <div>{c.nome}</div>
                    <div className="small muted">{c.cidade ? `${c.cidade}/${c.uf}` : 'cidade não informada'}{automatica ? ' · sem compra' : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="small">{date(data)}</div>
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

/** Roteiro para quem está começando com a base vazia. */
function ComeceAqui() {
  const { db, modo } = useStore()
  const passos = [
    { feito: modo === 'equipe', titulo: 'Iniciar a base da equipe', texto: 'No aviso dourado do topo. A partir daí tudo fica salvo para todos.', to: '/', acao: '' },
    { feito: false, titulo: 'Conferir as metas gerais', texto: 'Meta mensal do showroom, ativação de 70%, verba de mídia.', to: '/config', acao: 'Abrir configurações' },
    { feito: db.colaboradores.length > 0, titulo: 'Cadastrar a equipe', texto: 'Vendedoras, representantes e analista, com a meta de cada uma.', to: '/equipe', acao: 'Abrir equipe' },
    { feito: db.clientes.length > 0, titulo: 'Trazer as revendas', texto: 'Importe a planilha do B2B ou cadastre uma a uma.', to: '/importar', acao: 'Importar dados' },
    { feito: db.pedidos.length > 0, titulo: 'Trazer pedidos e títulos', texto: 'Com eles aparecem faturamento, ativação e débitos.', to: '/importar', acao: 'Importar dados' },
  ]
  return (
    <Card title="Comece por aqui" sub="a base está vazia" className="comece">
      <ol className="comece-lista">
        {passos.map((p) => (
          <li key={p.titulo} className={p.feito ? 'feito' : ''}>
            <span className="marca">{p.feito ? '✓' : ''}</span>
            <div><div className="t">{p.titulo}</div><div className="small muted">{p.texto}</div></div>
            {p.acao && !p.feito && <Link to={p.to} className="btn sm">{p.acao}</Link>}
          </li>
        ))}
      </ol>
    </Card>
  )
}

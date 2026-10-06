import { useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Database, Evento } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, Meter, Modal, PageHead, Person, Segmented, StatRow, opts } from '../components/ui'
import { HBars, useChartColors } from '../components/charts'
import { date, money, pct, safeDiv, int, MESES_LONGOS } from '../lib/format'
import { addDays, addMonths, inRange, parse, startOfMonth, today } from '../lib/dates'
import { STATUS_EVENTO, TIPO_EVENTO } from '../data/labels'
import { exportCSV } from '../lib/csv'
import { IcChevL, IcChevR, IcDownload, IcPlus } from '../components/Icons'

/** Resultado consolidado de um evento: pedidos vinculados + lançamentos manuais + brindes. */
export function resultadoEvento(db: Database, e: Evento) {
  const pedidos = db.pedidos.filter((p) => p.eventoId === e.id && p.status === 'faturado')
  const fatPedidos = pedidos.reduce((s, p) => s + p.valor, 0)
  const faturamento = fatPedidos + (e.faturamentoEvento || 0)
  const pecas = pedidos.reduce((s, p) => s + p.pecas, 0) || e.pecasVendidas || 0
  const brindes = db.movBrindes.filter((m) => m.eventoId === e.id && m.tipo === 'saida')
  const custoBrindes = brindes.reduce((s, m) => s + m.quantidade * (db.brindes.find((b) => b.id === m.brindeId)?.custoUnitario || 0), 0)
  const custoTotal = e.custo + custoBrindes
  const compradoras = new Set(pedidos.map((p) => p.clienteId))
  const revendas = Array.from(new Set([...(e.revendasIds || []), ...compradoras]))
  return {
    pedidos, faturamento, pecas, brindes, custoBrindes, custoTotal, revendas, compradoras: compradoras.size,
    roi: safeDiv(faturamento, custoTotal),
    ticket: safeDiv(faturamento, compradoras.size || e.clientesPresentes || 0),
    atingimento: safeDiv(faturamento, e.metaFaturamento),
    conversao: safeDiv(compradoras.size, e.clientesPresentes || 0),
  }
}

const toneStatus = (s: Evento['status']) => (s === 'realizado' ? 'good' : s === 'confirmado' ? 'info' : s === 'cancelado' ? undefined : 'gold')

export default function Eventos() {
  const { db, periodo, upsert, remove } = useStore()
  const [view, setView] = useState<'calendario' | 'resultados'>('calendario')
  const [mes, setMes] = useState(startOfMonth(today()))
  const [ver, setVer] = useState<Evento | null>(null)
  const [edit, setEdit] = useState<Evento | null>(null)
  const [mostrarVisitas, setMostrarVisitas] = useState(true)
  const colors = useChartColors()

  const realizados = useMemo(
    () => db.eventos.filter((e) => e.status === 'realizado' && inRange(e.dataInicio, periodo)).map((e) => ({ ...e, r: resultadoEvento(db, e) })),
    [db, periodo],
  )
  const todosResultados = useMemo(() => db.eventos.map((e) => ({ ...e, r: resultadoEvento(db, e) })), [db])
  const fat = realizados.reduce((s, e) => s + e.r.faturamento, 0)
  const custo = realizados.reduce((s, e) => s + e.r.custoTotal, 0)
  const nps = realizados.filter((e) => e.nps != null)

  const novo = (data = today()): Evento => ({
    id: newId('ev'), titulo: '', tipo: 'lancamento', dataInicio: data, dataFim: data, horario: '14h às 20h', local: 'Showroom SP', colecao: db.config.colecaoAtual,
    responsavelId: db.colaboradores[0]?.id || '', status: 'planejado', metaFaturamento: 0, metaClientes: 0, custo: 0, convidados: 0,
  })

  return (
    <>
      <PageHead
        eyebrow="Showroom"
        title="Eventos"
        desc="Calendário do showroom e o resultado de cada evento: revendas presentes, clientes, faturamento, ROI, NPS e aprendizados."
        actions={<>
          <button className="btn" onClick={() => exportCSV('eventos.csv', todosResultados.map((e) => ({ Data: date(e.dataInicio), Evento: e.titulo, Tipo: TIPO_EVENTO[e.tipo], Status: STATUS_EVENTO[e.status], Local: e.local, 'Meta faturamento': e.metaFaturamento, Faturamento: e.r.faturamento, 'Clientes presentes': e.clientesPresentes ?? '', 'Revendas compradoras': e.r.compradoras, 'Novos cadastros': e.novosCadastros ?? '', Leads: e.leadsGerados ?? '', Custo: e.r.custoTotal, ROI: e.r.roi.toFixed(1), NPS: e.nps ?? '' })))}><IcDownload /> Exportar</button>
          <button className="btn primary" onClick={() => setEdit(novo())}><IcPlus /> Novo evento</button>
        </>}
      />
      <div className="kpi-strip k5">
        <Kpi label="Eventos realizados" value={int(realizados.length)} foot={periodo.label} />
        <Kpi label="Faturado em eventos" value={money(fat)} foot={`meta ${money(realizados.reduce((s, e) => s + e.metaFaturamento, 0))}`} />
        <Kpi label="ROI médio" value={custo ? `${safeDiv(fat, custo).toFixed(1)}x` : '—'} foot={`investimento ${money(custo)}`} />
        <Kpi label="Clientes atendidas" value={int(realizados.reduce((s, e) => s + (e.clientesPresentes || 0), 0))} foot={`${int(realizados.reduce((s, e) => s + (e.novosCadastros || 0), 0))} novos cadastros`} />
        <Kpi label="NPS médio" value={nps.length ? (nps.reduce((s, e) => s + (e.nps || 0), 0) / nps.length).toFixed(1) : '—'} foot="nota 0 a 10" />
      </div>

      <div className="toolbar mt-lg">
        <Segmented value={view} onChange={setView} options={[{ value: 'calendario', label: 'Calendário' }, { value: 'resultados', label: 'Resultados' }]} />
      </div>

      {view === 'calendario' ? (
        <Card
          title={<span style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>{MESES_LONGOS[parse(mes).getMonth()]} {parse(mes).getFullYear()}</span>}
          right={<>
            <label className="check small"><input type="checkbox" checked={mostrarVisitas} onChange={(e) => setMostrarVisitas(e.target.checked)} /> Visitas agendadas</label>
            <button className="btn sm" onClick={() => setMes(addMonths(mes, -1))} aria-label="Mês anterior"><IcChevL /></button>
            <button className="btn sm" onClick={() => setMes(startOfMonth(today()))}>Hoje</button>
            <button className="btn sm" onClick={() => setMes(addMonths(mes, 1))} aria-label="Próximo mês"><IcChevR /></button>
          </>}
        >
          <Calendario mes={mes} onEvento={setVer} onDia={(d) => setEdit(novo(d))} visitas={mostrarVisitas} />
          <div className="legend mt">
            <span><i style={{ background: 'var(--gold)' }} /> Planejado / confirmado</span>
            <span><i style={{ background: 'var(--good)' }} /> Realizado</span>
            <span><i style={{ background: 'var(--s2)' }} /> Visita ao showroom</span>
            <span className="muted">Clique num dia vazio para criar um evento.</span>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid g-2">
            <Card title="Faturamento por evento" sub={periodo.label}>
              <HBars rows={realizados.map((e) => ({ key: e.id, label: e.titulo, value: e.r.faturamento, extra: <span className="muted small"> · {pct(e.r.atingimento)}</span> }))} fmt={money} color={colors.s1} />
            </Card>
            <Card title="ROI por evento" sub="faturamento ÷ investimento (inclui brindes)">
              <HBars rows={realizados.map((e) => ({ key: e.id, label: e.titulo, value: e.r.roi }))} fmt={(v) => `${v.toFixed(1)}x`} color={colors.s4} />
            </Card>
          </div>
          <Card title="Todos os eventos" className="mt">
            <DataTable rows={todosResultados} onRowClick={setVer} initialSort={{ key: 'data', dir: -1 }} columns={[
              { key: 'data', label: 'Data', value: (r) => r.dataInicio, render: (r) => date(r.dataInicio) },
              { key: 'titulo', label: 'Evento', value: (r) => r.titulo, render: (r) => <><div className="strong">{r.titulo}</div><div className="small muted">{TIPO_EVENTO[r.tipo]} · {r.local}</div></> },
              { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={toneStatus(r.status)}>{STATUS_EVENTO[r.status]}</Badge> },
              { key: 'clientes', label: 'Clientes', num: true, value: (r) => r.clientesPresentes ?? -1, render: (r) => r.clientesPresentes != null ? <>{r.clientesPresentes}<span className="muted small">/{r.metaClientes}</span></> : <span className="muted">meta {r.metaClientes}</span> },
              { key: 'revendas', label: 'Compraram', num: true, value: (r) => r.r.compradoras },
              { key: 'fat', label: 'Faturamento', num: true, value: (r) => r.r.faturamento, render: (r) => r.status === 'realizado' ? <b>{money(r.r.faturamento)}</b> : <span className="muted">meta {money(r.metaFaturamento)}</span> },
              { key: 'ating', label: 'Meta', num: true, value: (r) => r.r.atingimento, render: (r) => r.status === 'realizado' ? <Badge tone={r.r.atingimento >= 1 ? 'good' : r.r.atingimento >= 0.8 ? 'warn' : 'bad'}>{pct(r.r.atingimento)}</Badge> : '—' },
              { key: 'roi', label: 'ROI', num: true, value: (r) => r.r.roi, render: (r) => r.status === 'realizado' ? `${r.r.roi.toFixed(1)}x` : '—' },
              { key: 'nps', label: 'NPS', num: true, value: (r) => r.nps ?? -1, render: (r) => r.nps ?? '—' },
            ]} />
          </Card>
        </>
      )}

      {ver && <EventoDetalhe evento={ver} onClose={() => setVer(null)} onEdit={() => { setEdit(ver); setVer(null) }} />}
      {edit && (
        <FormModal title={db.eventos.some((e) => e.id === edit.id) ? 'Editar evento / registrar resultado' : 'Novo evento'} wide initial={edit} onClose={() => setEdit(null)}
          onSave={(v) => { upsert('eventos', { ...v, dataFim: v.dataFim || v.dataInicio }); setEdit(null) }}
          onDelete={db.eventos.some((e) => e.id === edit.id) ? () => { remove('eventos', edit.id); setEdit(null) } : undefined}
          fields={[
            { name: 'titulo', label: 'Nome do evento', required: true, full: true },
            { name: 'tipo', label: 'Tipo', type: 'select', options: opts(TIPO_EVENTO), required: true },
            { name: 'status', label: 'Status', type: 'select', options: opts(STATUS_EVENTO), required: true },
            { name: 'dataInicio', label: 'Data de início', type: 'date', required: true },
            { name: 'dataFim', label: 'Data de término', type: 'date' },
            { name: 'horario', label: 'Horário' },
            { name: 'local', label: 'Local' },
            { name: 'colecao', label: 'Coleção apresentada' },
            { name: 'responsavelId', label: 'Responsável', type: 'select', options: db.colaboradores.map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'metaFaturamento', label: 'Meta de faturamento (R$)', type: 'number' },
            { name: 'metaClientes', label: 'Meta de clientes presentes', type: 'number' },
            { name: 'convidados', label: 'Convidados', type: 'number' },
            { name: 'custo', label: 'Investimento (buffet, decoração, convites…) R$', type: 'number' },
            { name: 'clientesPresentes', label: 'Resultado — clientes presentes', type: 'number' },
            { name: 'novosCadastros', label: 'Resultado — novas revendas cadastradas', type: 'number' },
            { name: 'leadsGerados', label: 'Resultado — leads gerados', type: 'number' },
            { name: 'nps', label: 'Resultado — NPS / satisfação (0–10)', type: 'number', step: '0.1' },
            { name: 'faturamentoEvento', label: 'Faturamento extra (não lançado como pedido) R$', type: 'number', help: 'Pedidos lançados em Faturamento com este evento vinculado já entram no resultado.' },
            { name: 'pecasVendidas', label: 'Peças vendidas (se não houver pedidos)', type: 'number' },
            { name: 'revendasIds', label: 'Revendas presentes (Ctrl/Cmd para várias)', type: 'multiselect', options: db.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: `${c.nome} — ${c.cidade}` })) },
            { name: 'aprendizados', label: 'Aprendizados e próximos passos', type: 'textarea' },
          ]} />
      )}
    </>
  )
}

function Calendario({ mes, onEvento, onDia, visitas }: { mes: string; onEvento: (e: Evento) => void; onDia: (d: string) => void; visitas: boolean }) {
  const { db } = useStore()
  const first = parse(mes)
  const start = addDays(mes, -((first.getDay() + 6) % 7)) // semana começa na segunda
  const dias = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const hoje = today()
  return (
    <div className="cal">
      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
      {dias.map((d) => {
        const evs = db.eventos.filter((e) => d >= e.dataInicio && d <= (e.dataFim || e.dataInicio))
        const vis = visitas ? db.visitas.filter((v) => v.data === d && v.status !== 'cancelada') : []
        return (
          <div key={d} className={`cal-day ${d.slice(0, 7) !== mes.slice(0, 7) ? 'out' : ''} ${d === hoje ? 'today' : ''}`} onClick={(e) => e.target === e.currentTarget && onDia(d)}>
            <span className="n">{parse(d).getDate()}</span>
            {evs.map((e) => <div key={e.id} className={`cal-ev ${e.status}`} onClick={() => onEvento(e)} title={e.titulo}>{e.titulo}</div>)}
            {vis.slice(0, 2).map((v) => <div key={v.id} className="cal-ev visita" title={`${v.horario} — ${v.nomeVisitante}: ${v.objetivo}`}>{v.horario} {v.nomeVisitante}</div>)}
            {vis.length > 2 && <span className="small muted">+{vis.length - 2} visitas</span>}
          </div>
        )
      })}
    </div>
  )
}

function EventoDetalhe({ evento, onClose, onEdit }: { evento: Evento; onClose: () => void; onEdit: () => void }) {
  const { db } = useStore()
  const r = resultadoEvento(db, evento)
  const realizado = evento.status === 'realizado'
  const cli = (id: string) => db.clientes.find((c) => c.id === id)
  const porRevenda = new Map<string, { valor: number; pecas: number }>()
  r.pedidos.forEach((p) => {
    const cur = porRevenda.get(p.clienteId) || { valor: 0, pecas: 0 }
    porRevenda.set(p.clienteId, { valor: cur.valor + p.valor, pecas: cur.pecas + p.pecas })
  })
  const linhas = r.revendas.map((id) => ({ id, cliente: cli(id), ...(porRevenda.get(id) || { valor: 0, pecas: 0 }) }))
  return (
    <Modal wide title={evento.titulo} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Fechar</button><button className="btn primary" onClick={onEdit}>{realizado ? 'Editar resultado' : 'Editar / registrar resultado'}</button></>}>
      <div className="toolbar">
        <Badge tone={toneStatus(evento.status)}>{STATUS_EVENTO[evento.status]}</Badge>
        <Badge plain>{TIPO_EVENTO[evento.tipo]}</Badge>
        <span className="small muted">{date(evento.dataInicio)}{evento.dataFim && evento.dataFim !== evento.dataInicio ? ` a ${date(evento.dataFim)}` : ''} · {evento.horario} · {evento.local}</span>
      </div>
      <div className="grid g-4">
        <div className="card kpi"><div className="kpi-label">Faturamento</div><div className="kpi-value">{money(r.faturamento)}</div><Meter value={r.atingimento} /><div className="kpi-foot">{pct(r.atingimento)} da meta {money(evento.metaFaturamento)}</div></div>
        <div className="card kpi"><div className="kpi-label">Clientes presentes</div><div className="kpi-value">{evento.clientesPresentes ?? '—'}</div><Meter value={safeDiv(evento.clientesPresentes || 0, evento.metaClientes)} /><div className="kpi-foot">meta {evento.metaClientes} · {evento.convidados} convidados</div></div>
        <div className="card kpi"><div className="kpi-label">ROI</div><div className="kpi-value">{realizado ? `${r.roi.toFixed(1)}x` : '—'}</div><div className="kpi-foot">investimento {money(r.custoTotal)} (brindes {money(r.custoBrindes)})</div></div>
        <div className="card kpi"><div className="kpi-label">NPS</div><div className="kpi-value">{evento.nps ?? '—'}</div><div className="kpi-foot">satisfação das convidadas</div></div>
      </div>
      <div className="grid g-2 mt">
        <div>
          <StatRow label="Revendas que compraram" value={r.compradoras} />
          <StatRow label="Conversão (compraram ÷ presentes)" value={pct(r.conversao)} />
          <StatRow label="Ticket médio por revenda" value={money(r.ticket)} />
          <StatRow label="Peças vendidas" value={int(r.pecas)} />
          <StatRow label="Novas revendas cadastradas" value={evento.novosCadastros ?? '—'} />
          <StatRow label="Leads gerados" value={evento.leadsGerados ?? '—'} />
          <StatRow label="Coleção" value={evento.colecao} />
          <StatRow label="Responsável" value={<Person id={evento.responsavelId} />} />
        </div>
        <div>
          <h4 style={{ marginTop: 0 }}>Aprendizados</h4>
          <p className="quote" style={{ marginTop: 0 }}>{evento.aprendizados || 'Registre aqui o que funcionou e o que melhorar.'}</p>
          <h4>Brindes distribuídos</h4>
          {r.brindes.length ? r.brindes.map((m) => <StatRow key={m.id} label={db.brindes.find((b) => b.id === m.brindeId)?.nome} value={`${m.quantidade} un`} />) : <p className="muted small">Nenhum brinde vinculado.</p>}
        </div>
      </div>
      <h4>Revendas no evento</h4>
      <DataTable rows={linhas} pageSize={10} initialSort={{ key: 'valor', dir: -1 }} empty="Nenhuma revenda registrada ainda." columns={[
        { key: 'nome', label: 'Revenda', value: (l) => l.cliente?.nome, render: (l) => <><div className="strong">{l.cliente?.nome}</div><div className="small muted">{l.cliente?.cidade}/{l.cliente?.uf}</div></> },
        { key: 'pecas', label: 'Peças', num: true, value: (l) => l.pecas },
        { key: 'valor', label: 'Comprou', num: true, value: (l) => l.valor, render: (l) => l.valor ? <b>{money(l.valor)}</b> : <span className="muted">não comprou</span> },
      ]} />
    </Modal>
  )
}


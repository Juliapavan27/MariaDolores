import { useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Devolucao, Reclamacao } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, PageHead, Person, Tabs, opts } from '../components/ui'
import { HBars, useChartColors } from '../components/charts'
import { devolucoesValidas, pedidosNoPeriodo, somaValor } from '../lib/metrics'
import { date, money, pct, safeDiv, int } from '../lib/format'
import { diffDays, inRange, today } from '../lib/dates'
import { CATEGORIAS_RECLAMACAO, MOTIVOS_DEVOLUCAO, PRIORIDADE, STATUS_DEVOLUCAO, STATUS_RECLAMACAO } from '../data/labels'
import { exportCSV } from '../lib/csv'
import { IcDownload, IcPlus } from '../components/Icons'

const toneDev = (s: Devolucao['status']) => (s === 'concluida' || s === 'aprovada' ? 'good' : s === 'recusada' ? undefined : 'warn')
const toneRec = (s: Reclamacao['status']) => (s === 'resolvida' ? 'good' : s === 'aberta' ? 'bad' : 'warn')

export default function PosVenda() {
  const { db, periodo, upsert, remove } = useStore()
  const [aba, setAba] = useState<'devolucoes' | 'reclamacoes'>('devolucoes')
  const [editDev, setEditDev] = useState<Devolucao | null>(null)
  const [editRec, setEditRec] = useState<Reclamacao | null>(null)
  const [soAbertas, setSoAbertas] = useState(false)
  const colors = useChartColors()
  const nome = (id: string) => db.clientes.find((c) => c.id === id)?.nome || '—'
  const clienteOpts = db.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: `${c.nome} — ${c.cidade}` }))

  const d = useMemo(() => {
    const devs = db.devolucoes.filter((x) => inRange(x.data, periodo))
    const devOk = devolucoesValidas(db).filter((x) => inRange(x.data, periodo))
    const fat = somaValor(pedidosNoPeriodo(db, periodo))
    const recs = db.reclamacoes.filter((x) => inRange(x.data, periodo))
    const resolvidas = db.reclamacoes.filter((r) => r.status === 'resolvida' && r.resolvidaEm && inRange(r.resolvidaEm, periodo))
    const tempo = safeDiv(resolvidas.reduce((s, r) => s + diffDays(r.resolvidaEm!, r.data), 0), resolvidas.length)
    const grp = <T,>(xs: T[], k: (x: T) => string, v: (x: T) => number) => {
      const m = new Map<string, number>()
      xs.forEach((x) => m.set(k(x), (m.get(k(x)) || 0) + v(x)))
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([key, value]) => ({ key, label: key, value }))
    }
    return {
      devs, devOk, fat, recs, tempo,
      pendDev: db.devolucoes.filter((x) => x.status === 'solicitada' || x.status === 'em_analise'),
      abertas: db.reclamacoes.filter((r) => r.status !== 'resolvida'),
      porMotivo: grp(devs, (x) => x.motivo, (x) => x.valor),
      porCategoria: grp(recs, (x) => x.categoria, () => 1),
    }
  }, [db, periodo])

  const devRows = soAbertas ? d.pendDev : d.devs
  const recRows = soAbertas ? d.abertas : d.recs

  return (
    <>
      <PageHead
        eyebrow="Comercial"
        title="Devoluções & reclamações"
        desc="Pós-venda das revendas: motivos, valores, status e tempo de resolução."
        actions={<>
          <button className="btn" onClick={() => aba === 'devolucoes'
            ? exportCSV('devolucoes.csv', devRows.map((x) => ({ Data: date(x.data), Revenda: nome(x.clienteId), Motivo: x.motivo, Pecas: x.pecas, Valor: x.valor, Status: STATUS_DEVOLUCAO[x.status] })))
            : exportCSV('reclamacoes.csv', recRows.map((x) => ({ Data: date(x.data), Revenda: nome(x.clienteId), Categoria: x.categoria, Descricao: x.descricao, Prioridade: PRIORIDADE[x.prioridade], Status: STATUS_RECLAMACAO[x.status], Solucao: x.solucao || '' })))}><IcDownload /> Exportar</button>
          <button className="btn primary" onClick={() => aba === 'devolucoes'
            ? setEditDev({ id: newId('dev'), clienteId: '', data: today(), valor: 0, pecas: 1, motivo: MOTIVOS_DEVOLUCAO[0], status: 'solicitada' })
            : setEditRec({ id: newId('rec'), clienteId: '', data: today(), categoria: CATEGORIAS_RECLAMACAO[0], descricao: '', prioridade: 'media', status: 'aberta', responsavelId: '' })}><IcPlus /> {aba === 'devolucoes' ? 'Nova devolução' : 'Nova reclamação'}</button>
        </>}
      />
      <div className="kpi-strip k4">
        <Kpi label="Devoluções aprovadas" value={money(somaValor(d.devOk))} foot={`${pct(safeDiv(somaValor(d.devOk), d.fat), 1)} do faturamento · ${d.devOk.length} ocorrências`} />
        <Kpi label="Devoluções pendentes" value={int(d.pendDev.length)} foot={`${money(somaValor(d.pendDev))} em análise`} />
        <Kpi label="Reclamações abertas" value={int(d.abertas.length)} foot={`${d.abertas.filter((r) => r.prioridade === 'alta').length} de prioridade alta`} />
        <Kpi label="Tempo médio de resolução" value={`${d.tempo.toFixed(1)} dias`} foot={`${d.recs.length} reclamações no período`} />
      </div>
      <div className="grid g-2 mt">
        <Card title="Devoluções por motivo" sub={`valor · ${periodo.label}`}><HBars rows={d.porMotivo} fmt={money} color={colors.s2} /></Card>
        <Card title="Reclamações por categoria" sub={periodo.label}><HBars rows={d.porCategoria} color={colors.s2} /></Card>
      </div>
      <div className="mt-lg">
        <Tabs value={aba} onChange={setAba} options={[{ value: 'devolucoes', label: `Devoluções (${d.devs.length})` }, { value: 'reclamacoes', label: `Reclamações (${d.recs.length})` }]} />
        <div className="toolbar"><label className="check"><input type="checkbox" checked={soAbertas} onChange={(e) => setSoAbertas(e.target.checked)} /> Mostrar só pendentes (qualquer data)</label></div>
        {aba === 'devolucoes' ? (
          <DataTable rows={devRows} onRowClick={setEditDev} initialSort={{ key: 'data', dir: -1 }} columns={[
            { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => date(r.data) },
            { key: 'cli', label: 'Revenda', value: (r) => nome(r.clienteId), render: (r) => <span className="strong">{nome(r.clienteId)}</span> },
            { key: 'motivo', label: 'Motivo', value: (r) => r.motivo },
            { key: 'pecas', label: 'Peças', num: true, value: (r) => r.pecas },
            { key: 'valor', label: 'Valor', num: true, value: (r) => r.valor, render: (r) => money(r.valor) },
            { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={toneDev(r.status)}>{STATUS_DEVOLUCAO[r.status]}</Badge> },
          ]} />
        ) : (
          <DataTable rows={recRows} onRowClick={setEditRec} initialSort={{ key: 'data', dir: -1 }} columns={[
            { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => <>{date(r.data)}{r.status !== 'resolvida' && <div className="small muted">{diffDays(today(), r.data)} dias aberta</div>}</> },
            { key: 'cli', label: 'Revenda', value: (r) => nome(r.clienteId), render: (r) => <span className="strong">{nome(r.clienteId)}</span> },
            { key: 'cat', label: 'Categoria', value: (r) => r.categoria },
            { key: 'desc', label: 'Descrição', render: (r) => <span className="small">{r.descricao}</span> },
            { key: 'prio', label: 'Prioridade', value: (r) => ({ alta: 0, media: 1, baixa: 2 })[r.prioridade], render: (r) => <Badge tone={r.prioridade === 'alta' ? 'bad' : r.prioridade === 'media' ? 'warn' : undefined}>{PRIORIDADE[r.prioridade]}</Badge> },
            { key: 'resp', label: 'Responsável', render: (r) => <Person id={r.responsavelId} /> },
            { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={toneRec(r.status)}>{STATUS_RECLAMACAO[r.status]}</Badge> },
          ]} />
        )}
      </div>

      {editDev && (
        <FormModal title="Devolução" initial={editDev} onClose={() => setEditDev(null)}
          onSave={(v) => { upsert('devolucoes', v); setEditDev(null) }}
          onDelete={db.devolucoes.some((x) => x.id === editDev.id) ? () => { remove('devolucoes', editDev.id); setEditDev(null) } : undefined}
          fields={[
            { name: 'clienteId', label: 'Revenda', type: 'select', options: clienteOpts, required: true },
            { name: 'data', label: 'Data', type: 'date', required: true },
            { name: 'motivo', label: 'Motivo', type: 'select', options: MOTIVOS_DEVOLUCAO.map((m) => ({ value: m, label: m })), required: true },
            { name: 'status', label: 'Status', type: 'select', options: opts(STATUS_DEVOLUCAO), required: true },
            { name: 'pecas', label: 'Peças', type: 'number' },
            { name: 'valor', label: 'Valor (R$)', type: 'number', required: true },
            { name: 'pedidoId', label: 'Pedido de origem', type: 'select', options: db.pedidos.filter((p) => p.clienteId === editDev.clienteId).map((p) => ({ value: p.id, label: `${date(p.data)} — ${money(p.valor)}` })), help: 'Salve a revenda primeiro para listar os pedidos dela.' },
            { name: 'observacoes', label: 'Observações', type: 'textarea' },
          ]} />
      )}
      {editRec && (
        <FormModal title="Reclamação" initial={editRec} onClose={() => setEditRec(null)}
          onSave={(v) => {
            const cli = db.clientes.find((c) => c.id === v.clienteId)
            upsert('reclamacoes', { ...v, responsavelId: v.responsavelId || cli?.responsavelId || '', resolvidaEm: v.status === 'resolvida' ? v.resolvidaEm || today() : undefined })
            setEditRec(null)
          }}
          onDelete={db.reclamacoes.some((x) => x.id === editRec.id) ? () => { remove('reclamacoes', editRec.id); setEditRec(null) } : undefined}
          fields={[
            { name: 'clienteId', label: 'Revenda', type: 'select', options: clienteOpts, required: true },
            { name: 'data', label: 'Data', type: 'date', required: true },
            { name: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIAS_RECLAMACAO.map((m) => ({ value: m, label: m })), required: true },
            { name: 'prioridade', label: 'Prioridade', type: 'select', options: opts(PRIORIDADE), required: true },
            { name: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { name: 'responsavelId', label: 'Responsável (vazio = da carteira)', type: 'select', options: db.colaboradores.map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'status', label: 'Status', type: 'select', options: opts(STATUS_RECLAMACAO), required: true },
            { name: 'resolvidaEm', label: 'Resolvida em', type: 'date' },
            { name: 'solucao', label: 'Solução aplicada', type: 'textarea' },
          ]} />
      )}
    </>
  )
}

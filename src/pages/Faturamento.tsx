import { useCallback, useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Pedido } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, Meter, PageHead, Person, opts, useSearch } from '../components/ui'
import { HBars, RevenueChart, useChartColors } from '../components/charts'
import { devolucoesValidas, metaDoPeriodo, pedidosNoPeriodo, serieMensal, somaValor } from '../lib/metrics'
import { date, money, pct, safeDiv, int } from '../lib/format'
import { addDays, inRange, today } from '../lib/dates'
import { CANAL, STATUS_PEDIDO } from '../data/labels'
import { exportCSV } from '../lib/csv'
import { IcDownload, IcPlus } from '../components/Icons'

type PedidoForm = Pedido & { parcelas?: number; gerarTitulos?: boolean }

export default function Faturamento() {
  const { db, periodo, upsert, remove, bulkUpsert } = useStore()
  const [edit, setEdit] = useState<PedidoForm | null>(null)
  const [canal, setCanal] = useState('')
  const [resp, setResp] = useState('')
  const colors = useChartColors()

  const d = useMemo(() => {
    const ped = pedidosNoPeriodo(db, periodo)
    const todos = db.pedidos.filter((p) => inRange(p.data, periodo))
    const bruto = somaValor(ped)
    const dev = somaValor(devolucoesValidas(db).filter((x) => inRange(x.data, periodo)))
    const pend = todos.filter((p) => p.status === 'pendente')
    const agrupa = (key: (p: Pedido) => string) => {
      const m = new Map<string, number>()
      ped.forEach((p) => m.set(key(p), (m.get(key(p)) || 0) + p.valor))
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
    }
    return {
      ped, todos, bruto, dev, pend,
      meta: metaDoPeriodo(db.config.metaFaturamentoMensal, periodo),
      pecas: ped.reduce((s, p) => s + p.pecas, 0),
      porCanal: agrupa((p) => CANAL[p.canal]),
      porColecao: agrupa((p) => p.colecao),
      porPessoa: agrupa((p) => db.colaboradores.find((c) => c.id === p.responsavelId)?.nome || '—'),
      serie: serieMensal(db, 12),
    }
  }, [db, periodo])

  const lista = d.todos.filter((p) => (!canal || p.canal === canal) && (!resp || p.responsavelId === resp))
  const nomeCliente = useCallback((id: string) => db.clientes.find((c) => c.id === id)?.nome || '—', [db.clientes])
  const { q, setQ, filtered } = useSearch(lista, useCallback((p: Pedido) => `${nomeCliente(p.clienteId)} ${p.colecao}`, [nomeCliente]))

  const salvar = (v: PedidoForm) => {
    const { parcelas, gerarTitulos, ...pedido } = v
    upsert('pedidos', pedido)
    if (gerarTitulos && pedido.status === 'faturado') {
      const n = Math.max(1, parcelas || 1)
      bulkUpsert('titulos', Array.from({ length: n }, (_, i) => ({
        id: newId('tit'), clienteId: pedido.clienteId, pedidoId: pedido.id, emissao: pedido.data, vencimento: addDays(pedido.data, 30 * (i + 1)),
        valor: Math.round((pedido.valor / n) * 100) / 100, valorPago: 0, formaPagamento: 'Boleto',
      })))
    }
    setEdit(null)
  }

  const isNovo = edit && !db.pedidos.some((p) => p.id === edit.id)

  return (
    <>
      <PageHead
        eyebrow="Comercial"
        title="Faturamento"
        desc="Pedidos, faturamento bruto e líquido, por canal, coleção e pessoa."
        actions={<>
          <button className="btn" onClick={() => exportCSV('pedidos.csv', filtered.map((p) => ({ Data: date(p.data), Revenda: nomeCliente(p.clienteId), Responsavel: db.colaboradores.find((c) => c.id === p.responsavelId)?.nome, Canal: CANAL[p.canal], Colecao: p.colecao, Pecas: p.pecas, Valor: p.valor, Status: STATUS_PEDIDO[p.status] })))}><IcDownload /> Exportar</button>
          <button className="btn primary" onClick={() => setEdit({ id: newId('ped'), clienteId: '', responsavelId: '', data: today(), valor: 0, pecas: 0, canal: 'showroom', colecao: db.config.colecaoAtual, status: 'faturado', parcelas: 3, gerarTitulos: true })}><IcPlus /> Lançar pedido</button>
        </>}
      />
      <div className="grid g-5">
        <Kpi label="Faturamento bruto" value={money(d.bruto)} foot={<>{pct(safeDiv(d.bruto, d.meta))} da meta de {money(d.meta)}</>}><Meter value={safeDiv(d.bruto, d.meta)} /></Kpi>
        <Kpi label="Devoluções" value={money(d.dev)} foot={`${pct(safeDiv(d.dev, d.bruto), 1)} do bruto`} />
        <Kpi label="Faturamento líquido" value={money(d.bruto - d.dev)} foot="bruto − devoluções aprovadas" />
        <Kpi label="Ticket médio" value={money(safeDiv(d.bruto, d.ped.length))} foot={`${int(d.ped.length)} pedidos · ${int(d.pecas)} peças`} />
        <Kpi label="Pedidos pendentes" value={money(somaValor(d.pend))} foot={`${d.pend.length} aguardando faturamento`} />
      </div>
      <div className="grid g-2-1 mt">
        <Card title="Faturamento mensal x meta" sub="últimos 12 meses"><RevenueChart data={d.serie} /></Card>
        <Card title="Por canal" sub={periodo.label}><HBars rows={d.porCanal.map(([k, v]) => ({ key: k, label: k, value: v }))} fmt={money} color={colors.s1} /></Card>
      </div>
      <div className="grid g-2 mt">
        <Card title="Por coleção" sub={periodo.label}><HBars rows={d.porColecao.map(([k, v]) => ({ key: k, label: k, value: v }))} fmt={money} color={colors.s1} /></Card>
        <Card title="Por pessoa" sub={periodo.label}><HBars rows={d.porPessoa.map(([k, v]) => ({ key: k, label: k, value: v }))} fmt={money} color={colors.s1} /></Card>
      </div>
      <Card title="Pedidos do período" sub={`${filtered.length} pedidos`} className="mt">
        <div className="toolbar">
          <input className="input search" placeholder="Buscar revenda ou coleção…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}><option value="">Todos os canais</option>{Object.entries(CANAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="input" value={resp} onChange={(e) => setResp(e.target.value)}><option value="">Toda a equipe</option>{db.colaboradores.filter((c) => c.cargo !== 'analista').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </div>
        <DataTable rows={filtered} onRowClick={(r) => setEdit(r)} initialSort={{ key: 'data', dir: -1 }} columns={[
          { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => date(r.data) },
          { key: 'cli', label: 'Revenda', value: (r) => nomeCliente(r.clienteId), render: (r) => <span className="strong">{nomeCliente(r.clienteId)}</span> },
          { key: 'resp', label: 'Responsável', value: (r) => r.responsavelId, render: (r) => <Person id={r.responsavelId} /> },
          { key: 'canal', label: 'Canal', value: (r) => CANAL[r.canal] },
          { key: 'colecao', label: 'Coleção', value: (r) => r.colecao, render: (r) => <span className="small">{r.colecao}</span> },
          { key: 'pecas', label: 'Peças', num: true, value: (r) => r.pecas, render: (r) => int(r.pecas) },
          { key: 'valor', label: 'Valor', num: true, value: (r) => r.valor, render: (r) => <b>{money(r.valor)}</b> },
          { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={r.status === 'faturado' ? 'good' : r.status === 'pendente' ? 'warn' : undefined}>{STATUS_PEDIDO[r.status]}</Badge> },
        ]} />
      </Card>

      {edit && (
        <FormModal
          title={isNovo ? 'Lançar pedido' : 'Editar pedido'}
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={(v) => {
            const cli = db.clientes.find((c) => c.id === v.clienteId)
            salvar({ ...v, responsavelId: v.responsavelId || cli?.responsavelId || '' })
          }}
          onDelete={!isNovo ? () => { remove('pedidos', edit.id); setEdit(null) } : undefined}
          fields={[
            { name: 'clienteId', label: 'Revenda', type: 'select', required: true, options: db.clientes.filter((c) => c.status !== 'encerrada').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: `${c.nome} — ${c.cidade}` })) },
            { name: 'responsavelId', label: 'Responsável (vazio = da carteira)', type: 'select', options: db.colaboradores.map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'data', label: 'Data', type: 'date', required: true },
            { name: 'canal', label: 'Canal', type: 'select', options: opts(CANAL), required: true },
            { name: 'valor', label: 'Valor (R$)', type: 'number', required: true },
            { name: 'pecas', label: 'Peças', type: 'number' },
            { name: 'colecao', label: 'Coleção' },
            { name: 'status', label: 'Status', type: 'select', options: opts(STATUS_PEDIDO), required: true },
            { name: 'eventoId', label: 'Vinculado ao evento', type: 'select', options: db.eventos.map((e) => ({ value: e.id, label: `${date(e.dataInicio)} — ${e.titulo}` })) },
            ...(isNovo ? [
              { name: 'gerarTitulos', label: 'Financeiro', type: 'checkbox' as const, placeholder: 'Gerar títulos a receber (boletos)' },
              { name: 'parcelas', label: 'Parcelas (30/60/90…)', type: 'number' as const },
            ] : []),
          ]}
        />
      )}
    </>
  )
}

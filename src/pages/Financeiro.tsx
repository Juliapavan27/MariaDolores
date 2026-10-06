import { useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Titulo } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, PageHead, Person, Segmented } from '../components/ui'
import { HBars, useChartColors } from '../components/charts'
import { aging, debitosPorCliente, saldo, statusTitulo } from '../lib/metrics'
import { date, money, pct, safeDiv } from '../lib/format'
import { addDays, addMonths, diffDays, today } from '../lib/dates'
import { exportCSV } from '../lib/csv'
import { IcDownload, IcPlus } from '../components/Icons'

export default function Financeiro() {
  const { db, upsert, remove } = useStore()
  const [edit, setEdit] = useState<Titulo | null>(null)
  const [filtro, setFiltro] = useState<'vencido' | 'a_vencer' | 'pago' | 'todos'>('vencido')
  const colors = useChartColors()
  const cli = (id: string) => db.clientes.find((c) => c.id === id)

  const d = useMemo(() => {
    const hoje = today()
    const abertos = db.titulos.filter((t) => statusTitulo(t) !== 'pago')
    const vencidos = abertos.filter((t) => statusTitulo(t) === 'vencido')
    const prox30 = abertos.filter((t) => t.vencimento >= hoje && t.vencimento <= addDays(hoje, 30))
    const emitidos12 = db.titulos.filter((t) => t.vencimento >= addMonths(hoje, -12) && t.vencimento < hoje)
    const ag = aging(db.titulos)
    const devedores = Array.from(debitosPorCliente(db).entries())
      .filter(([, v]) => v.vencido > 0)
      .map(([id, v]) => ({ id, ...v, cliente: cli(id) }))
    return {
      abertos, vencidos, prox30, ag, devedores,
      totalAberto: abertos.reduce((s, t) => s + saldo(t), 0),
      totalVencido: vencidos.reduce((s, t) => s + saldo(t), 0),
      inad: safeDiv(emitidos12.reduce((s, t) => s + saldo(t), 0), emitidos12.reduce((s, t) => s + t.valor, 0)),
    }
  }, [db])

  const rows = db.titulos.filter((t) => filtro === 'todos' || statusTitulo(t) === filtro)

  return (
    <>
      <PageHead
        eyebrow="Comercial"
        title="Débitos"
        desc="Títulos em aberto das revendas, aging de vencidos e prioridades de cobrança."
        actions={<>
          <button className="btn" onClick={() => exportCSV('titulos.csv', rows.map((t) => ({ Revenda: cli(t.clienteId)?.nome, Emissao: date(t.emissao), Vencimento: date(t.vencimento), Valor: t.valor, Pago: t.valorPago, 'Em aberto': saldo(t), Situacao: statusTitulo(t), Forma: t.formaPagamento })))}><IcDownload /> Exportar</button>
          <button className="btn primary" onClick={() => setEdit({ id: newId('tit'), clienteId: '', emissao: today(), vencimento: addDays(today(), 30), valor: 0, valorPago: 0, formaPagamento: 'Boleto' })}><IcPlus /> Novo título</button>
        </>}
      />
      <div className="kpi-strip k4">
        <Kpi label="Total em aberto" value={money(d.totalAberto)} foot={`${d.abertos.length} títulos`} />
        <Kpi label="Vencido" value={money(d.totalVencido)} foot={`${d.devedores.length} revendas inadimplentes`} />
        <Kpi label="A receber em 30 dias" value={money(d.prox30.reduce((s, t) => s + saldo(t), 0))} foot={`${d.prox30.length} títulos`} />
        <Kpi label="Inadimplência 12 meses" value={pct(d.inad, 1)} foot="saldo vencido ÷ valor vencido no período" />
      </div>
      <div className="grid g-1-2 mt">
        <Card title="Aging dos vencidos" sub="dias em atraso">
          <HBars rows={Object.entries(d.ag).map(([k, v]) => ({ key: k, label: `${k} dias`, value: v }))} fmt={money} color={colors.s3} />
        </Card>
        <Card title="Prioridade de cobrança" sub="revendas com saldo vencido">
          <DataTable rows={d.devedores} pageSize={8} initialSort={{ key: 'vencido', dir: -1 }} columns={[
            { key: 'nome', label: 'Revenda', value: (r) => r.cliente?.nome, render: (r) => <><div className="strong">{r.cliente?.nome}</div><div className="small muted">{r.cliente?.telefone}</div></> },
            { key: 'resp', label: 'Responsável', render: (r) => r.cliente ? <Person id={r.cliente.responsavelId} /> : '—' },
            { key: 'atraso', label: 'Maior atraso', num: true, value: (r) => r.maiorAtraso, render: (r) => <Badge tone={r.maiorAtraso > 60 ? 'bad' : r.maiorAtraso > 30 ? 'warn' : 'info'}>{r.maiorAtraso} dias</Badge> },
            { key: 'vencido', label: 'Vencido', num: true, value: (r) => r.vencido, render: (r) => <b style={{ color: 'var(--bad)' }}>{money(r.vencido)}</b> },
            { key: 'avencer', label: 'A vencer', num: true, value: (r) => r.aVencer, render: (r) => money(r.aVencer) },
            { key: 'status', label: 'Situação', render: (r) => r.cliente?.status === 'em_queda' ? <Badge tone="warn">Vai cair</Badge> : r.cliente?.status === 'encerrada' ? <Badge>Encerrada</Badge> : <Badge tone="good">Ativa</Badge> },
          ]} />
        </Card>
      </div>
      <Card title="Títulos" className="mt" right={<Segmented value={filtro} onChange={setFiltro} options={[{ value: 'vencido', label: 'Vencidos' }, { value: 'a_vencer', label: 'A vencer' }, { value: 'pago', label: 'Pagos' }, { value: 'todos', label: 'Todos' }]} />}>
        <DataTable rows={rows} onRowClick={setEdit} initialSort={{ key: 'venc', dir: filtro === 'a_vencer' ? 1 : -1 }} columns={[
          { key: 'cli', label: 'Revenda', value: (r) => cli(r.clienteId)?.nome, render: (r) => <span className="strong">{cli(r.clienteId)?.nome}</span> },
          { key: 'emissao', label: 'Emissão', value: (r) => r.emissao, render: (r) => date(r.emissao) },
          { key: 'venc', label: 'Vencimento', value: (r) => r.vencimento, render: (r) => date(r.vencimento) },
          { key: 'forma', label: 'Forma', value: (r) => r.formaPagamento },
          { key: 'valor', label: 'Valor', num: true, value: (r) => r.valor, render: (r) => money(r.valor) },
          { key: 'saldo', label: 'Em aberto', num: true, value: (r) => saldo(r), render: (r) => <b>{money(saldo(r))}</b> },
          { key: 'st', label: 'Situação', value: (r) => statusTitulo(r), render: (r) => {
            const s = statusTitulo(r)
            return <Badge tone={s === 'pago' ? 'good' : s === 'vencido' ? 'bad' : 'info'}>{s === 'pago' ? 'Pago' : s === 'vencido' ? `Vencido · ${diffDays(today(), r.vencimento)}d` : 'A vencer'}</Badge>
          } },
        ]} />
      </Card>
      {edit && (
        <FormModal title="Título a receber" initial={edit} onClose={() => setEdit(null)}
          onSave={(v) => { upsert('titulos', v); setEdit(null) }}
          onDelete={db.titulos.some((t) => t.id === edit.id) ? () => { remove('titulos', edit.id); setEdit(null) } : undefined}
          fields={[
            { name: 'clienteId', label: 'Revenda', type: 'select', required: true, options: db.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'formaPagamento', label: 'Forma de pagamento', type: 'select', options: ['Boleto', 'Pix', 'Cartão', 'Transferência', 'Cheque'].map((x) => ({ value: x, label: x })) },
            { name: 'emissao', label: 'Emissão', type: 'date', required: true },
            { name: 'vencimento', label: 'Vencimento', type: 'date', required: true },
            { name: 'valor', label: 'Valor (R$)', type: 'number', required: true },
            { name: 'valorPago', label: 'Valor pago (R$)', type: 'number', help: 'Para baixar o título, informe o valor recebido.' },
            { name: 'observacoes', label: 'Observações / negociação', type: 'textarea' },
          ]} />
      )}
    </>
  )
}

import { useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Brinde, MovimentoBrinde } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, Meter, PageHead } from '../components/ui'
import { HBars, useChartColors } from '../components/charts'
import { date, money, int, money2 } from '../lib/format'
import { inRange, today } from '../lib/dates'
import { exportCSV } from '../lib/csv'
import { IcDownload, IcPlus } from '../components/Icons'

export default function Brindes() {
  const { db, periodo, upsert, remove } = useStore()
  const [editB, setEditB] = useState<Brinde | null>(null)
  const [mov, setMov] = useState<MovimentoBrinde | null>(null)
  const colors = useChartColors()
  const brinde = (id: string) => db.brindes.find((b) => b.id === id)

  const d = useMemo(() => {
    const saidas = db.movBrindes.filter((m) => m.tipo === 'saida' && inRange(m.data, periodo))
    const custo = saidas.reduce((s, m) => s + m.quantidade * (brinde(m.brindeId)?.custoUnitario || 0), 0)
    const porBrinde = new Map<string, number>()
    saidas.forEach((m) => porBrinde.set(m.brindeId, (porBrinde.get(m.brindeId) || 0) + m.quantidade * (brinde(m.brindeId)?.custoUnitario || 0)))
    const destino = { Eventos: 0, Revendas: 0, Outros: 0 }
    saidas.forEach((m) => {
      const v = m.quantidade * (brinde(m.brindeId)?.custoUnitario || 0)
      if (m.eventoId) destino.Eventos += v
      else if (m.clienteId) destino.Revendas += v
      else destino.Outros += v
    })
    return {
      saidas, custo, destino,
      porBrinde: Array.from(porBrinde.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: brinde(k)?.nome || k, value: v })),
      valorEstoque: db.brindes.reduce((s, b) => s + b.estoque * b.custoUnitario, 0),
      baixos: db.brindes.filter((b) => b.estoque < b.estoqueMinimo),
    }
  }, [db, periodo])

  const salvarMov = (m: MovimentoBrinde) => {
    const b = brinde(m.brindeId)
    if (!b) return
    const antigo = db.movBrindes.find((x) => x.id === m.id)
    const efeito = (x?: MovimentoBrinde) => (x ? (x.tipo === 'entrada' ? x.quantidade : -x.quantidade) : 0)
    // desfaz o efeito do movimento anterior (edição) e aplica o novo
    if (antigo && antigo.brindeId !== m.brindeId) {
      const bAnt = brinde(antigo.brindeId)
      if (bAnt) upsert('brindes', { ...bAnt, estoque: bAnt.estoque - efeito(antigo) })
      upsert('brindes', { ...b, estoque: b.estoque + efeito(m) })
    } else {
      upsert('brindes', { ...b, estoque: b.estoque - efeito(antigo) + efeito(m) })
    }
    upsert('movBrindes', m)
    setMov(null)
  }

  return (
    <>
      <PageHead
        eyebrow="Comercial"
        title="Brindes"
        desc="Estoque de brindes e materiais de PDV, regras de concessão e para onde cada mimo foi — por revenda e por evento."
        actions={<>
          <button className="btn" onClick={() => exportCSV('movimentos-brindes.csv', db.movBrindes.map((m) => ({ Data: date(m.data), Brinde: brinde(m.brindeId)?.nome, Tipo: m.tipo, Quantidade: m.quantidade, Revenda: db.clientes.find((c) => c.id === m.clienteId)?.nome || '', Evento: db.eventos.find((e) => e.id === m.eventoId)?.titulo || '', Motivo: m.motivo })))}><IcDownload /> Exportar</button>
          <button className="btn" onClick={() => setEditB({ id: newId('b'), nome: '', categoria: 'Mimo', estoque: 0, estoqueMinimo: 0, custoUnitario: 0, regraConcessao: '' })}><IcPlus /> Novo brinde</button>
          <button className="btn primary" onClick={() => setMov({ id: newId('mb'), brindeId: db.brindes[0]?.id || '', data: today(), tipo: 'saida', quantidade: 1, motivo: '' })}><IcPlus /> Registrar movimento</button>
        </>}
      />
      <div className="grid g-4">
        <Kpi label="Itens em estoque" value={int(db.brindes.reduce((s, b) => s + b.estoque, 0))} foot={`${db.brindes.length} tipos de brinde`} />
        <Kpi label="Valor em estoque" value={money(d.valorEstoque)} foot="custo unitário × estoque" />
        <Kpi label="Investido em brindes" value={money(d.custo)} foot={`${int(d.saidas.reduce((s, m) => s + m.quantidade, 0))} itens entregues · ${periodo.label.toLowerCase()}`} />
        <Kpi label="Abaixo do mínimo" value={int(d.baixos.length)} foot={d.baixos.map((b) => b.nome).join(', ') || 'Estoque saudável'} />
      </div>
      <div className="grid g-2-1 mt">
        <Card title="Estoque de brindes">
          <DataTable rows={db.brindes} onRowClick={setEditB} pageSize={50} columns={[
            { key: 'nome', label: 'Brinde', value: (r) => r.nome, render: (r) => <><div className="strong">{r.nome}</div><div className="small muted">{r.categoria}</div></> },
            { key: 'regra', label: 'Regra de concessão', render: (r) => <span className="small">{r.regraConcessao}</span> },
            { key: 'custo', label: 'Custo un.', num: true, value: (r) => r.custoUnitario, render: (r) => money2(r.custoUnitario) },
            { key: 'estoque', label: 'Estoque', num: true, value: (r) => r.estoque, render: (r) => (
              <div style={{ minWidth: 110 }}>
                <div>{int(r.estoque)} <span className="muted small">/ mín {r.estoqueMinimo}</span></div>
                <Meter value={r.estoque / Math.max(1, r.estoqueMinimo * 2)} target={0.5} />
              </div>
            ) },
            { key: 'st', label: '', render: (r) => r.estoque < r.estoqueMinimo ? <Badge tone="bad">Repor</Badge> : <Badge tone="good">OK</Badge> },
          ]} />
        </Card>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Investimento por brinde" sub={periodo.label}><HBars rows={d.porBrinde} fmt={money} color={colors.s1} /></Card>
          <Card title="Destino dos brindes" sub={periodo.label}><HBars rows={Object.entries(d.destino).map(([k, v]) => ({ key: k, label: k, value: v }))} fmt={money} color={colors.s2} /></Card>
        </div>
      </div>
      <Card title="Movimentações" className="mt">
        <DataTable rows={db.movBrindes} onRowClick={setMov} initialSort={{ key: 'data', dir: -1 }} columns={[
          { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => date(r.data) },
          { key: 'brinde', label: 'Brinde', value: (r) => brinde(r.brindeId)?.nome },
          { key: 'tipo', label: 'Tipo', value: (r) => r.tipo, render: (r) => <Badge tone={r.tipo === 'entrada' ? 'good' : 'info'}>{r.tipo === 'entrada' ? 'Entrada' : 'Saída'}</Badge> },
          { key: 'qtd', label: 'Qtd.', num: true, value: (r) => r.quantidade },
          { key: 'destino', label: 'Destino', render: (r) => db.clientes.find((c) => c.id === r.clienteId)?.nome || db.eventos.find((e) => e.id === r.eventoId)?.titulo || '—' },
          { key: 'motivo', label: 'Motivo', value: (r) => r.motivo, render: (r) => <span className="small">{r.motivo}</span> },
          { key: 'custo', label: 'Custo', num: true, value: (r) => r.quantidade * (brinde(r.brindeId)?.custoUnitario || 0), render: (r) => money(r.quantidade * (brinde(r.brindeId)?.custoUnitario || 0)) },
        ]} />
      </Card>

      {editB && (
        <FormModal title="Brinde" initial={editB} onClose={() => setEditB(null)}
          onSave={(v) => { upsert('brindes', v); setEditB(null) }}
          onDelete={db.brindes.some((b) => b.id === editB.id) ? () => { remove('brindes', editB.id); setEditB(null) } : undefined}
          fields={[
            { name: 'nome', label: 'Nome', required: true },
            { name: 'categoria', label: 'Categoria', type: 'select', options: ['Embalagem', 'PDV', 'Material de venda', 'Mimo', 'Pós-venda'].map((x) => ({ value: x, label: x })) },
            { name: 'estoque', label: 'Estoque atual', type: 'number' },
            { name: 'estoqueMinimo', label: 'Estoque mínimo', type: 'number' },
            { name: 'custoUnitario', label: 'Custo unitário (R$)', type: 'number' },
            { name: 'regraConcessao', label: 'Regra de concessão', type: 'textarea' },
          ]} />
      )}
      {mov && (
        <FormModal title="Movimento de brinde" initial={mov} onClose={() => setMov(null)} onSave={salvarMov}
          onDelete={db.movBrindes.some((m) => m.id === mov.id) ? () => {
            const b = brinde(mov.brindeId)
            if (b) upsert('brindes', { ...b, estoque: b.estoque - (mov.tipo === 'entrada' ? mov.quantidade : -mov.quantidade) })
            remove('movBrindes', mov.id)
            setMov(null)
          } : undefined}
          fields={[
            { name: 'brindeId', label: 'Brinde', type: 'select', required: true, options: db.brindes.map((b) => ({ value: b.id, label: `${b.nome} (estoque ${b.estoque})` })) },
            { name: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'saida', label: 'Saída (entrega)' }, { value: 'entrada', label: 'Entrada (compra/reposição)' }] },
            { name: 'quantidade', label: 'Quantidade', type: 'number', required: true },
            { name: 'data', label: 'Data', type: 'date', required: true },
            { name: 'clienteId', label: 'Revenda (se for para cliente)', type: 'select', options: db.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'eventoId', label: 'Evento (se for em evento)', type: 'select', options: db.eventos.map((e) => ({ value: e.id, label: `${date(e.dataInicio)} — ${e.titulo}` })) },
            { name: 'motivo', label: 'Motivo', full: true, placeholder: 'Ex.: bonificação por volume, aniversário, evento…' },
          ]} />
      )}
    </>
  )
}

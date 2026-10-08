import { useCallback, useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Cliente, Curva } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, Meter, PageHead, Person, useSearch } from '../components/ui'
import { Cliente360, clienteFields, statusTone } from '../components/Cliente360'
import { HBars } from '../components/charts'
import { ativacao, curvaABC, debitosPorCliente, faturamento12m, pedidosNoPeriodo, ultimaCompraMap } from '../lib/metrics'
import { date, money, pct, int } from '../lib/format'
import { diffDays, today } from '../lib/dates'
import { REGIOES, STATUS_CLIENTE, TIPO_CLIENTE } from '../data/labels'
import { exportCSV } from '../lib/csv'
import { IcDownload, IcPlus } from '../components/Icons'

export default function Carteira() {
  const { db, periodo, upsert, remove } = useStore()
  const [ver, setVer] = useState<Cliente | null>(null)
  const [edit, setEdit] = useState<Cliente | null>(null)
  const [resp, setResp] = useState('')
  const [status, setStatus] = useState('')
  const [ativ, setAtiv] = useState('')
  const [curva, setCurva] = useState('')
  const [regiao, setRegiao] = useState('')

  const base = useMemo(() => {
    const compraram = new Set(pedidosNoPeriodo(db, periodo).map((p) => p.clienteId))
    const ult = ultimaCompraMap(db)
    const abc = curvaABC(db)
    const deb = debitosPorCliente(db)
    return db.clientes.map((c) => ({
      ...c,
      ativoPeriodo: compraram.has(c.id),
      ultima: ult.get(c.id),
      diasSemCompra: ult.get(c.id) ? diffDays(today(), ult.get(c.id)!) : 9999,
      curva: (abc.get(c.id) || 'C') as Curva,
      fat12: faturamento12m(db, c.id),
      vencido: deb.get(c.id)?.vencido || 0,
    }))
  }, [db, periodo])

  const filtrados = base.filter((c) =>
    (!resp || c.responsavelId === resp) && (!status || c.status === status) && (!curva || c.curva === curva) && (!regiao || c.regiao === regiao) &&
    (!ativ || (ativ === 'sim' ? c.ativoPeriodo : !c.ativoPeriodo && c.status !== 'encerrada')))
  const text = useCallback((c: (typeof base)[number]) => `${c.nome} ${c.responsavelNome} ${c.cidade} ${c.documento} ${c.instagram}`, [])
  const { q, setQ, filtered } = useSearch(filtrados, text)

  const at = ativacao(db, periodo)
  const porRegiao = useMemo(() => {
    const m = new Map<string, { base: number; ativos: number }>()
    base.filter((c) => c.status !== 'encerrada').forEach((c) => {
      const cur = m.get(c.regiao) || { base: 0, ativos: 0 }
      cur.base++
      if (c.ativoPeriodo) cur.ativos++
      m.set(c.regiao, cur)
    })
    return Array.from(m.entries()).map(([r, v]) => ({ key: r, label: r, value: v.base ? v.ativos / v.base : 0, extra: <span className="muted small"> ({v.ativos}/{v.base})</span> })).sort((a, b) => a.value - b.value)
  }, [base])

  const novo = (): Cliente => ({
    id: newId('cli'), nome: '', responsavelNome: '', documento: '', tipo: 'revenda', cidade: '', uf: 'SP', regiao: REGIOES[0], telefone: '', email: '', instagram: '',
    responsavelId: db.colaboradores.find((c) => c.cargo !== 'analista')?.id || '', status: 'ativa', dataCadastro: today(), limiteCredito: 5000,
  })

  const aniversariantes = base.filter((c) => c.status !== 'encerrada' && c.aniversario?.startsWith(today().slice(5, 7)))

  return (
    <>
      <PageHead
        eyebrow="Gestão à vista"
        title="Carteira de revendas"
        desc="Toda a base de clientes com ativação no período, curva ABC, última compra e situação financeira. Clique numa revenda para a visão 360°."
        actions={<>
          <button className="btn" onClick={() => exportCSV('carteira-revendas.csv', filtered.map((c) => ({ Revenda: c.nome, Contato: c.responsavelNome, Tipo: TIPO_CLIENTE[c.tipo], Cidade: c.cidade, UF: c.uf, Regiao: c.regiao, Responsavel: db.colaboradores.find((x) => x.id === c.responsavelId)?.nome, Status: STATUS_CLIENTE[c.status], Curva: c.curva, 'Comprou no período': c.ativoPeriodo ? 'Sim' : 'Não', 'Última compra': date(c.ultima), 'Faturamento 12m': c.fat12, 'Débito vencido': c.vencido, Telefone: c.telefone })))}><IcDownload /> Exportar</button>
          <button className="btn primary" onClick={() => setEdit(novo())}><IcPlus /> Nova revenda</button>
        </>}
      />

      <div className="kpi-strip k4">
        <Kpi label="Base ativa (carteira)" value={int(at.base)} foot={<>{db.clientes.filter((c) => c.status === 'em_queda').length} vão cair · {db.clientes.filter((c) => c.status === 'encerrada').length} encerradas</>} />
        <Kpi label="Ativação no período" value={pct(at.taxa)} foot={<>{at.ativos} compraram · meta {pct(db.config.metaAtivacao)}</>}><Meter value={at.taxa} target={db.config.metaAtivacao} /></Kpi>
        <Kpi label={`Sem compra há +${db.config.diasInatividadeAlerta} dias`} value={int(base.filter((c) => c.status !== 'encerrada' && c.diasSemCompra > db.config.diasInatividadeAlerta).length)} foot="risco de churn — priorizar contato" />
        <Kpi label="Aniversariantes do mês" value={int(aniversariantes.length)} foot={aniversariantes.slice(0, 3).map((c) => c.nome).join(', ') || '—'} />
      </div>

      <div className="grid g-2 mt">
        <Card title="Ativação por região" sub={periodo.label}>
          <HBars rows={porRegiao} fmt={(v) => pct(v)} />
          <p className="small muted" style={{ marginBottom: 0 }}>Meta: {pct(db.config.metaAtivacao)} da base de cada região comprando no período.</p>
        </Card>
        <Card title="Curva ABC" sub="faturamento 12 meses">
          {(['A', 'B', 'C'] as Curva[]).map((k) => {
            const xs = base.filter((c) => c.curva === k && c.status !== 'encerrada')
            return (
              <div key={k} className="list-item">
                <span className={`curva ${k}`}>{k}</span>
                <div className="grow"><b>{xs.length}</b> revendas · {money(xs.reduce((s, c) => s + c.fat12, 0))}</div>
                <span className="small muted">{pct(xs.filter((c) => c.ativoPeriodo).length / Math.max(1, xs.length))} ativas</span>
              </div>
            )
          })}
          <p className="quote" style={{ margin: '22px 0 0', fontSize: 17 }}>A curva A concentra 80% do faturamento — é onde cada dia sem compra pesa mais.</p>
        </Card>
      </div>

      <div className="mt">
        <Card title="Revendas" sub={`${filtered.length} de ${base.length}`}>
          <div className="toolbar">
            <input className="input search" placeholder="Buscar por nome, cidade, CNPJ, Instagram…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" value={resp} onChange={(e) => setResp(e.target.value)}>
              <option value="">Toda a equipe</option>
              {db.colaboradores.filter((c) => c.cargo !== 'analista').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select className="input" value={regiao} onChange={(e) => setRegiao(e.target.value)}>
              <option value="">Todas as regiões</option>
              {REGIOES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_CLIENTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="input" value={ativ} onChange={(e) => setAtiv(e.target.value)}>
              <option value="">Ativação: todas</option>
              <option value="sim">Compraram no período</option>
              <option value="nao">Não compraram (ativar)</option>
            </select>
            <select className="input" value={curva} onChange={(e) => setCurva(e.target.value)}>
              <option value="">Curva ABC</option>
              <option>A</option><option>B</option><option>C</option>
            </select>
          </div>
          <DataTable
            rows={filtered}
            onRowClick={(r) => setVer(db.clientes.find((c) => c.id === r.id) || null)}
            initialSort={{ key: 'fat12', dir: -1 }}
            columns={[
              { key: 'nome', label: 'Revenda', value: (r) => r.nome, render: (r) => <><div className="strong">{r.nome}</div><div className="small muted">{r.cidade ? `${r.cidade}/${r.uf}` : "Cidade não informada"}</div></> },
              { key: 'curva', label: 'ABC', value: (r) => r.curva, render: (r) => <span className={`curva ${r.curva}`}>{r.curva}</span> },
              { key: 'resp', label: 'Responsável', value: (r) => db.colaboradores.find((c) => c.id === r.responsavelId)?.nome, render: (r) => <Person id={r.responsavelId} /> },
              { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={statusTone(r.status)}>{STATUS_CLIENTE[r.status]}</Badge> },
              { key: 'ativo', label: 'No período', value: (r) => (r.ativoPeriodo ? 1 : 0), render: (r) => r.ativoPeriodo ? <Badge tone="good">Comprou</Badge> : r.status === 'encerrada' ? <span className="muted">—</span> : <Badge tone="warn">Ativar</Badge> },
              { key: 'ultima', label: 'Última compra', value: (r) => r.diasSemCompra, render: (r) => r.ultima ? <><div>{date(r.ultima)}</div><div className="small muted">{r.diasSemCompra} dias</div></> : <span className="muted">nunca</span> },
              { key: 'fat12', label: 'Fat. 12m', num: true, value: (r) => r.fat12, render: (r) => money(r.fat12) },
              { key: 'vencido', label: 'Vencido', num: true, value: (r) => r.vencido, render: (r) => r.vencido ? <span style={{ color: 'var(--bad)', fontWeight: 600 }}>{money(r.vencido)}</span> : <span className="muted">—</span> },
            ]}
          />
        </Card>
      </div>

      {ver && <Cliente360 cliente={ver} onClose={() => setVer(null)} onEdit={() => { setEdit(ver); setVer(null) }} />}
      {edit && (
        <FormModal
          title={db.clientes.some((c) => c.id === edit.id) ? 'Editar revenda' : 'Nova revenda'}
          fields={clienteFields(db)}
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={(v) => { upsert('clientes', v); setEdit(null) }}
          onDelete={db.clientes.some((c) => c.id === edit.id) ? () => { remove('clientes', edit.id); setEdit(null) } : undefined}
        />
      )}
    </>
  )
}

import { useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Colaborador } from '../data/types'
import { Avatar, Badge, Card, DataTable, FormModal, Meter, PageHead, Segmented, StatRow, opts, type Field } from '../components/ui'
import { RevenueChart } from '../components/charts'
import { indicadoresCarteira } from '../lib/carteira'
import { ativacao, carteira, curvaABC, debitosPorCliente, devolucoesValidas, leadsNoPeriodo, metaPessoa, metasParaTexto, pedidosNoPeriodo, textoParaMetas, serieMensal, somaValor, ultimaCompraMap } from '../lib/metrics'
import { date, money, pct, safeDiv, int } from '../lib/format'
import { diffDays, inRange, today } from '../lib/dates'
import { CARGO, REGIOES } from '../data/labels'
import { IcEdit, IcPlus } from '../components/Icons'

const FIELDS: Field[] = [
  { name: 'nome', label: 'Nome', required: true },
  { name: 'cargo', label: 'Cargo', type: 'select', options: opts(CARGO), required: true },
  { name: 'regiao', label: 'Região / carteira', placeholder: 'Ex.: Capital SP — Zona Sul' },
  { name: 'email', label: 'E-mail', type: 'email' },
  { name: 'telefone', label: 'Telefone', type: 'tel' },
  { name: 'metaMensal', label: 'Meta de faturamento mensal (R$)', type: 'number' },
  { name: 'metasMesTexto', label: 'Metas de meses específicos', type: 'textarea', placeholder: '09/2026: 360000\n10/2026: 380000', help: 'Uma linha por mês. Nos meses sem linha vale a meta mensal acima.' },
  { name: 'metaAtivacao', label: 'Meta de ativação da carteira (0 a 1)', type: 'number', step: '0.01', help: '0,70 = 70% da base comprando no período' },
  { name: 'ativo', label: 'Ativo', type: 'checkbox', placeholder: 'Colaborador ativo' },
]

export default function Equipe() {
  const { db, periodo, upsert, remove } = useStore()
  const [edit, setEdit] = useState<Colaborador | null>(null)
  const [sel, setSel] = useState<string>(db.colaboradores.find((c) => c.cargo !== 'analista')?.id || '')
  const [filtro, setFiltro] = useState<'todos' | 'vendedora' | 'representante' | 'analista'>('todos')

  const linhas = useMemo(() => {
    const deb = debitosPorCliente(db)
    return db.colaboradores
      .filter((c) => filtro === 'todos' || c.cargo === filtro)
      .map((c) => {
        const ped = pedidosNoPeriodo(db, periodo, c.id)
        const fat = somaValor(ped)
        const meta = metaPessoa(c, periodo)
        const at = ativacao(db, periodo, c.id)
        const cart = carteira(db, c.id)
        const ids = new Set(cart.map((x) => x.id))
        const dev = somaValor(devolucoesValidas(db).filter((x) => ids.has(x.clienteId) && inRange(x.data, periodo)))
        const rec = db.reclamacoes.filter((r) => r.responsavelId === c.id && r.status !== 'resolvida').length
        const vencido = cart.reduce((s, x) => s + (deb.get(x.id)?.vencido || 0), 0)
        const leads = leadsNoPeriodo(db, periodo).filter((l) => l.responsavelId === c.id)
        return { c, ped, fat, meta, at, dev, rec, vencido, leads }
      })
  }, [db, periodo, filtro])

  const atual = db.colaboradores.find((c) => c.id === sel)

  return (
    <>
      <PageHead
        eyebrow="Gestão à vista"
        title="Equipe & metas"
        desc="Vendedoras, representantes e analista comercial: cada pessoa com meta de faturamento e meta de ativação de 70% da própria carteira."
        actions={<button className="btn primary" onClick={() => setEdit({ id: newId('col'), nome: '', cargo: 'vendedora', regiao: '', email: '', telefone: '', metaMensal: 0, metaAtivacao: db.config.metaAtivacao, ativo: true })}><IcPlus /> Novo colaborador</button>}
      />
      <div className="toolbar">
        <Segmented value={filtro} onChange={setFiltro} options={[{ value: 'todos', label: 'Todos' }, { value: 'vendedora', label: 'Vendedoras' }, { value: 'representante', label: 'Representantes' }, { value: 'analista', label: 'Analista' }]} />
      </div>

      <div className="grid g-3">
        {linhas.map(({ c, ped, fat, meta, at, dev, rec, vencido, leads }) => {
          const falta = Math.max(0, Math.ceil(at.base * c.metaAtivacao) - at.ativos)
          return (
            <section key={c.id} className="card" style={{ cursor: c.cargo !== 'analista' ? 'pointer' : undefined, outline: sel === c.id ? '2px solid var(--gold-soft)' : undefined }} onClick={() => c.cargo !== 'analista' && setSel(c.id)}>
              <div className="person" style={{ marginBottom: 14 }}>
                <Avatar name={c.nome} lg />
                <div className="meta" style={{ flex: 1 }}>
                  <div className="name" style={{ fontSize: 15 }}>{c.nome}</div>
                  <div className="small muted">{CARGO[c.cargo]} · {c.regiao}</div>
                </div>
                {!c.ativo && <Badge>Inativo</Badge>}
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setEdit(c) }} aria-label="Editar"><IcEdit width={16} /></button>
              </div>
              {c.cargo === 'analista' ? (
                <>
                  <StatRow label="Leads recebidos no período" value={int(leads.length)} />
                  <StatRow label="Qualificados ou além" value={int(leads.filter((l) => !['novo', 'contato', 'perdido'].includes(l.etapa)).length)} />
                  <StatRow label="Viraram revenda" value={int(leads.filter((l) => l.etapa === 'ganho').length)} />
                  <StatRow label="Taxa de conversão" value={pct(safeDiv(leads.filter((l) => l.etapa === 'ganho').length, leads.length), 1)} />
                  <StatRow label="Leads abertos (total)" value={int(db.leads.filter((l) => l.responsavelId === c.id && !['ganho', 'perdido'].includes(l.etapa)).length)} />
                </>
              ) : (
                <>
                  <div className="small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Faturamento <b>{money(fat)}</b></span><span className="muted">meta {money(meta)}</span>
                  </div>
                  <Meter value={safeDiv(fat, meta)} />
                  <div className="small" style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0 4px' }}>
                    <span>Ativação <b>{pct(at.taxa)}</b> ({at.ativos}/{at.base})</span><span className="muted">meta {pct(c.metaAtivacao)}</span>
                  </div>
                  <Meter value={at.taxa} target={c.metaAtivacao} />
                  <div className="small" style={{ marginTop: 8 }}>
                    {falta > 0 ? <Badge tone="warn">Faltam {falta} revendas comprando</Badge> : <Badge tone="good">Meta de ativação batida</Badge>}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <StatRow label="Pedidos / ticket médio" value={`${ped.length} · ${money(safeDiv(fat, ped.length))}`} />
                    <StatRow label="Devoluções (carteira)" value={money(dev)} />
                    <StatRow label="Reclamações abertas" value={rec} />
                    <StatRow label="Débito vencido da carteira" value={money(vencido)} />
                  </div>
                </>
              )}
            </section>
          )
        })}
      </div>

      <Matriz />

      {atual && atual.cargo !== 'analista' && <Detalhe colaboradorId={atual.id} />}

      {edit && (
        <FormModal
          title={db.colaboradores.some((c) => c.id === edit.id) ? 'Editar colaborador' : 'Novo colaborador'}
          fields={FIELDS.map((f) => (f.name === 'regiao' ? { ...f, type: 'text', help: `Sugestões: ${REGIOES.slice(0, 3).join(', ')}…` } : f))}
          initial={{ ...edit, metasMesTexto: metasParaTexto(edit.metasMes) }}
          onClose={() => setEdit(null)}
          onSave={({ metasMesTexto, ...v }) => { upsert('colaboradores', { ...v, metasMes: textoParaMetas(metasMesTexto) }); setEdit(null) }}
          onDelete={db.colaboradores.some((c) => c.id === edit.id) ? () => { remove('colaboradores', edit.id); setEdit(null) } : undefined}
        />
      )}
    </>
  )
}

function Detalhe({ colaboradorId }: { colaboradorId: string }) {
  const { db, periodo } = useStore()
  const c = db.colaboradores.find((x) => x.id === colaboradorId)!
  const serie = useMemo(() => serieMensal(db, 12, colaboradorId), [db, colaboradorId])
  const inativos = useMemo(() => {
    const ult = ultimaCompraMap(db)
    const abc = curvaABC(db)
    return ativacao(db, periodo, colaboradorId).inativos.map((cl) => ({ ...cl, ultima: ult.get(cl.id), curva: abc.get(cl.id) || 'C' }))
  }, [db, periodo, colaboradorId])
  return (
    <div className="grid g-2 mt-lg">
      <Card title={`Faturamento x meta — ${c.nome}`} sub="últimos 12 meses">
        <RevenueChart data={serie} height={240} />
      </Card>
      <Card title="Revendas para ativar" sub={`sem compra em ${periodo.label.toLowerCase()} · priorize curva A`}>
        <DataTable
          rows={inativos}
          pageSize={8}
          initialSort={{ key: 'curva', dir: 1 }}
          columns={[
            { key: 'nome', label: 'Revenda', value: (r) => r.nome, render: (r) => <><div className="strong">{r.nome}</div><div className="small muted">{r.cidade}/{r.uf} · {r.telefone}</div></> },
            { key: 'curva', label: 'Curva', value: (r) => r.curva, render: (r) => <span className={`curva ${r.curva}`}>{r.curva}</span> },
            { key: 'ultima', label: 'Última compra', value: (r) => r.ultima || '', render: (r) => r.ultima ? <>{date(r.ultima)} <span className="muted small">({diffDays(today(), r.ultima)}d)</span></> : <span className="muted">nunca</span> },
          ]}
          empty="Toda a carteira já comprou no período. 🎉"
        />
      </Card>
    </div>
  )
}

/** Desenvolvimento por nível: resultado (meta) × carteira trabalhada (ativação e follow-up). */
function Matriz() {
  const { db, periodo } = useStore()
  // período em andamento: compara com o ritmo esperado até hoje, não com a meta cheia
  const ritmo = periodo.fim > today() ? safeDiv(diffDays(today(), periodo.inicio) + 1, diffDays(periodo.fim, periodo.inicio) + 1) : 1
  const pessoas = useMemo(() => db.colaboradores.filter((c) => c.cargo !== 'analista' && c.ativo).map((c) => {
    const fat = somaValor(pedidosNoPeriodo(db, periodo, c.id))
    const ating = safeDiv(fat, metaPessoa(c, periodo) * ritmo)
    const at = ativacao(db, periodo, c.id)
    const ind = indicadoresCarteira(db, periodo, c.id)
    const trabalhada = at.taxa >= c.metaAtivacao * ritmo * 0.8 || (ind.atendimentos > 0 && ind.followUpNoPrazo >= 0.8)
    return { c, ating, at, ind, alto: ating >= 0.9, trabalhada }
  }), [db, periodo, ritmo])
  const Q = [
    { k: 'rb', alto: true, trab: false, t: 'Resultado sem base', d: 'Desenvolver método e carteira: ler a carteira junto, metas de ativação além do faturamento.' },
    { k: 'rc', alto: true, trab: true, t: 'Referência', d: 'Multiplicar o jeito de trabalhar: compartilhar a rotina com a equipe.' },
    { k: 'pl', alto: false, trab: false, t: 'Plano próximo', d: 'Metas curtas e acompanhamento semanal, com apoio na agenda.' },
    { k: 'bc', alto: false, trab: true, t: 'Base sem resultado', d: 'Desenvolver conversão e ticket: simulação de fechamento e peças de maior valor.' },
  ]
  return (
    <Card className="mt-lg" title="Desenvolvimento por nível" sub={`resultado × carteira trabalhada · ${periodo.label}`}>
      <div className="matriz">
        <span className="eixo-y">Resultado alto</span>
        {Q.slice(0, 2).map((q) => <Quadrante key={q.k} q={q} nomes={pessoas.filter((p) => p.alto === q.alto && p.trabalhada === q.trab)} />)}
        <span className="eixo-y">Resultado abaixo</span>
        {Q.slice(2).map((q) => <Quadrante key={q.k} q={q} nomes={pessoas.filter((p) => p.alto === q.alto && p.trabalhada === q.trab)} />)}
        <span />
        <div className="eixo-x"><span>Carteira pouco trabalhada</span><span>Carteira bem trabalhada</span></div>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>{ritmo < 1 && <>Período em andamento: metas comparadas ao ritmo esperado até hoje ({pct(ritmo)} do período). </>}Resultado alto: 90% da meta ou mais. Carteira bem trabalhada: ativação perto da meta ({pct(db.config.metaAtivacao)}) ou 80% dos follow-ups no prazo. Uma aprende com a outra: fechamento de um lado, rotina de follow-up do outro.</p>
    </Card>
  )
}

function Quadrante({ q, nomes }: { q: { t: string; d: string }; nomes: { c: Colaborador; ating: number; at: { taxa: number } }[] }) {
  return (
    <div className={`quad ${nomes.length ? 'on' : ''}`}>
      <h4>{q.t}</h4>
      <p className="small muted">{q.d}</p>
      <div className="pins">{nomes.map((n) => <span key={n.c.id} className="pin" title={`Meta ${pct(n.ating)} · ativação ${pct(n.at.taxa)}`}>{n.c.nome.split(' ')[0]}</span>)}</div>
    </div>
  )
}

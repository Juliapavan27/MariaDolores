import { useMemo, useState, useEffect } from 'react'
import { useFoco } from '../lib/router'
import { useStore } from '../data/store'
import type { Atendimento, Cliente } from '../data/types'
import { Badge, Card, DataTable, Kpi, PageHead, Person, FocoAviso } from '../components/ui'
import { Cliente360 } from '../components/Cliente360'
import { AtendimentoForm, novoAtendimento } from '../components/AtendimentoForm'
import { GRUPOS, ORDEM_GRUPOS, indicadoresCarteira, lerCarteira, ordemDaSemana, type Grupo } from '../lib/carteira'
import { ativacao, metaPessoa, metaShowroom, pedidosNoPeriodo, somaValor } from '../lib/metrics'
import { date, money, pct, int, safeDiv } from '../lib/format'

const TOM: Record<Grupo, 'good' | 'gold' | 'warn' | 'bad' | 'info'> = { recorrente: 'good', potencial: 'gold', risco: 'warn', inativa: 'bad', nova: 'info' }

export default function PlanoSemana() {
  const { db, periodo } = useStore()
  const [quem, setQuem] = useState('')
  const [grupo, setGrupo] = useState<Grupo>('risco')
  const [ver, setVer] = useState<Cliente | null>(null)
  const [registrar, setRegistrar] = useState<Atendimento | null>(null)

  const linhas = useMemo(() => lerCarteira(db, quem || undefined), [db, quem])
  const { ids: foco } = useFoco()
  // vindo de um alerta, leva direto para a lista de contatos (fica abaixo dos grupos)
  useEffect(() => {
    if (!foco) return
    const t = setTimeout(() => document.getElementById('ordem-semana')?.scrollIntoView({ block: 'start' }), 120)
    return () => clearTimeout(t)
  }, [foco])
  const lista = useMemo(() => (foco ? ordemDaSemana(linhas.filter((l) => foco.has(l.cliente.id)), 999) : ordemDaSemana(linhas, 25)), [linhas, foco])
  const ind = useMemo(() => indicadoresCarteira(db, periodo, quem || undefined), [db, periodo, quem])
  const contagem = useMemo(() => Object.fromEntries(ORDEM_GRUPOS.map((g) => [g, linhas.filter((l) => l.grupo === g)])) as Record<Grupo, typeof linhas>, [linhas])

  const at = ativacao(db, periodo, quem || undefined)
  const fat = somaValor(pedidosNoPeriodo(db, periodo, quem || undefined))
  const pessoa = quem ? db.colaboradores.find((c) => c.id === quem) : undefined
  const meta = quem ? (pessoa ? metaPessoa(pessoa, periodo) : 0) : metaShowroom(db, periodo)
  const g = GRUPOS[grupo]

  // Quadro "indicador → decisão"
  const quadro = [
    { id: 'ativas', ind: 'Revendas comprando no período', valor: `${at.ativos} de ${at.base} (${pct(at.taxa)})`, ok: at.taxa >= db.config.metaAtivacao, decisao: 'Onde colocar o esforço da equipe' },
    { id: 'risco', ind: 'Em risco (60 a 90 dias)', valor: int(ind.risco), ok: ind.risco === 0, decisao: 'Lista de contatos da semana' },
    { id: 'reat', ind: 'Reativações no período', valor: int(ind.reativacoes), ok: ind.reativacoes > 0, decisao: 'Ajustar a abordagem com inativas' },
    { id: 'fup', ind: 'Follow-up no prazo', valor: pct(ind.followUpNoPrazo), ok: ind.followUpNoPrazo >= 0.9, decisao: 'Conversa individual e apoio na agenda' },
    { id: 'conv', ind: 'Atendimento que vira pedido', valor: `${pct(ind.conversao)} de ${int(ind.atendimentos)}`, ok: ind.conversao >= 0.3, decisao: 'Treino de apresentação e fechamento' },
    { id: 'conc', ind: 'Concentração nas 10 maiores', valor: pct(ind.concentracaoTop10), ok: ind.concentracaoTop10 <= 0.4, decisao: 'Desenvolver a próxima faixa da carteira' },
    { id: 'nov', ind: 'Novas com 2ª compra', valor: pct(ind.segundaCompraNovas), ok: ind.segundaCompraNovas >= 0.5, decisao: 'Acompanhar quem não fez a 2ª compra' },
    { id: 'meta', ind: 'Faturamento e meta', valor: `${money(fat)} · ${pct(safeDiv(fat, meta))}`, ok: fat >= meta, decisao: 'Foco dos próximos dias' },
  ]

  return (
    <>
      <PageHead
        eyebrow="Gestão à vista"
        title="Plano da semana"
        desc="A carteira lida cliente a cliente: quem procurar primeiro, em que grupo cada revendedora está e o que cada indicador pede de decisão."
        actions={<>
          <select className="input" style={{ width: 'auto' }} value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="Carteira">
            <option value="">Carteira inteira</option>
            {db.colaboradores.filter((c) => c.cargo !== 'analista').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button className="btn primary" onClick={() => setRegistrar(novoAtendimento('', quem || db.colaboradores[0]?.id || ''))}>Registrar atendimento</button>
        </>}
      />
      <FocoAviso />

      <div className="grupos">
        {ORDEM_GRUPOS.map((k) => (
          <button key={k} type="button" className="grupo" aria-pressed={grupo === k} onClick={() => setGrupo(k)}>
            <span className="n">{int(contagem[k].length)}</span>
            <span className="t">{GRUPOS[k].titulo}</span>
            <span className="small">{GRUPOS[k].verbo}</span>
          </button>
        ))}
      </div>

      <div className="grid g-1-2 mt">
        <Card title={g.titulo} sub={g.verbo}>
          <p className="quote" style={{ marginTop: 0 }}>{g.objetivo}</p>
          <dl className="kv">
            <dt>Cadência</dt><dd>{g.cadencia}</dd>
            <dt>Quem cuida</dt><dd>{g.dono}</dd>
            <dt>Acompanho</dt><dd>{g.indicador}</dd>
          </dl>
          <ol className="passos">{g.acoes.map((a) => <li key={a}>{a}</li>)}</ol>
        </Card>
        <Card title={`Revendas neste grupo`} sub={`${int(contagem[grupo].length)} · maiores primeiro`}>
          <DataTable
            rows={contagem[grupo].map((l) => ({ ...l, id: l.cliente.id }))}
            pageSize={8}
            initialSort={{ key: 'fat', dir: -1 }}
            onRowClick={(r) => setVer(r.cliente)}
            empty="Nenhuma revenda neste grupo."
            columns={[
              { key: 'nome', label: 'Revenda', value: (r) => r.cliente.nome, render: (r) => <><div>{r.cliente.nome}</div><div className="small muted">{r.cliente.cidade}/{r.cliente.uf}</div></> },
              { key: 'resp', label: 'Responsável', render: (r) => <Person id={r.cliente.responsavelId} /> },
              { key: 'ult', label: 'Última compra', value: (r) => r.diasSemCompra, render: (r) => r.ultima ? <>{date(r.ultima)} <span className="muted small">{r.diasSemCompra}d</span></> : <span className="muted">nunca</span> },
              { key: 'fat', label: 'Fat. 12m', num: true, value: (r) => r.fat12, render: (r) => money(r.fat12) },
            ]}
          />
        </Card>
      </div>

      <div id="ordem-semana" style={{ scrollMarginTop: 120 }} />
      <Card className="mt" title="Ordem de contatos da semana" sub="follow-ups vencidos, esfriando, novas, recorrentes, potencial e inativas">
        <div className="list">
          {lista.map((l, i) => (
            <div key={l.cliente.id} className="list-item">
              <span className="ordem">{i + 1}</span>
              <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setVer(l.cliente)}>
                <div>{l.cliente.nome} <span className="muted small">· {l.cliente.cidade}/{l.cliente.uf}</span></div>
                <div className="small muted">{l.motivo}</div>
              </div>
              <Badge tone={l.followUpVencido ? 'bad' : TOM[l.grupo]}>{l.followUpVencido ? 'Follow-up vencido' : GRUPOS[l.grupo].titulo}</Badge>
              <span className="small muted" style={{ width: 92, textAlign: 'right' }}>{money(l.fat12)}</span>
              <button className="btn sm" onClick={() => setRegistrar(novoAtendimento(l.cliente.id, l.cliente.responsavelId))}>Registrar</button>
            </div>
          ))}
          {!lista.length && <div className="empty">Sem contatos pendentes nesta carteira.</div>}
        </div>
      </Card>

      <div className="kpi-strip k4 mt">
        <Kpi label="Follow-up no prazo" value={pct(ind.followUpNoPrazo)} foot={`${int(ind.followUpsVencidos)} vencidos agora · meta 90%`} />
        <Kpi label="Atendimento → pedido" value={pct(ind.conversao)} foot={`${int(ind.atendimentos)} atendimentos no período`} />
        <Kpi label="Intervalo entre compras" value={`${Math.round(ind.intervaloMedio)} dias`} foot="média da carteira" />
        <Kpi label="Concentração top 10" value={pct(ind.concentracaoTop10)} foot="do faturamento em 12 meses" />
      </div>

      <Card className="mt" title="Indicadores da semana" sub={`${periodo.label} · cada número orienta uma decisão`}>
        <DataTable rows={quadro} pageSize={20} columns={[
          { key: 'ind', label: 'Indicador', render: (r) => <span className="strong">{r.ind}</span> },
          { key: 'valor', label: 'Hoje', render: (r) => <Badge tone={r.ok ? 'good' : 'warn'}>{r.valor}</Badge> },
          { key: 'decisao', label: 'Decisão que ele orienta', render: (r) => <span className="muted">{r.decisao}</span> },
        ]} />
      </Card>

      {ver && <Cliente360 cliente={ver} onClose={() => setVer(null)} onEdit={() => setVer(null)} />}
      {registrar && <AtendimentoForm inicial={registrar} onClose={() => setRegistrar(null)} />}
    </>
  )
}

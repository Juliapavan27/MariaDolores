import { useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Cliente, TerritorioBloqueio } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, Modal, PageHead, Segmented, StatRow, useSearch } from '../components/ui'
import { diasParaQueda, quedasPrevistas, territorios, type LinhaTerritorio, type QuedaPrevista, type StatusTerritorio } from '../lib/metrics'
import { TERR_LABEL, terrTone } from './Leads'
import { clienteFields } from '../components/Cliente360'
import { date, int } from '../lib/format'
import { addDays, diffDays, today } from '../lib/dates'
import { REGIOES, UFS_AREA, ETAPA_LEAD, ORIGEM_LEAD } from '../data/labels'
import { exportCSV } from '../lib/csv'
import { IcDownload, IcPlus } from '../components/Icons'
import { RaioCapital } from '../components/RaioCapital'
import { km } from '../lib/format'
import { lerLocalizacao, raiosCapital, verificarPonto } from '../lib/raio'
import { ehCapitalSP } from '../data/labels'
import type { Lead } from '../data/types'

const COR: Record<StatusTerritorio, string> = {
  ocupada: 'var(--bad)', vai_liberar: 'var(--warn)', disponivel: 'var(--good)', prioritaria: 'var(--rose)', reservada: 'var(--info)', bloqueada: 'var(--muted)', por_raio: 'var(--gold)',
}

export default function Expansao() {
  const { db, upsert, remove } = useStore()
  const [filtro, setFiltro] = useState<'todas' | StatusTerritorio>('todas')
  const [cidade, setCidade] = useState<LinhaTerritorio | null>(null)
  const [bloq, setBloq] = useState<TerritorioBloqueio | null>(null)
  const [queda, setQueda] = useState<Cliente | null>(null)
  const [view, setView] = useState<'mapa' | 'tabela'>('mapa')
  const [todasVencidas, setTodasVencidas] = useState(false)
  const hoje = today()

  const linhas = useMemo(() => territorios(db), [db])
  const quedas = useMemo(() => quedasPrevistas(db), [db])
  const proximas = quedas.filter((q) => q.data >= hoje)
  // prazo vencido: mais antigas primeiro, que são as decisões mais atrasadas
  const vencidas = quedas.filter((q) => q.data < hoje).sort((a, b) => a.data.localeCompare(b.data))
  const previstaDe = new Map(quedas.map((q) => [q.cliente.id, q]))
  const recemLiberadas = db.clientes.filter((c) => c.status === 'encerrada' && c.quedaData && c.quedaData >= addDays(hoje, -60))
  const leadsAbertos = db.leads.filter((l) => !['ganho', 'perdido'].includes(l.etapa))
  const chave = (c: string, uf: string) => `${c.trim().toLowerCase()}|${uf}`
  const statusDe = new Map(linhas.map((l) => [l.chave, l]))
  const raios = useMemo(() => raiosCapital(db), [db])
  // Na capital a decisão é pelo raio em volta do endereço do lead, não pela cidade
  const situacao = (l: Lead): { pronto: boolean; label: string; tone: 'good' | 'warn' | 'bad' | 'info' | undefined } => {
    if (ehCapitalSP(l.cidade, l.uf)) {
      const p = lerLocalizacao(l.localizacao)
      if (!p) return { pronto: false, label: 'Capital — falta localização', tone: 'warn' }
      const v = verificarPonto(raios, p)
      return v.conflitos.length
        ? { pronto: false, label: `No raio de ${v.conflitos[0].raio.cliente.nome} (${km(v.conflitos[0].distanciaKm)})`, tone: 'bad' }
        : { pronto: true, label: 'Capital — fora dos raios', tone: 'good' }
    }
    const t = statusDe.get(chave(l.cidade, l.uf))
    if (!t) return { pronto: false, label: 'Cidade não mapeada', tone: undefined }
    return { pronto: ['disponivel', 'prioritaria'].includes(t.status), label: `${TERR_LABEL[t.status]}${t.liberaEm ? ` ${date(t.liberaEm)}` : ''}`, tone: terrTone(t.status) }
  }
  const espera = leadsAbertos.filter((l) => { const s = situacao(l); return !s.pronto && s.label !== 'Cidade não mapeada' })
  const prontos = leadsAbertos.filter((l) => situacao(l).pronto)

  const visiveis = linhas.filter((l) => filtro === 'todas' || l.status === filtro)
  const { q, setQ, filtered } = useSearch(visiveis, (l: LinhaTerritorio) => `${l.cidade} ${l.uf} ${l.regiao} ${l.revendas.map((r) => r.nome).join(' ')}`)
  const porRegiao = useMemo(() => {
    const m = new Map<string, LinhaTerritorio[]>()
    filtered.forEach((l) => m.set(l.regiao, [...(m.get(l.regiao) || []), l]))
    return Array.from(m.entries()).sort((a, b) => REGIOES.indexOf(a[0]) - REGIOES.indexOf(b[0]))
  }, [filtered])
  const conta = (s: StatusTerritorio) => linhas.filter((l) => l.status === s).length

  const itemQueda = (q: QuedaPrevista) => {
    const c = q.cliente
    const dias = diffDays(q.data, hoje)
    const aguardando = leadsAbertos.filter((l) => chave(l.cidade, l.uf) === chave(c.cidade, c.uf)).length
    return (
      <div key={c.id} className={`tl-item ${dias <= 15 ? 'urgent' : ''}`}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="tl-date">{date(q.data)}</span>
          <Badge tone={dias <= 15 ? 'bad' : 'warn'}>{dias < 0 ? `venceu há ${-dias} dias` : dias === 0 ? 'hoje' : `em ${dias} dias`}</Badge>
          {q.automatica && <Badge plain>sem compra</Badge>}
        </div>
        <div style={{ marginTop: 8 }}>{c.nome} <span className="muted small">· {c.cidade ? `${c.cidade}/${c.uf}` : 'cidade não informada'} · {c.regiao || '—'}</span></div>
        <div className="small muted" style={{ marginTop: 2 }}>
          {q.motivo} · {db.colaboradores.find((x) => x.id === c.responsavelId)?.nome}
          {aguardando > 0 && <> · <span style={{ color: 'var(--good)' }}>{aguardando} lead(s) aguardando a cidade</span></>}
        </div>
        <div className="tl-actions">
          {q.automatica ? (
            <>
              {dias <= 0
                ? <button className="btn sm" onClick={() => upsert('clientes', { ...c, status: 'encerrada', quedaData: hoje, quedaMotivo: q.motivo })}>Encerrar e liberar a região</button>
                : <button className="btn sm" onClick={() => upsert('clientes', { ...c, status: 'em_queda', quedaData: q.data, quedaMotivo: q.motivo })}>Confirmar queda</button>}
              <button className="btn sm ghost" onClick={() => upsert('clientes', { ...c, quedaDispensadaAte: addDays(hoje, 90) })}>Manter por 90 dias</button>
            </>
          ) : (
            <>
              <button className="btn sm" onClick={() => upsert('clientes', { ...c, status: 'encerrada' })}>Confirmar encerramento</button>
              <button className="btn sm ghost" onClick={() => setQueda(c)}>Editar</button>
              <button className="btn sm ghost" onClick={() => upsert('clientes', { ...c, status: 'ativa', quedaData: undefined, quedaMotivo: undefined, quedaDispensadaAte: addDays(hoje, 90) })}>Ficou</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHead
        eyebrow="Crescimento"
        title="Expansão & territórios"
        desc="Exclusividade por região: onde já há revenda, quais vão cair (e quando), quais cidades estão disponíveis e quais leads podem avançar sem gerar concorrência entre revendas."
        actions={<>
          <button className="btn" onClick={() => exportCSV('territorios.csv', linhas.map((l) => ({ Cidade: l.cidade, UF: l.uf, Regiao: l.regiao, Status: TERR_LABEL[l.status], 'Libera em': date(l.liberaEm), Revendas: l.revendas.filter((r) => r.status !== 'encerrada').map((r) => r.nome).join(' | '), 'Leads abertos': l.leadsAbertos, Motivo: l.motivo || '' })))}><IcDownload /> Exportar</button>
          <button className="btn" onClick={() => setBloq({ id: newId('ter'), cidade: '', uf: 'SP', regiao: REGIOES[0], tipo: 'prioritaria', motivo: '' })}><IcPlus /> Cidade / bloqueio</button>
          <button className="btn primary" onClick={() => setQueda({ ...(db.clientes.find((c) => c.status === 'ativa') as Cliente), status: 'em_queda', quedaData: addDays(hoje, 30) })}><IcPlus /> Registrar revenda que vai cair</button>
        </>}
      />

      <div className="kpi-strip k5">
        <Kpi label="Cidades disponíveis" value={int(conta('disponivel') + conta('prioritaria'))} foot={`${conta('prioritaria')} prioritárias para abrir`} />
        <Kpi label="Vão liberar" value={int(conta('vai_liberar'))} foot={`${proximas.filter((q) => q.data <= addDays(hoje, 30)).length} nos próximos 30 dias · ${vencidas.length} com prazo vencido`} />
        <Kpi label="Cidades ocupadas" value={int(conta('ocupada'))} foot={`${db.clientes.filter((c) => c.status !== 'encerrada').length} revendas vigentes`} />
        <Kpi label="Leads prontos p/ avançar" value={int(prontos.length)} foot="em cidade disponível" />
        <Kpi label="Leads em espera" value={int(espera.length)} foot="cidade ocupada, reservada ou liberando" />
      </div>

      <RaioCapital />

      <div className="grid g-2-1 mt">
        <Card title="Revendas que vão cair" sub={`marcadas pela equipe ou há mais de ${Math.max(0, diasParaQueda(db.config) - 90)} dias sem comprar — a região libera na data`}>
          <div className="timeline">
            {proximas.map(itemQueda)}
            {!proximas.length && <div className="empty">Nenhuma queda prevista para os próximos meses.</div>}
          </div>
          {vencidas.length > 0 && (
            <>
              <h4 style={{ margin: '18px 0 4px' }}>Prazo vencido — decidir agora ({vencidas.length})</h4>
              <p className="small muted" style={{ marginTop: 0 }}>Passaram de {diasParaQueda(db.config)} dias sem compra. Encerre para liberar a região ou mantenha, se houver motivo.</p>
              <div className="timeline">
                {(todasVencidas ? vencidas : vencidas.slice(0, 6)).map(itemQueda)}
              </div>
              {vencidas.length > 6 && <button className="btn sm ghost" onClick={() => setTodasVencidas(!todasVencidas)}>{todasVencidas ? 'Mostrar menos' : `Ver todas as ${vencidas.length}`}</button>}
            </>
          )}
          {recemLiberadas.length > 0 && (
            <>
              <h4 style={{ marginBottom: 8 }}>Liberadas nos últimos 60 dias</h4>
              {recemLiberadas.map((c) => <StatRow key={c.id} label={`${c.cidade}/${c.uf} — ex-${c.nome}`} value={date(c.quedaData)} />)}
            </>
          )}
        </Card>
        <Card title="Leads x território" sub="onde a analista pode avançar">
          <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Prontos para avançar ({prontos.length})</h4>
          <div className="list">
            {prontos.slice(0, 6).map((l) => <div key={l.id} className="list-item"><div className="grow"><div className="strong">{l.nome}</div><div className="small muted">{l.cidade}/{l.uf} · {ORIGEM_LEAD[l.origem]} · {ETAPA_LEAD[l.etapa]}</div></div><Badge tone={situacao(l).tone}>{situacao(l).label}</Badge></div>)}
          </div>
          <h4 style={{ margin: '14px 0 6px', fontSize: 13 }}>Em espera ({espera.length})</h4>
          <div className="list">
            {espera.slice(0, 6).map((l) => { const s = situacao(l); return <div key={l.id} className="list-item"><div className="grow"><div className="strong">{l.nome}</div><div className="small muted">{l.cidade}/{l.uf} · {ETAPA_LEAD[l.etapa]}</div></div><Badge tone={s.tone}>{s.label}</Badge></div> })}
          </div>
        </Card>
      </div>

      <Card className="mt" title="Mapa de territórios" sub={`${filtered.length} cidades`} right={<Segmented value={view} onChange={setView} options={[{ value: 'mapa', label: 'Por região' }, { value: 'tabela', label: 'Tabela' }]} />}>
        <div className="toolbar">
          <input className="input search" placeholder="Buscar cidade, região ou revenda…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
            <option value="todas">Todos os status</option>
            {Object.entries(TERR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="legend" style={{ marginLeft: 'auto' }}>
            {(Object.keys(COR) as StatusTerritorio[]).map((s) => <span key={s}><i style={{ background: COR[s] }} />{TERR_LABEL[s]}</span>)}
          </div>
        </div>
        {view === 'mapa' ? (
          <div className="grid g-3">
            {porRegiao.map(([regiao, cs]) => (
              <div key={regiao} className="region-block">
                <h4>{regiao} <span className="muted small" style={{ fontWeight: 400 }}>{cs.filter((c) => c.status === 'disponivel' || c.status === 'prioritaria').length} livres de {cs.length}</span></h4>
                <div className="city-chips">
                  {cs.map((c) => (
                    <button key={c.chave} className="city-chip" onClick={() => setCidade(c)} title={`${TERR_LABEL[c.status]}${c.liberaEm ? ' em ' + date(c.liberaEm) : ''}`}>
                      <span className="dot" style={{ background: COR[c.status] }} />
                      {c.cidade.replace('São Paulo — ', 'SP · ')}
                      {c.leadsAbertos > 0 && <span className="muted">· {c.leadsAbertos}L</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DataTable rows={filtered.map((l) => ({ ...l, id: l.chave }))} onRowClick={(r) => setCidade(r)} columns={[
            { key: 'cidade', label: 'Cidade', value: (r) => r.cidade, render: (r) => <b>{r.cidade}/{r.uf}</b> },
            { key: 'regiao', label: 'Região', value: (r) => r.regiao },
            { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={terrTone(r.status)}>{TERR_LABEL[r.status]}</Badge> },
            { key: 'libera', label: 'Libera em', value: (r) => r.liberaEm || '', render: (r) => r.liberaEm ? date(r.liberaEm) : '—' },
            { key: 'rev', label: 'Revenda(s)', render: (r) => <span className="small">{r.revendas.filter((x) => x.status !== 'encerrada').map((x) => x.nome).join(', ') || '—'}</span> },
            { key: 'leads', label: 'Leads abertos', num: true, value: (r) => r.leadsAbertos },
            { key: 'motivo', label: 'Observação', render: (r) => <span className="small muted">{r.motivo || ''}</span> },
          ]} />
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>Fora da capital, a exclusividade é por cidade (raio de referência: {db.config.raioExclusividadeKm} km). Em São Paulo capital vale o raio por endereço, no quadro acima.</p>
      </Card>

      {cidade && (
        <Modal title={`${cidade.cidade}/${cidade.uf}`} onClose={() => setCidade(null)} footer={<>
          <button className="btn" onClick={() => setCidade(null)}>Fechar</button>
          <button className="btn primary" onClick={() => { setBloq(db.territorios.find((t) => chave(t.cidade, t.uf) === cidade.chave) || { id: newId('ter'), cidade: cidade.cidade, uf: cidade.uf, regiao: cidade.regiao, tipo: 'reservada', motivo: '', ate: addDays(hoje, 30) }); setCidade(null) }}>Reservar / bloquear / priorizar</button>
        </>}>
          <div className="toolbar"><Badge tone={terrTone(cidade.status)}>{TERR_LABEL[cidade.status]}</Badge><span className="small muted">{cidade.regiao}</span></div>
          {cidade.liberaEm && <div className="alert warn"><span className="ico">△</span>Libera em {date(cidade.liberaEm)} — {cidade.motivo}</div>}
          {cidade.motivo && !cidade.liberaEm && <div className="alert info"><span className="ico">i</span>{cidade.motivo}</div>}
          <h4>Revendas na cidade</h4>
          {cidade.revendas.length ? cidade.revendas.map((r) => <StatRow key={r.id} label={r.nome} value={<Badge tone={r.status === 'encerrada' ? undefined : previstaDe.has(r.id) ? 'warn' : 'bad'}>{r.status === 'encerrada' ? `Encerrada ${date(r.quedaData)}` : previstaDe.has(r.id) ? `Cai em ${date(previstaDe.get(r.id)!.data)}` : 'Ativa (exclusiva)'}</Badge>} />) : <p className="muted">Nenhuma revenda cadastrada aqui.</p>}
          <h4>Leads interessados</h4>
          {leadsAbertos.filter((l) => chave(l.cidade, l.uf) === cidade.chave).map((l) => <StatRow key={l.id} label={`${l.nome} — ${l.empresa}`} value={ETAPA_LEAD[l.etapa]} />)}
          {!cidade.leadsAbertos && <p className="muted">Nenhum lead aberto para esta cidade.</p>}
        </Modal>
      )}

      {bloq && (
        <FormModal title="Cidade-alvo / bloqueio de território" initial={bloq} onClose={() => setBloq(null)}
          onSave={(v) => { upsert('territorios', v); setBloq(null) }}
          onDelete={db.territorios.some((t) => t.id === bloq.id) ? () => { remove('territorios', bloq.id); setBloq(null) } : undefined}
          fields={[
            { name: 'cidade', label: 'Cidade (ou bairro na capital)', required: true },
            { name: 'uf', label: 'UF', type: 'select', required: true, options: UFS_AREA.map((u) => ({ value: u, label: u })) },
            { name: 'regiao', label: 'Região', type: 'select', required: true, options: REGIOES.map((r) => ({ value: r, label: r })) },
            { name: 'tipo', label: 'Tipo', type: 'select', required: true, options: [{ value: 'prioritaria', label: 'Prioritária (abrir revenda)' }, { value: 'reservada', label: 'Reservada (negociação em andamento)' }, { value: 'bloqueada', label: 'Bloqueada (não abrir)' }] },
            { name: 'ate', label: 'Válido até (opcional)', type: 'date' },
            { name: 'motivo', label: 'Motivo', type: 'textarea' },
          ]} />
      )}

      {queda && (
        <FormModal title={`Revenda que vai cair${queda.nome ? ` — ${queda.nome}` : ''}`} initial={queda} onClose={() => setQueda(null)}
          onSave={(v) => {
            // aplica só os campos de queda sobre o cadastro da revenda escolhida
            const alvo = db.clientes.find((c) => c.id === v.id)
            if (alvo) upsert('clientes', { ...alvo, status: v.status, quedaData: v.quedaData, quedaMotivo: v.quedaMotivo })
            setQueda(null)
          }}
          fields={[
            { name: 'id', label: 'Revenda', type: 'select', required: true, options: db.clientes.filter((c) => c.status !== 'encerrada').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: `${c.nome} — ${c.cidade}/${c.uf}` })) },
            ...clienteFields(db).filter((f) => ['status', 'quedaData', 'quedaMotivo'].includes(f.name)).map((f) => (f.name === 'quedaData' ? { ...f, required: true } : f)),
          ]}
        />
      )}
    </>
  )
}

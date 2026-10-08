import { useCallback, useMemo, useRef, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { EtapaLead, Lead, OrigemLead } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, Modal, PageHead, Segmented, opts, useSearch } from '../components/ui'
import { HBars, MultiLine, useChartColors } from '../components/charts'
import { leadParado, leadsNoPeriodo, metaDoPeriodo, territorios, type LinhaTerritorio } from '../lib/metrics'
import { dayMonth, money, pct, safeDiv, int, date } from '../lib/format'
import { addDays, diffDays, today } from '../lib/dates'
import { ETAPA_LEAD, ETAPAS_FUNIL, ORIGEM_LEAD, UFS_AREA } from '../data/labels'
import { exportCSV, parseCSV } from '../lib/csv'
import { IcDownload, IcPlus, IcUpload } from '../components/Icons'

export const TERR_LABEL: Record<LinhaTerritorio['status'], string> = {
  ocupada: 'Cidade ocupada', vai_liberar: 'Vai liberar', disponivel: 'Disponível', bloqueada: 'Bloqueada', reservada: 'Reservada', prioritaria: 'Prioritária',
}
export const terrTone = (s?: LinhaTerritorio['status']) =>
  s === 'disponivel' || s === 'prioritaria' ? 'good' : s === 'vai_liberar' ? 'warn' : s === 'ocupada' || s === 'bloqueada' ? 'bad' : s === 'reservada' ? 'info' : undefined

export default function Leads() {
  const { db, periodo, upsert, remove, bulkUpsert } = useStore()
  const [view, setView] = useState<'funil' | 'lista' | 'analise'>('funil')
  const [edit, setEdit] = useState<Lead | null>(null)
  const [origem, setOrigem] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [importados, setImportados] = useState<Lead[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const colors = useChartColors()

  const mapa = useMemo(() => {
    const m = new Map<string, LinhaTerritorio>()
    territorios(db).forEach((t) => m.set(t.chave, t))
    return m
  }, [db])
  const terr = useCallback((l: Lead) => mapa.get(`${l.cidade.trim().toLowerCase()}|${l.uf}`), [mapa])

  const doPeriodo = leadsNoPeriodo(db, periodo)
  const abertos = db.leads.filter((l) => !['ganho', 'perdido'].includes(l.etapa))
  const base = (view === 'funil' ? abertos.concat(doPeriodo.filter((l) => ['ganho', 'perdido'].includes(l.etapa))) : doPeriodo).filter((l) => !origem || l.origem === origem)
  const { q, setQ, filtered } = useSearch(base, useCallback((l: Lead) => `${l.nome} ${l.empresa} ${l.cidade} ${l.email} ${l.telefone}`, []))

  const invest = metaDoPeriodo(db.config.investimentoMidiaMensal, periodo)
  const investPorOrigem: Partial<Record<OrigemLead, number>> = { meta: invest * db.config.divisaoMeta, google: invest * (1 - db.config.divisaoMeta) }
  const ganhos = doPeriodo.filter((l) => l.etapa === 'ganho')
  const pagos = doPeriodo.filter((l) => l.origem === 'meta' || l.origem === 'google')

  const analise = useMemo(() => {
    const origens = Object.keys(ORIGEM_LEAD) as OrigemLead[]
    const porOrigem = origens.map((o) => {
      const xs = doPeriodo.filter((l) => l.origem === o)
      const qual = xs.filter((l) => !['novo', 'contato', 'perdido'].includes(l.etapa)).length
      const g = xs.filter((l) => l.etapa === 'ganho').length
      const custo = investPorOrigem[o] || 0
      return { id: o, origem: ORIGEM_LEAD[o], leads: xs.length, qual, ganhos: g, conv: safeDiv(g, xs.length), custo, cpl: safeDiv(custo, xs.length), cac: safeDiv(custo, g) }
    }).filter((x) => x.leads > 0)
    // Funil acumulado: quantos leads chegaram pelo menos até cada etapa
    const ordem = ETAPAS_FUNIL
    const chegou = (l: Lead, e: EtapaLead) => l.etapa !== 'perdido' && ordem.indexOf(l.etapa) >= ordem.indexOf(e)
    const funil = ordem.map((e) => ({ key: e, label: ETAPA_LEAD[e], value: doPeriodo.filter((l) => chegou(l, e) || (e === 'novo')).length }))
    const perdas = new Map<string, number>()
    doPeriodo.filter((l) => l.etapa === 'perdido').forEach((l) => perdas.set(l.motivoPerda || 'Sem motivo', (perdas.get(l.motivoPerda || 'Sem motivo') || 0) + 1))
    // Série semanal (12 semanas) por grupo de origem
    const semanas = Array.from({ length: 12 }, (_, i) => addDays(today(), -7 * (11 - i)))
    const serie = semanas.map((fim) => {
      const ini = addDays(fim, -6)
      const xs = db.leads.filter((l) => l.dataEntrada >= ini && l.dataEntrada <= fim)
      return { semana: fim, meta: xs.filter((l) => l.origem === 'meta').length, google: xs.filter((l) => l.origem === 'google').length, prospeccao: xs.filter((l) => l.origem === 'prospeccao').length, outros: xs.filter((l) => !['meta', 'google', 'prospeccao'].includes(l.origem)).length }
    })
    return { porOrigem, funil, perdas: Array.from(perdas.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, value: v })), serie }
  }, [db, doPeriodo, investPorOrigem.meta, investPorOrigem.google])

  const novo = (): Lead => ({
    id: newId('lead'), nome: '', empresa: '', cidade: '', uf: 'SP', telefone: '', email: '', origem: 'prospeccao', etapa: 'novo',
    responsavelId: db.colaboradores.find((c) => c.cargo === 'analista')?.id || '', dataEntrada: today(), ultimaInteracao: today(), valorPotencial: 3000,
  })

  // Importação de CSV exportado do RD Station Marketing/CRM
  const importar = async (file: File) => {
    const rows = parseCSV(await file.text())
    const get = (r: Record<string, string>, ...keys: string[]) => {
      for (const k of Object.keys(r)) if (keys.some((x) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(x))) return r[k]
      return ''
    }
    const origemDe = (s: string): OrigemLead => {
      const t = s.toLowerCase()
      if (/facebook|instagram|meta|fb/.test(t)) return 'meta'
      if (/google|adwords|cpc|search/.test(t)) return 'google'
      if (/indica/.test(t)) return 'indicacao'
      if (/evento/.test(t)) return 'evento'
      if (/prospec|outbound|fria/.test(t)) return 'prospeccao'
      return 'organico'
    }
    const analista = db.colaboradores.find((c) => c.cargo === 'analista')?.id || ''
    const existentes = new Set(db.leads.map((l) => l.email.toLowerCase()).filter(Boolean))
    const leads: Lead[] = rows.map((r) => {
      const email = get(r, 'email')
      const criado = get(r, 'data de criacao', 'criado em', 'created', 'data da primeira conversao', 'data')
      const iso = /^\d{2}\/\d{2}\/\d{4}/.test(criado) ? criado.slice(0, 10).split('/').reverse().join('-') : /^\d{4}-\d{2}-\d{2}/.test(criado) ? criado.slice(0, 10) : today()
      const estagio = get(r, 'estagio', 'etapa', 'lifecycle').toLowerCase()
      const etapa: EtapaLead = /cliente|ganho|venda/.test(estagio) ? 'ganho' : /oportunidade|negocia/.test(estagio) ? 'negociacao' : /qualific/.test(estagio) ? 'qualificado' : /perdid/.test(estagio) ? 'perdido' : 'novo'
      return {
        id: newId('lead'), nome: get(r, 'nome', 'name') || email, empresa: get(r, 'empresa', 'company'), cidade: get(r, 'cidade', 'city'), uf: (get(r, 'estado', 'uf', 'state') || 'SP').slice(0, 2).toUpperCase(),
        telefone: get(r, 'celular', 'telefone', 'phone', 'mobile'), email, origem: origemDe(get(r, 'origem', 'source', 'fonte', 'canal')), etapa,
        responsavelId: analista, dataEntrada: iso, ultimaInteracao: iso, valorPotencial: 3000, rdStationId: get(r, 'id', 'uuid') || undefined,
      }
    }).filter((l) => l.nome && !(l.email && existentes.has(l.email.toLowerCase())))
    setImportados(leads)
  }

  return (
    <>
      <PageHead
        eyebrow="Crescimento"
        title="Leads"
        desc="Acompanhamento dos leads de Meta Ads, Google Ads, prospecção fria e indicações — com checagem de exclusividade da cidade antes de avançar."
        actions={<>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = '' }} />
          <button className="btn" onClick={() => fileRef.current?.click()} title="Exporte os contatos do RD Station em CSV e importe aqui"><IcUpload /> Importar do RD Station</button>
          <button className="btn" onClick={() => exportCSV('leads.csv', filtered.map((l) => ({ Nome: l.nome, Empresa: l.empresa, Cidade: l.cidade, UF: l.uf, Telefone: l.telefone, Email: l.email, Origem: ORIGEM_LEAD[l.origem], Campanha: db.campanhas.find((c) => c.id === l.campanhaId)?.nome || '', Etapa: ETAPA_LEAD[l.etapa], Entrada: date(l.dataEntrada), 'Última interação': date(l.ultimaInteracao), 'Próximo passo': l.proximoPasso || '', Territorio: terr(l) ? TERR_LABEL[terr(l)!.status] : 'Sem mapeamento' })))}><IcDownload /> Exportar</button>
          <button className="btn primary" onClick={() => setEdit(novo())}><IcPlus /> Novo lead</button>
        </>}
      />
      <div className="kpi-strip k5">
        <Kpi label="Leads no período" value={int(doPeriodo.length)} foot={`${int(abertos.length)} abertos no funil`} />
        <Kpi label="Viraram revenda" value={int(ganhos.length)} foot={`conversão ${pct(safeDiv(ganhos.length, doPeriodo.length), 1)}`} />
        <Kpi label="CPL mídia paga" value={money(safeDiv(invest, pagos.length))} foot={`${money(invest)} investidos · ${pagos.length} leads`} />
        <Kpi label="CAC mídia paga" value={pagos.some((l) => l.etapa === 'ganho') ? money(safeDiv(invest, pagos.filter((l) => l.etapa === 'ganho').length)) : '—'} foot="custo por nova revenda" />
        <Kpi label="Leads parados" value={int(abertos.filter((l) => leadParado(l)).length)} foot="sem interação há +7 dias" />
      </div>

      <div className="toolbar mt-lg">
        <Segmented value={view} onChange={setView} options={[{ value: 'funil', label: 'Funil (kanban)' }, { value: 'lista', label: 'Lista' }, { value: 'analise', label: 'Análise' }]} />
        <input className="input search" placeholder="Buscar lead, cidade, e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {Object.entries(ORIGEM_LEAD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {view === 'funil' && (
        <div className="kanban">
          {[...ETAPAS_FUNIL, 'perdido' as EtapaLead].map((etapa) => {
            const xs = filtered.filter((l) => l.etapa === etapa)
            return (
              <div key={etapa} className={`kan-col ${over === etapa ? 'drop' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(etapa) }}
                onDragLeave={() => setOver(null)}
                onDrop={() => {
                  const l = db.leads.find((x) => x.id === drag)
                  if (l && l.etapa !== etapa) upsert('leads', { ...l, etapa, ultimaInteracao: today() })
                  setDrag(null); setOver(null)
                }}>
                <div className="kan-head">{ETAPA_LEAD[etapa]}<span className="count">{xs.length}</span></div>
                {xs.slice(0, 40).map((l) => {
                  const t = terr(l)
                  return (
                    <div key={l.id} className="kan-card" draggable onDragStart={() => setDrag(l.id)} onClick={() => setEdit(l)}>
                      <div className="t">{l.nome}</div>
                      <div className="muted">{l.empresa} · {l.cidade}/{l.uf}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Badge plain>{ORIGEM_LEAD[l.origem]}</Badge>
                        {t && etapa !== 'ganho' && etapa !== 'perdido' && <Badge tone={terrTone(t.status)}>{TERR_LABEL[t.status]}</Badge>}
                        {leadParado(l) && <Badge tone="warn">{diffDays(today(), l.ultimaInteracao)}d parado</Badge>}
                      </div>
                      {l.proximoPasso && <div className="small">→ {l.proximoPasso}</div>}
                    </div>
                  )
                })}
                {xs.length > 40 && <div className="small muted">+{xs.length - 40} leads (use a lista)</div>}
              </div>
            )
          })}
        </div>
      )}

      {view === 'lista' && (
        <DataTable rows={filtered} onRowClick={setEdit} initialSort={{ key: 'entrada', dir: -1 }} columns={[
          { key: 'nome', label: 'Lead', value: (l) => l.nome, render: (l) => <><div className="strong">{l.nome}</div><div className="small muted">{l.empresa} · {l.telefone}</div></> },
          { key: 'cidade', label: 'Cidade', value: (l) => l.cidade, render: (l) => <>{l.cidade}/{l.uf}</> },
          { key: 'terr', label: 'Território', value: (l) => terr(l)?.status, render: (l) => { const t = terr(l); return t ? <Badge tone={terrTone(t.status)}>{TERR_LABEL[t.status]}{t.status === 'vai_liberar' && t.liberaEm ? ` ${date(t.liberaEm)}` : ''}</Badge> : <Badge>Não mapeada</Badge> } },
          { key: 'origem', label: 'Origem', value: (l) => ORIGEM_LEAD[l.origem], render: (l) => <><div>{ORIGEM_LEAD[l.origem]}</div><div className="small muted">{db.campanhas.find((c) => c.id === l.campanhaId)?.nome}</div></> },
          { key: 'etapa', label: 'Etapa', value: (l) => ETAPAS_FUNIL.indexOf(l.etapa), render: (l) => <Badge tone={l.etapa === 'ganho' ? 'good' : l.etapa === 'perdido' ? 'bad' : 'gold'}>{ETAPA_LEAD[l.etapa]}</Badge> },
          { key: 'entrada', label: 'Entrada', value: (l) => l.dataEntrada, render: (l) => date(l.dataEntrada) },
          { key: 'ult', label: 'Últ. interação', value: (l) => l.ultimaInteracao, render: (l) => <>{date(l.ultimaInteracao)}{leadParado(l) && <div><Badge tone="warn">parado</Badge></div>}</> },
          { key: 'prox', label: 'Próximo passo', render: (l) => <span className="small">{l.proximoPasso || l.motivoPerda || '—'}</span> },
        ]} />
      )}

      {view === 'analise' && (
        <>
          <div className="grid g-2">
            <Card title="Funil de conversão" sub={periodo.label}>
              <HBars rows={analise.funil} color={colors.s1} />
            </Card>
            <Card title="Leads por semana" sub="últimas 12 semanas">
              <MultiLine data={analise.serie} xKey="semana" xFmt={dayMonth} series={[
                { key: 'meta', label: 'Meta Ads', color: colors.s1 }, { key: 'google', label: 'Google Ads', color: colors.s2 },
                { key: 'prospeccao', label: 'Prospecção fria', color: colors.s3 }, { key: 'outros', label: 'Indicação/evento/orgânico', color: colors.s4 },
              ]} />
            </Card>
          </div>
          <div className="grid g-2-1 mt">
            <Card title="Desempenho por origem" sub={`${periodo.label} · custo de mídia proporcional ao investimento configurado`}>
              <DataTable rows={analise.porOrigem} columns={[
                { key: 'origem', label: 'Origem', value: (r) => r.origem, render: (r) => <b>{r.origem}</b> },
                { key: 'leads', label: 'Leads', num: true, value: (r) => r.leads },
                { key: 'qual', label: 'Qualificados+', num: true, value: (r) => r.qual },
                { key: 'ganhos', label: 'Revendas', num: true, value: (r) => r.ganhos },
                { key: 'conv', label: 'Conversão', num: true, value: (r) => r.conv, render: (r) => pct(r.conv, 1) },
                { key: 'cpl', label: 'CPL', num: true, value: (r) => r.cpl, render: (r) => r.custo ? money(r.cpl) : '—' },
                { key: 'cac', label: 'CAC', num: true, value: (r) => r.cac, render: (r) => r.custo ? (r.ganhos ? money(r.cac) : 'sem venda') : '—' },
              ]} />
            </Card>
            <Card title="Motivos de perda" sub={periodo.label}><HBars rows={analise.perdas} color={colors.s2} /></Card>
          </div>
        </>
      )}

      {edit && (
        <FormModal title={db.leads.some((l) => l.id === edit.id) ? 'Lead' : 'Novo lead'} initial={edit} onClose={() => setEdit(null)}
          onSave={(v) => { upsert('leads', v); setEdit(null) }}
          onDelete={db.leads.some((l) => l.id === edit.id) ? () => { remove('leads', edit.id); setEdit(null) } : undefined}
          fields={[
            { name: 'nome', label: 'Nome', required: true },
            { name: 'empresa', label: 'Empresa / loja' },
            { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel' },
            { name: 'email', label: 'E-mail', type: 'email' },
            { name: 'cidade', label: 'Cidade (igual ao cadastro de revendas)', required: true, help: (() => { const t = terr(edit); return t ? `Território: ${TERR_LABEL[t.status]}${t.liberaEm ? ` em ${date(t.liberaEm)}` : ''}${t.revendas.length ? ` · ${t.revendas.filter((r) => r.status !== 'encerrada').map((r) => r.nome).join(', ')}` : ''}` : 'Cidade ainda não mapeada na Expansão.' })() },
            { name: 'uf', label: 'UF', type: 'select', required: true, options: UFS_AREA.map((u) => ({ value: u, label: u })) },
            { name: 'origem', label: 'Origem', type: 'select', required: true, options: opts(ORIGEM_LEAD) },
            { name: 'campanhaId', label: 'Campanha', type: 'select', options: db.campanhas.map((c) => ({ value: c.id, label: `${c.plataforma === 'meta' ? 'Meta' : 'Google'} — ${c.nome}` })) },
            { name: 'criativoId', label: 'Criativo', type: 'select', options: db.criativos.filter((c) => !edit.campanhaId || c.campanhaId === edit.campanhaId).map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'etapa', label: 'Etapa', type: 'select', required: true, options: opts(ETAPA_LEAD) },
            { name: 'responsavelId', label: 'Responsável', type: 'select', options: db.colaboradores.map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'valorPotencial', label: 'Pedido inicial potencial (R$)', type: 'number' },
            { name: 'dataEntrada', label: 'Entrada', type: 'date' },
            { name: 'ultimaInteracao', label: 'Última interação', type: 'date' },
            { name: 'proximoPasso', label: 'Próximo passo', full: true },
            { name: 'motivoPerda', label: 'Motivo da perda (se perdido)', type: 'select', options: ['Região indisponível (exclusividade)', 'Sem capital para pedido mínimo', 'Sem retorno', 'Preferiu concorrente', 'Pessoa física sem CNPJ', 'Outro'].map((x) => ({ value: x, label: x })) },
            { name: 'rdStationId', label: 'ID no RD Station' },
          ]} />
      )}

      {importados && (
        <Modal title="Importar leads do RD Station" onClose={() => setImportados(null)} wide footer={<>
          <button className="btn" onClick={() => setImportados(null)}>Cancelar</button>
          <button className="btn primary" disabled={!importados.length} onClick={() => { bulkUpsert('leads', importados); setImportados(null) }}>Importar {importados.length} leads</button>
        </>}>
          <p className="small muted" style={{ marginTop: 0 }}>Colunas reconhecidas automaticamente: Nome, E-mail, Celular/Telefone, Empresa, Cidade, Estado, Origem da primeira conversão, Estágio no funil, Data de criação. Leads com e-mail já existente são ignorados.</p>
          <DataTable rows={importados} pageSize={10} columns={[
            { key: 'nome', label: 'Nome', value: (l) => l.nome },
            { key: 'email', label: 'E-mail', value: (l) => l.email },
            { key: 'cidade', label: 'Cidade', render: (l) => `${l.cidade}/${l.uf}` },
            { key: 'origem', label: 'Origem', render: (l) => ORIGEM_LEAD[l.origem] },
            { key: 'etapa', label: 'Etapa', render: (l) => ETAPA_LEAD[l.etapa] },
            { key: 'terr', label: 'Território', render: (l) => { const t = terr(l); return t ? <Badge tone={terrTone(t.status)}>{TERR_LABEL[t.status]}</Badge> : <Badge>Não mapeada</Badge> } },
          ]} empty="Nenhum lead novo encontrado no arquivo." />
        </Modal>
      )}
    </>
  )
}

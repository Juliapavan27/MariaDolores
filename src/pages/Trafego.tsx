import { useMemo, useState } from 'react'
import { newId, useStore } from '../data/store'
import type { Campanha, Criativo, Plataforma } from '../data/types'
import { Badge, Card, DataTable, FormModal, Kpi, Meter, PageHead, Segmented, StatRow, opts } from '../components/ui'
import { HBars, useChartColors } from '../components/charts'
import { metricasCriativo } from '../lib/metrics'
import { date, money, money2, pct, safeDiv, int, short } from '../lib/format'
import { FORMATO, STATUS_CAMPANHA } from '../data/labels'
import { exportCSV } from '../lib/csv'
import { IcDownload, IcPlus, IcSparkle } from '../components/Icons'

const PLAT: Record<Plataforma, string> = { meta: 'Meta Ads', google: 'Google Ads' }

function soma(xs: Criativo[]) {
  return xs.reduce((s, c) => ({ impressoes: s.impressoes + c.impressoes, cliques: s.cliques + c.cliques, leads: s.leads + c.leads, conversoes: s.conversoes + c.conversoes, investido: s.investido + c.investido }), { impressoes: 0, cliques: 0, leads: 0, conversoes: 0, investido: 0 })
}

export default function Trafego() {
  const { db, upsert, remove } = useStore()
  const [plat, setPlat] = useState<'todas' | Plataforma>('todas')
  const [soAtivos, setSoAtivos] = useState(true)
  const [editC, setEditC] = useState<Campanha | null>(null)
  const [editCr, setEditCr] = useState<Criativo | null>(null)
  const colors = useChartColors()
  const camp = (id: string) => db.campanhas.find((c) => c.id === id)

  const d = useMemo(() => {
    const crs = db.criativos.filter((c) => (plat === 'todas' || camp(c.campanhaId)?.plataforma === plat) && (!soAtivos || (c.ativo && camp(c.campanhaId)?.status === 'ativa')))
    const tot = soma(crs)
    const ranking = crs.filter((c) => c.leads > 0).map((c) => ({ c, m: metricasCriativo(c) })).sort((a, b) => a.m.cpl - b.m.cpl)
    const porPlat = (['meta', 'google'] as Plataforma[]).map((p) => {
      const xs = db.criativos.filter((c) => camp(c.campanhaId)?.plataforma === p && c.ativo && camp(c.campanhaId)?.status === 'ativa')
      const orc = db.campanhas.filter((c) => c.plataforma === p && c.status === 'ativa').reduce((s, c) => s + c.orcamentoMensal, 0)
      const planejado = db.config.investimentoMidiaMensal * (p === 'meta' ? db.config.divisaoMeta : 1 - db.config.divisaoMeta)
      return { p, ...soma(xs), orc, planejado }
    })
    const campanhas = db.campanhas.filter((c) => (plat === 'todas' || c.plataforma === plat) && (!soAtivos || c.status === 'ativa')).map((c) => ({ ...c, t: soma(db.criativos.filter((x) => x.campanhaId === c.id)) }))
    // Insights automáticos
    const cplMedio = safeDiv(tot.investido, tot.leads)
    const insights: { tone: 'good' | 'warn' | 'bad' | 'info'; txt: string }[] = []
    if (ranking[0]) insights.push({ tone: 'good', txt: `Melhor custo por lead: “${ranking[0].c.nome}” (${money2(ranking[0].m.cpl)}). Considere escalar o orçamento ou replicar o formato ${FORMATO[ranking[0].c.formato].toLowerCase()}.` })
    ranking.filter((r) => r.m.cpl > cplMedio * 1.6).forEach((r) => insights.push({ tone: 'bad', txt: `“${r.c.nome}” tem CPL ${money2(r.m.cpl)} — ${(r.m.cpl / cplMedio).toFixed(1)}x a média. Avalie pausar ou trocar a copy.` }))
    crs.filter((c) => camp(c.campanhaId)?.plataforma === 'meta' && metricasCriativo(c).ctr < 0.01 && c.impressoes > 5000).forEach((c) => insights.push({ tone: 'warn', txt: `CTR baixo em “${c.nome}” (${pct(metricasCriativo(c).ctr, 2)}). Teste novo gancho nos 3 primeiros segundos ou nova imagem.` }))
    crs.filter((c) => c.leads >= 10 && c.conversoes === 0).forEach((c) => insights.push({ tone: 'info', txt: `“${c.nome}” gera leads mas nenhuma revenda ainda — revise a qualificação (público fora da área disponível?).` }))
    porPlat.forEach((x) => { if (x.orc > x.planejado * 1.05) insights.push({ tone: 'warn', txt: `Orçamento ativo em ${PLAT[x.p]} (${money(x.orc)}) acima do planejado (${money(x.planejado)}/mês).` }) })
    return { crs, tot, ranking, porPlat, campanhas, insights }
  }, [db, plat, soAtivos])

  const m = metricasCriativo(d.tot)
  const rankPos = new Map(d.ranking.map((r, i) => [r.c.id, i + 1]))

  return (
    <>
      <PageHead
        eyebrow="Crescimento"
        title="Tráfego & criativos"
        desc={<>Campanhas ativas na Meta e no Google, criativos e performance para saber o que mais está funcionando. Investimento planejado: <b>{money(db.config.investimentoMidiaMensal)}/mês</b> ({pct(db.config.divisaoMeta)} Meta · {pct(1 - db.config.divisaoMeta)} Google).</>}
        actions={<>
          <button className="btn" onClick={() => exportCSV('criativos.csv', db.criativos.map((c) => { const x = metricasCriativo(c); return { Campanha: camp(c.campanhaId)?.nome, Plataforma: PLAT[camp(c.campanhaId)?.plataforma || 'meta'], Criativo: c.nome, Formato: FORMATO[c.formato], Ativo: c.ativo ? 'Sim' : 'Não', Impressoes: c.impressoes, Cliques: c.cliques, CTR: (x.ctr * 100).toFixed(2) + '%', Leads: c.leads, Investido: c.investido, CPL: x.cpl.toFixed(2), Revendas: c.conversoes } }))}><IcDownload /> Exportar</button>
          <button className="btn" onClick={() => setEditC({ id: newId('cp'), nome: '', plataforma: 'meta', objetivo: 'Cadastro de leads', publico: '', status: 'ativa', inicio: new Date().toISOString().slice(0, 10), orcamentoMensal: 0 })}><IcPlus /> Campanha</button>
          <button className="btn primary" onClick={() => setEditCr({ id: newId('cr'), campanhaId: db.campanhas.find((c) => c.status === 'ativa')?.id || '', nome: '', formato: 'imagem', headline: '', copy: '', impressoes: 0, cliques: 0, leads: 0, conversoes: 0, investido: 0, ativo: true })}><IcPlus /> Criativo</button>
        </>}
      />

      <div className="grid g-2">
        {d.porPlat.map((x) => (
          <Card key={x.p} title={PLAT[x.p]} sub="campanhas ativas · acumulado" right={<Badge tone={x.p === 'meta' ? 'gold' : 'info'} plain>{pct(x.p === 'meta' ? db.config.divisaoMeta : 1 - db.config.divisaoMeta)} da verba</Badge>}>
            <div className="grid g-4" style={{ gap: 10 }}>
              <div><div className="small muted">Investido</div><b style={{ fontSize: 18 }}>{money(x.investido)}</b></div>
              <div><div className="small muted">Leads</div><b style={{ fontSize: 18 }}>{int(x.leads)}</b></div>
              <div><div className="small muted">CPL</div><b style={{ fontSize: 18 }}>{money2(safeDiv(x.investido, x.leads))}</b></div>
              <div><div className="small muted">Revendas</div><b style={{ fontSize: 18 }}>{int(x.conversoes)}</b></div>
            </div>
            <div className="small" style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0 4px' }}><span>Orçamento mensal ativo <b>{money(x.orc)}</b></span><span className="muted">planejado {money(x.planejado)}</span></div>
            <Meter value={safeDiv(x.orc, x.planejado)} target={1} tone={x.orc > x.planejado * 1.05 ? 'bad' : 'good'} />
          </Card>
        ))}
      </div>

      <div className="toolbar mt-lg">
        <Segmented value={plat} onChange={setPlat} options={[{ value: 'todas', label: 'Todas' }, { value: 'meta', label: 'Meta Ads' }, { value: 'google', label: 'Google Ads' }]} />
        <label className="check"><input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} /> Somente campanhas e criativos ativos</label>
      </div>

      <div className="grid g-5">
        <Kpi label="Impressões" value={short(d.tot.impressoes)} foot={`${int(d.tot.cliques)} cliques`} />
        <Kpi label="CTR" value={pct(m.ctr, 2)} foot={`CPC ${money2(m.cpc)}`} />
        <Kpi label="Leads" value={int(d.tot.leads)} foot={`${pct(m.taxaLead, 1)} dos cliques`} />
        <Kpi label="Custo por lead" value={money2(m.cpl)} foot={`${money(d.tot.investido)} investidos`} />
        <Kpi label="Custo por revenda" value={d.tot.conversoes ? money(m.cac) : '—'} foot={`${d.tot.conversoes} novas revendas`} />
      </div>

      <div className="grid g-2-1 mt">
        <Card title="Ranking de criativos" sub="menor custo por lead primeiro">
          <HBars rows={d.ranking.map((r, i) => ({ key: r.c.id, label: `${i + 1}. ${r.c.nome}`, value: r.m.cpl }))} fmt={money2} color={colors.s1} />
          <p className="small muted" style={{ marginBottom: 0 }}>Barra menor = criativo mais eficiente.</p>
        </Card>
        <Card title={<><IcSparkle width={15} style={{ verticalAlign: -2 }} /> Leituras automáticas</>}>
          <div className="list" style={{ gap: 8 }}>
            {d.insights.map((i, k) => <div key={k} className={`alert ${i.tone}`}><span className="ico">{i.tone === 'good' ? '✓' : i.tone === 'bad' ? '!' : i.tone === 'warn' ? '△' : 'i'}</span><span>{i.txt}</span></div>)}
            {!d.insights.length && <div className="empty">Sem alertas.</div>}
          </div>
        </Card>
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 26, margin: '28px 0 12px' }}>Criativos</h3>
      <div className="grid g-3">
        {d.crs.map((c) => {
          const x = metricasCriativo(c)
          const cp = camp(c.campanhaId)
          return (
            <div key={c.id} className="creative" style={{ cursor: 'pointer' }} onClick={() => setEditCr(c)}>
              <div className="creative-thumb">
                <span className="fmt">{FORMATO[c.formato]}</span>
                {rankPos.get(c.id) && rankPos.get(c.id)! <= 3 && <span className="rank">Top {rankPos.get(c.id)}</span>}
                <span className="hl">{c.headline || c.nome}</span>
              </div>
              <div className="creative-body">
                <div>
                  <div className="strong">{c.nome}</div>
                  <div className="small muted">{cp ? `${PLAT[cp.plataforma]} · ${cp.nome}` : '—'}</div>
                </div>
                <div className="small" style={{ color: 'var(--ink-2)' }}>{c.copy}</div>
                <div className="creative-stats">
                  <div><b>{pct(x.ctr, 2)}</b><span>CTR</span></div>
                  <div><b>{int(c.leads)}</b><span>Leads</span></div>
                  <div><b>{c.leads ? money2(x.cpl) : '—'}</b><span>CPL</span></div>
                  <div><b>{c.conversoes}</b><span>Revendas</span></div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {c.ativo ? <Badge tone="good">Ativo</Badge> : <Badge>Pausado</Badge>}
                  <span className="small muted" style={{ marginLeft: 'auto' }}>{money(c.investido)} investidos</span>
                  {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="small" onClick={(e) => e.stopPropagation()}>ver ↗</a>}
                </div>
              </div>
            </div>
          )
        })}
        {!d.crs.length && <div className="empty">Nenhum criativo com esse filtro.</div>}
      </div>

      <Card title="Campanhas" className="mt-lg">
        <DataTable rows={d.campanhas} onRowClick={setEditC} columns={[
          { key: 'nome', label: 'Campanha', value: (c) => c.nome, render: (c) => <><div className="strong">{c.nome}</div><div className="small muted">{c.objetivo} · {c.publico}</div></> },
          { key: 'plat', label: 'Plataforma', value: (c) => c.plataforma, render: (c) => PLAT[c.plataforma] },
          { key: 'status', label: 'Status', value: (c) => c.status, render: (c) => <Badge tone={c.status === 'ativa' ? 'good' : c.status === 'pausada' ? 'warn' : undefined}>{STATUS_CAMPANHA[c.status]}</Badge> },
          { key: 'inicio', label: 'Início', value: (c) => c.inicio, render: (c) => date(c.inicio) },
          { key: 'orc', label: 'Orçamento/mês', num: true, value: (c) => c.orcamentoMensal, render: (c) => money(c.orcamentoMensal) },
          { key: 'inv', label: 'Investido', num: true, value: (c) => c.t.investido, render: (c) => money(c.t.investido) },
          { key: 'leads', label: 'Leads', num: true, value: (c) => c.t.leads },
          { key: 'cpl', label: 'CPL', num: true, value: (c) => safeDiv(c.t.investido, c.t.leads), render: (c) => money2(safeDiv(c.t.investido, c.t.leads)) },
          { key: 'conv', label: 'Revendas', num: true, value: (c) => c.t.conversoes },
        ]} />
      </Card>

      <Card title="Como manter os números atualizados" className="mt">
        <StatRow label="Meta Ads" value="Gerenciador de Anúncios → exportar por anúncio (impressões, cliques no link, leads, valor usado) → atualizar cada criativo" />
        <StatRow label="Google Ads" value="Relatório por anúncio/grupo → impressões, cliques, conversões, custo" />
        <StatRow label="RD Station" value="Leads → exportar CSV → Leads › Importar do RD Station" />
        <StatRow label="Revendas" value="Ao marcar um lead como “Virou revenda”, some +1 em Revendas no criativo de origem" />
      </Card>

      {editC && (
        <FormModal title="Campanha" initial={editC} onClose={() => setEditC(null)}
          onSave={(v) => { upsert('campanhas', v); setEditC(null) }}
          onDelete={db.campanhas.some((c) => c.id === editC.id) ? () => { remove('campanhas', editC.id); setEditC(null) } : undefined}
          fields={[
            { name: 'nome', label: 'Nome', required: true, full: true },
            { name: 'plataforma', label: 'Plataforma', type: 'select', required: true, options: opts(PLAT) },
            { name: 'status', label: 'Status', type: 'select', required: true, options: opts(STATUS_CAMPANHA) },
            { name: 'objetivo', label: 'Objetivo' },
            { name: 'orcamentoMensal', label: 'Orçamento mensal (R$)', type: 'number' },
            { name: 'inicio', label: 'Início', type: 'date' },
            { name: 'fim', label: 'Fim', type: 'date' },
            { name: 'publico', label: 'Público / segmentação', type: 'textarea' },
          ]} />
      )}
      {editCr && (
        <FormModal title="Criativo" initial={editCr} onClose={() => setEditCr(null)}
          onSave={(v) => { upsert('criativos', v); setEditCr(null) }}
          onDelete={db.criativos.some((c) => c.id === editCr.id) ? () => { remove('criativos', editCr.id); setEditCr(null) } : undefined}
          fields={[
            { name: 'nome', label: 'Nome do criativo', required: true },
            { name: 'campanhaId', label: 'Campanha', type: 'select', required: true, options: db.campanhas.map((c) => ({ value: c.id, label: `${PLAT[c.plataforma]} — ${c.nome}` })) },
            { name: 'formato', label: 'Formato', type: 'select', options: opts(FORMATO) },
            { name: 'ativo', label: 'Status', type: 'checkbox', placeholder: 'Criativo ativo' },
            { name: 'headline', label: 'Headline / título', full: true },
            { name: 'copy', label: 'Texto do anúncio', type: 'textarea' },
            { name: 'link', label: 'Link do criativo (Drive, biblioteca de anúncios…)', type: 'url', full: true },
            { name: 'impressoes', label: 'Impressões', type: 'number' },
            { name: 'cliques', label: 'Cliques', type: 'number' },
            { name: 'leads', label: 'Leads', type: 'number' },
            { name: 'investido', label: 'Investido (R$)', type: 'number' },
            { name: 'conversoes', label: 'Leads que viraram revenda', type: 'number' },
          ]} />
      )}
    </>
  )
}

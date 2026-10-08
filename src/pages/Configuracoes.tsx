import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CONFIG } from '../data/seed'
import { useStore } from '../data/store'
import type { Configuracoes as Cfg, Database } from '../data/types'
import { Card, ConfirmButton, PageHead, StatRow } from '../components/ui'
import { download, exportCSV } from '../lib/csv'
import { today } from '../lib/dates'
import { int, money, pct } from '../lib/format'
import { AREA_SHOWROOM, macroRegiao } from '../data/labels'
import { metasParaTexto, textoParaMetas } from '../lib/metrics'
import { IcDownload, IcUpload } from '../components/Icons'

const CAMPOS: { k: keyof Cfg; label: string; type: 'text' | 'number'; step?: string; help?: string }[] = [
  { k: 'nomeUnidade', label: 'Nome da unidade', type: 'text' },
  { k: 'colecaoAtual', label: 'Coleção atual', type: 'text' },
  { k: 'metaFaturamentoMensal', label: 'Meta de faturamento mensal do showroom (R$)', type: 'number' },
  { k: 'metaAtivacao', label: 'Meta de ativação da base (0 a 1)', type: 'number', step: '0.01', help: '0,70 = 70% das revendas comprando no período' },
  { k: 'investimentoMidiaMensal', label: 'Investimento mensal em mídia (R$)', type: 'number' },
  { k: 'divisaoMeta', label: 'Fração da verba na Meta (0 a 1)', type: 'number', step: '0.05', help: 'O restante vai para o Google Ads' },
  { k: 'diasInatividadeAlerta', label: 'Alerta de revenda sem compra (dias)', type: 'number' },
  { k: 'raioExclusividadeKm', label: 'Raio de exclusividade (km)', type: 'number' },
  { k: 'diasSemCompraQueda', label: 'Dias sem compra para a revenda cair', type: 'number', help: 'A revenda aparece em “Vai cair” 90 dias antes e perde a exclusividade nesta data' },
  { k: 'raioCapitalCheioKm', label: 'SP capital — raio cheio (km)', type: 'number', step: '0.1', help: 'Raio de quem está começando e de quem compra acima do limite superior' },
  { k: 'raioCapitalMedioKm', label: 'SP capital — raio intermediário (km)', type: 'number', step: '0.1' },
  { k: 'raioCapitalMinimoKm', label: 'SP capital — raio mínimo (km)', type: 'number', step: '0.1' },
  { k: 'raioCapitalLimiteMedio', label: 'SP capital — compras para sair do raio mínimo (R$)', type: 'number', help: 'Até este valor no período: raio mínimo' },
  { k: 'raioCapitalLimiteCheio', label: 'SP capital — compras para o raio cheio (R$)', type: 'number', help: 'Acima deste valor no período: raio cheio' },
  { k: 'raioCapitalMeses', label: 'SP capital — meses fechados avaliados', type: 'number' },
]

export default function Configuracoes() {
  const { db, dbArea, dbCompleto, foraArea, modo, setConfig, replaceAll, resetDemo, clearAll } = useStore()
  // configuração real (sem o filtro global, que troca a meta pela soma das metas filtradas)
  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...dbArea.config }), [dbArea.config])
  const [form, setForm] = useState<Cfg>(cfg)
  const [msg, setMsg] = useState('')
  const [metasTexto, setMetasTexto] = useState(metasParaTexto(cfg.metasMes))
  const fileRef = useRef<HTMLInputElement>(null)

  // a configuração da base da equipe chega depois do primeiro desenho
  useEffect(() => { setForm(cfg); setMetasTexto(metasParaTexto(cfg.metasMes)) }, [cfg])

  const salvar = () => { setConfig({ ...form, metasMes: textoParaMetas(metasTexto) }); setMsg('Configurações salvas.') }
  const importar = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Database
      if (!data.clientes || !data.config) throw new Error('arquivo inválido')
      replaceAll(data)
      setForm(data.config)
      setMsg('Backup restaurado com sucesso.')
    } catch {
      setMsg('Não foi possível ler o arquivo de backup.')
    }
  }

  return (
    <>
      <PageHead eyebrow="Plataforma" title="Configurações" desc="Metas gerais, verba de mídia, regras de alerta e backup dos dados." />
      {msg && <div className="alert good" style={{ marginBottom: 16 }}><span className="ico">✓</span>{msg}</div>}
      <div className="grid g-2">
        <Card title="Metas e parâmetros">
          <div className="form-grid">
            {CAMPOS.map((c) => (
              <div key={c.k} className="field">
                <label htmlFor={c.k}>{c.label}</label>
                <input id={c.k} className="input" type={c.type} step={c.step} value={String(form[c.k] ?? '')}
                  onChange={(e) => setForm({ ...form, [c.k]: c.type === 'number' ? Number(e.target.value) : e.target.value })} />
                {c.help && <span className="small muted">{c.help}</span>}
              </div>
            ))}
            <div className="field full">
              <label htmlFor="metasMes">Meta do showroom em meses específicos</label>
              <textarea id="metasMes" className="input" rows={3} placeholder={'09/2026: 2650000'} value={metasTexto} onChange={(e) => setMetasTexto(e.target.value)} />
              <span className="small muted">Uma linha por mês. Nos meses sem linha vale a meta mensal do showroom.</span>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn primary" onClick={salvar}>Salvar</button>
            <span className="small muted" style={{ alignSelf: 'center' }}>
              Verba: {money(form.investimentoMidiaMensal * form.divisaoMeta)} Meta · {money(form.investimentoMidiaMensal * (1 - form.divisaoMeta))} Google · ativação {pct(form.metaAtivacao)}
            </span>
          </div>
          <p className="small muted">As metas individuais de cada vendedora e representante ficam em <b>Equipe & metas</b>.</p>
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Dados e backup">
            <p className="small" style={{ marginTop: 0 }}>
              {modo === 'equipe'
                ? 'Os dados ficam na base da equipe: todos que têm acesso a esta página veem as mesmas informações, atualizadas ao vivo. Restaurar um backup grava os registros do arquivo nesta base.'
                : 'Os dados ficam salvos neste navegador. Faça backup periódico e use o arquivo para levar os dados para outro computador ou para a base da equipe.'}
            </p>
            <StatRow label="Revendas" value={int(dbCompleto.clientes.length)} />
            <StatRow label="Pedidos" value={int(dbCompleto.pedidos.length)} />
            <StatRow label="Leads" value={int(dbCompleto.leads.length)} />
            <StatRow label="Eventos" value={int(db.eventos.length)} />
            <div className="toolbar" style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => download(`maria-dolores-backup-${today()}.json`, JSON.stringify(dbCompleto, null, 2), 'application/json')}><IcDownload /> Baixar backup</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = '' }} />
              <button className="btn" onClick={() => fileRef.current?.click()}><IcUpload /> Restaurar backup</button>
            </div>
            <div className="toolbar">
              {modo !== 'equipe' && <ConfirmButton confirmLabel="Substituir os dados atuais?" onConfirm={() => { resetDemo(); setMsg('Dados de demonstração recarregados.') }}>Recarregar demonstração</ConfirmButton>}
              <ConfirmButton className="btn danger" confirmLabel="Apagar tudo? Clique de novo" onConfirm={() => { clearAll(); setMsg('Base zerada. Comece cadastrando a equipe e as revendas.') }}>Zerar base (começar do zero)</ConfirmButton>
            </div>
          </Card>
          <Card title="Área do Showroom SP">
            <p className="small" style={{ marginTop: 0 }}>
              O showroom responde pelas regiões <b>{AREA_SHOWROOM.join(' e ')}</b>. Revendas e leads de outras UFs continuam guardados na base,
              mas ficam fora das telas, das metas e da ativação.
            </p>
            <StatRow label="Revendas na área" value={int(dbArea.clientes.length)} />
            <StatRow label="Revendas sem UF (confirmar no cadastro)" value={int(dbArea.clientes.filter((c) => !c.uf).length)} />
            <StatRow label="Revendas fora da área" value={int(foraArea.clientes.length)} />
            <StatRow label="Faturamento dessas revendas fora da área" value={money(foraArea.faturamento)} />
            <StatRow label="Leads fora da área" value={int(foraArea.leads.length)} />
            {foraArea.clientes.length > 0 && (
              <div className="small muted" style={{ marginTop: 8 }}>
                {foraArea.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => `${c.nome} (${c.cidade ? `${c.cidade}/` : ''}${c.uf} · ${macroRegiao(c.uf)})`).join(' · ')}
              </div>
            )}
            {(foraArea.clientes.length > 0 || foraArea.leads.length > 0) && (
              <div className="toolbar" style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => exportCSV('fora-da-area.csv', [
                  ...foraArea.clientes.map((c) => ({ Tipo: 'Revenda', Nome: c.nome, Cidade: c.cidade, UF: c.uf, Regiao: macroRegiao(c.uf), Observacoes: c.observacoes || '' })),
                  ...foraArea.leads.map((l) => ({ Tipo: 'Lead', Nome: l.nome, Cidade: l.cidade, UF: l.uf, Regiao: macroRegiao(l.uf), Observacoes: l.empresa || '' })),
                ])}><IcDownload /> Exportar lista</button>
              </div>
            )}
          </Card>
          <Card title="Integrações">
            <StatRow label="RD Station" value="Importação de leads via CSV (Leads › Importar)" />
            <StatRow label="Meta Ads / Google Ads" value="Atualização dos criativos (Tráfego › Criativo)" />
            <StatRow label="Planilhas / ERP" value="Exportação CSV em todas as abas" />
            <p className="small muted" style={{ marginBottom: 0 }}>Próximo passo sugerido: sincronização automática com RD Station e plataformas de anúncio via API.</p>
          </Card>
        </div>
      </div>
    </>
  )
}

import { useRef, useState } from 'react'
import { useStore } from '../data/store'
import type { Configuracoes as Cfg, Database } from '../data/types'
import { Card, PageHead, StatRow } from '../components/ui'
import { download } from '../lib/csv'
import { today } from '../lib/dates'
import { int, money, pct } from '../lib/format'
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
]

export default function Configuracoes() {
  const { db, setConfig, replaceAll, resetDemo, clearAll } = useStore()
  const [form, setForm] = useState<Cfg>(db.config)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const salvar = () => { setConfig(form); setMsg('Configurações salvas.') }
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
            <p className="small" style={{ marginTop: 0 }}>Os dados ficam salvos neste navegador. Faça backup periódico e use o arquivo para levar os dados para outro computador.</p>
            <StatRow label="Revendas" value={int(db.clientes.length)} />
            <StatRow label="Pedidos" value={int(db.pedidos.length)} />
            <StatRow label="Leads" value={int(db.leads.length)} />
            <StatRow label="Eventos" value={int(db.eventos.length)} />
            <div className="toolbar" style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => download(`maria-dolores-backup-${today()}.json`, JSON.stringify(db, null, 2), 'application/json')}><IcDownload /> Baixar backup</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = '' }} />
              <button className="btn" onClick={() => fileRef.current?.click()}><IcUpload /> Restaurar backup</button>
            </div>
            <div className="toolbar">
              <button className="btn" onClick={() => confirm('Recarregar os dados de demonstração? Os dados atuais serão substituídos.') && (resetDemo(), setMsg('Dados de demonstração recarregados.'))}>Recarregar demonstração</button>
              <button className="btn danger" onClick={() => confirm('Apagar TODOS os dados para começar a usar com dados reais? Faça um backup antes.') && (clearAll(), setMsg('Base zerada. Comece cadastrando a equipe e as revendas.'))}>Zerar base (começar do zero)</button>
            </div>
          </Card>
          <Card title="Integrações">
            <StatRow label="RD Station" value="Importação de leads via CSV (Leads › Importar)" />
            <StatRow label="Meta Ads / Google Ads" value="Atualização dos criativos (Tráfego › Criativo)" />
            <StatRow label="Planilhas / ERP" value="Exportação CSV em todas as abas" />
            <p className="small muted" style={{ marginBottom: 0 }}>Próximo passo sugerido: conectar a um banco de dados na nuvem (ex.: Supabase) para uso simultâneo pela equipe e sincronização automática com RD Station e plataformas de anúncio via API.</p>
          </Card>
        </div>
      </div>
    </>
  )
}

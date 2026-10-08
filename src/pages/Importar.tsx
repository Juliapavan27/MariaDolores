import { useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import type { Database } from '../data/types'
import { Badge, Card, PageHead, StatRow } from '../components/ui'
import { TIPOS, criarIndices, lerArquivo, mapearColunas, modeloCSV, type TipoImportacao } from '../lib/importar'
import { download } from '../lib/csv'
import { int } from '../lib/format'
import { IcDownload, IcUpload } from '../components/Icons'

const ORDEM = ['equipe', 'revendas', 'pedidos', 'titulos', 'devolucoes', 'leads']

export default function Importar() {
  const { dbCompleto: db, modo, bulkUpsert, progresso } = useStore()
  const [tipo, setTipo] = useState<TipoImportacao | null>(null)
  const [arquivo, setArquivo] = useState('')
  const [linhas, setLinhas] = useState<Record<string, string>[]>([])
  const [mapa, setMapa] = useState<Record<string, string>>({})
  const [erroArquivo, setErroArquivo] = useState('')
  const [lendo, setLendo] = useState(false)
  const [feito, setFeito] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const colunas = useMemo(() => Array.from(new Set(linhas.flatMap((l) => Object.keys(l)))).filter(Boolean), [linhas])

  const resultado = useMemo(() => {
    if (!tipo || !linhas.length) return null
    const ix = criarIndices(db)
    const itens = new Map<string, { id: string }>()
    const erros: { linha: number; motivo: string }[] = []
    linhas.forEach((l, i) => {
      const valores = Object.fromEntries(tipo.campos.map((c) => [c.chave, (mapa[c.chave] ? l[mapa[c.chave]] : '') ?? '']))
      const r = tipo.montar(valores, ix, db)
      if ('erro' in r) erros.push({ linha: i + 2, motivo: r.erro })
      else itens.set(r.item.id, r.item)
    })
    const lista = Array.from(itens.values())
    const existentes = new Set((db[tipo.colecao] as unknown as { id: string }[]).map((x) => x.id))
    return { lista, erros, novos: lista.filter((x) => !existentes.has(x.id)).length, atualizados: lista.filter((x) => existentes.has(x.id)).length }
  }, [tipo, linhas, mapa, db])

  const faltando = tipo ? tipo.campos.filter((c) => c.obrigatorio && !mapa[c.chave]) : []

  const escolher = (t: TipoImportacao) => {
    setTipo(t); setLinhas([]); setArquivo(''); setMapa({}); setErroArquivo(''); setFeito('')
  }

  const abrir = async (f: File) => {
    if (!tipo) return
    setLendo(true); setErroArquivo(''); setFeito('')
    try {
      const rows = (await lerArquivo(f)).filter((r) => Object.values(r).some((v) => String(v).trim()))
      if (!rows.length) throw new Error('A planilha está vazia ou a primeira linha não tem os nomes das colunas.')
      setLinhas(rows)
      setArquivo(f.name)
      setMapa(mapearColunas(tipo, Object.keys(rows[0])))
    } catch (e) {
      setErroArquivo((e as Error).message || 'Não foi possível ler o arquivo.')
      setLinhas([])
    } finally {
      setLendo(false)
    }
  }

  const importar = () => {
    if (!tipo || !resultado?.lista.length) return
    bulkUpsert(tipo.colecao, resultado.lista as unknown as Database[typeof tipo.colecao])
    setFeito(`${int(resultado.lista.length)} registros de ${tipo.titulo.toLowerCase()} enviados${modo === 'equipe' ? ' para a base da equipe' : ''}.`)
    setLinhas([]); setArquivo('')
  }

  const tipos = ORDEM.map((k) => TIPOS.find((t) => t.chave === k)!)

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        title="Importar dados"
        desc="Traga os dados do sistema B2B a partir de planilhas exportadas (CSV ou Excel). Importar de novo o mesmo arquivo atualiza os registros pelo código, sem duplicar."
      />

      {modo === 'vitrine' && (
        <div className="alert warn" style={{ marginBottom: 20 }}>
          <span>A base da equipe ainda não foi iniciada: o que você importar agora fica só neste navegador, junto com a demonstração. Para importar os dados reais, clique antes em <b>Iniciar base da equipe</b> no aviso do topo.</span>
        </div>
      )}

      <div className="grid g-3">
        {tipos.map((t, i) => {
          const qtd = (db[t.colecao] as unknown[]).length
          return (
            <button key={t.chave} type="button" className="card import-tipo" aria-pressed={tipo?.chave === t.chave} onClick={() => escolher(t)}>
              <span className="passo">{i + 1}</span>
              <span className="t">{t.titulo}</span>
              <span className="small muted">{t.descricao}</span>
              <span className="small">{int(qtd)} na base hoje</span>
            </button>
          )
        })}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Siga a ordem dos números: pedidos, títulos e devoluções são ligados às revendas, e as revendas às pessoas da equipe.</p>

      {tipo && (
        <Card className="mt-lg" title={`Importar ${tipo.titulo.toLowerCase()}`} right={<button className="btn sm" onClick={() => download(`modelo-${tipo.chave}.csv`, modeloCSV(tipo))}><IcDownload /> Baixar planilha-modelo</button>}>
          <div className="toolbar">
            <input ref={fileRef} id="arquivo-importacao" type="file" accept=".csv,.xlsx,.xls,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) abrir(f); e.target.value = '' }} />
            <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={lendo}><IcUpload /> {lendo ? 'Lendo arquivo…' : arquivo ? 'Trocar arquivo' : 'Escolher arquivo'}</button>
            {arquivo && <span className="small">{arquivo} · {int(linhas.length)} linhas</span>}
          </div>
          {erroArquivo && <div className="alert bad" style={{ marginBottom: 16 }}><span>{erroArquivo}</span></div>}
          {feito && <div className="alert good" style={{ marginBottom: 16 }}><span>{feito} {progresso ? 'Gravando…' : ''}</span></div>}

          {!!linhas.length && (
            <div className="grid g-2" style={{ alignItems: 'start' }}>
              <div>
                <h4 className="sub-titulo">Colunas da planilha</h4>
                <p className="small muted" style={{ marginTop: 0 }}>Ligamos automaticamente o que reconhecemos. Ajuste o que estiver errado.</p>
                <div className="mapa">
                  {tipo.campos.map((c) => (
                    <div key={c.chave} className="mapa-linha">
                      <label htmlFor={`map-${c.chave}`}>{c.rotulo}{c.obrigatorio && <span className="obrig"> *</span>}{c.dica && <span className="small muted"> — {c.dica}</span>}</label>
                      <select id={`map-${c.chave}`} className="input" value={mapa[c.chave] || ''} onChange={(e) => setMapa({ ...mapa, [c.chave]: e.target.value })}>
                        <option value="">— não importar —</option>
                        {colunas.map((col) => <option key={col} value={col}>{col}</option>)}
                      </select>
                      <span className="small muted exemplo">{mapa[c.chave] ? linhas[0][mapa[c.chave]] || '(vazio)' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="sub-titulo">Prévia</h4>
                {faltando.length > 0 ? (
                  <div className="alert warn"><span>Escolha a coluna de: {faltando.map((f) => f.rotulo).join(', ')}.</span></div>
                ) : resultado && (
                  <>
                    <StatRow label="Prontos para importar" value={<b>{int(resultado.lista.length)}</b>} />
                    <StatRow label="Novos" value={int(resultado.novos)} />
                    <StatRow label="Atualizam registros existentes" value={int(resultado.atualizados)} />
                    <StatRow label="Linhas com problema (serão ignoradas)" value={resultado.erros.length ? <Badge tone="bad">{int(resultado.erros.length)}</Badge> : <Badge tone="good">nenhuma</Badge>} />
                    {resultado.erros.length > 0 && (
                      <div className="erros">
                        {resultado.erros.slice(0, 8).map((e) => <div key={e.linha} className="small">Linha {e.linha}: {e.motivo}</div>)}
                        {resultado.erros.length > 8 && <div className="small muted">e mais {int(resultado.erros.length - 8)}…</div>}
                      </div>
                    )}
                    {resultado.lista.length > 0 && (
                      <div className="small muted" style={{ margin: '14px 0' }}>
                        Exemplos: {resultado.lista.slice(0, 3).map((x) => tipo.resumo(x, db).filter(Boolean).join(' · ')).join('  |  ')}
                      </div>
                    )}
                    <button className="btn primary" disabled={!resultado.lista.length || !!progresso} onClick={importar}>
                      Importar {int(resultado.lista.length)} registros
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-lg" title="Como exportar do sistema B2B">
        <StatRow label="1. Formato" value="Exporte cada relatório em Excel (.xlsx) ou CSV, com os nomes das colunas na primeira linha." />
        <StatRow label="2. Datas e valores" value="Pode manter o formato brasileiro (25/03/2026, R$ 1.234,56)." />
        <StatRow label="3. Revenda nos pedidos" value="Use o mesmo código do cliente ou o CNPJ que veio na planilha de revendas." />
        <StatRow label="4. Vendedora" value="O nome ou e-mail precisa estar igual ao cadastro da Equipe." />
        <StatRow label="5. Atualizar" value="Repita a importação sempre que quiser: registros com o mesmo código são atualizados." />
      </Card>
    </>
  )
}

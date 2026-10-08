import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import type { Cliente } from '../data/types'
import { Badge, Card, DataTable, FormModal, StatRow } from './ui'
import { janelaRaio, lerLocalizacao, raiosCapital, regraRaio, verificarPonto, type Ponto, type RaioRevenda } from '../lib/raio'
import { km, money } from '../lib/format'
import { equipeFiltrada, passaCliente } from '../lib/filtros'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`

const FAIXA: Record<RaioRevenda['faixa'], { tone: 'good' | 'warn' | 'bad'; label: string }> = {
  cheio: { tone: 'good', label: 'Raio cheio' },
  medio: { tone: 'warn', label: 'Raio intermediário' },
  minimo: { tone: 'bad', label: 'Raio mínimo' },
}

/** Exclusividade em SP capital: raio por endereço, revisto pelas compras dos últimos meses fechados. */
export function RaioCapital() {
  const { db, dbArea, filtros, upsert } = useStore()
  const [texto, setTexto] = useState('')
  const [editar, setEditar] = useState<Cliente | null>(null)
  const regra = regraRaio(db.config)
  const janela = janelaRaio(regra)
  // todas as revendas da área contam para o raio; o filtro só escolhe quem aparece na tabela
  const raios = useMemo(() => raiosCapital(dbArea), [dbArea])
  const visiveis = useMemo(() => {
    const equipe = equipeFiltrada(dbArea, filtros)
    return raios.filter((r) => passaCliente(r.cliente, filtros, equipe))
  }, [raios, dbArea, filtros])
  const ponto = lerLocalizacao(texto)
  const resultado = ponto ? verificarPonto(raios, ponto) : null
  const semLocal = raios.filter((r) => !r.ponto)
  const conta = (f: RaioRevenda['faixa']) => raios.filter((r) => r.faixa === f).length

  return (
    <Card className="mt" title="São Paulo capital — raio de atuação" sub={`compras de ${mesAno(janela.inicio)} a ${mesAno(janela.fim)}`}>
      <p className="small" style={{ marginTop: 0 }}>
        Na capital, cada revenda protege um raio em volta do endereço da loja: nenhuma revenda nova abre dentro dele.
        Toda revenda começa com <b>{km(regra.cheio)}</b>. Depois de {regra.meses} meses fechados, o raio passa a depender das compras desse período:
        até {money(regra.limiteMedio)} → <b>{km(regra.minimo)}</b> · de {money(regra.limiteMedio)} a {money(regra.limiteCheio)} → <b>{km(regra.medio)}</b> ·
        acima de {money(regra.limiteCheio)} → <b>{km(regra.cheio)}</b>.
      </p>

      <div className="grid g-2">
        <div>
          <h4 style={{ margin: '0 0 6px', fontSize: 13 }}>Posso abrir uma revenda neste endereço?</h4>
          <input className="input" style={{ width: '100%' }} placeholder="Cole o link do Google Maps ou as coordenadas (ex.: -23.5874, -46.6576)"
            value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Localização para verificar" />
          {texto && !ponto && <div className="alert warn" style={{ marginTop: 10 }}>Localização não reconhecida. No Google Maps, clique com o botão direito no endereço e copie as coordenadas que aparecem no topo do menu.</div>}
          {resultado && (
            <div style={{ marginTop: 12 }}>
              {raios.length > 0 && resultado.semLocalizacao === raios.length ? (
                <div className="alert warn"><div>
                  <b>Ainda não dá para verificar.</b> Nenhuma revenda da capital tem localização cadastrada. Cadastre na tabela abaixo para o verificador funcionar.
                </div></div>
              ) : resultado.conflitos.length ? (
                <div className="alert bad"><div>
                  <b>Não pode abrir.</b> O endereço está dentro do raio de {resultado.conflitos.length === 1 ? 'uma revenda' : `${resultado.conflitos.length} revendas`}:
                  {resultado.conflitos.map((c) => (
                    <div key={c.raio.cliente.id} className="small">{c.raio.cliente.nome} — a {km(c.distanciaKm)} · raio de {km(c.raio.raioKm)}</div>
                  ))}
                </div></div>
              ) : (
                <div className="alert good"><div>
                  <b>Livre.</b> Nenhuma revenda da capital com localização cadastrada cobre este endereço.
                  {resultado.proximas.map((c) => (
                    <div key={c.raio.cliente.id} className="small">Mais próxima: {c.raio.cliente.nome} — a {km(c.distanciaKm)} (raio de {km(c.raio.raioKm)})</div>
                  ))}
                </div></div>
              )}
              {resultado.semLocalizacao > 0 && resultado.semLocalizacao < raios.length && (
                <div className="alert warn" style={{ marginTop: 8 }}>
                  {resultado.semLocalizacao} revenda(s) da capital ainda estão sem localização e não entram nesta verificação. Cadastre a localização delas na tabela abaixo.
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <StatRow label="Revendas vigentes na capital" value={raios.length} />
            <StatRow label={`Raio cheio (${km(regra.cheio)})`} value={conta('cheio')} />
            <StatRow label={`Raio intermediário (${km(regra.medio)})`} value={conta('medio')} />
            <StatRow label={`Raio mínimo (${km(regra.minimo)})`} value={conta('minimo')} />
            <StatRow label="Sem localização cadastrada" value={semLocal.length ? <Badge tone="warn">{semLocal.length}</Badge> : 0} />
          </div>
        </div>
        <MapaRaios raios={raios} ponto={ponto} bloqueado={!!resultado?.conflitos.length} />
      </div>

      <h4 style={{ margin: '18px 0 6px', fontSize: 13 }}>Revendas da capital</h4>
      <DataTable rows={visiveis.map((r) => ({ ...r, id: r.cliente.id }))} onRowClick={(r) => setEditar(r.cliente)} initialSort={{ key: 'compras', dir: 1 }} columns={[
        { key: 'nome', label: 'Revenda', value: (r) => r.cliente.nome, render: (r) => <><div className="strong">{r.cliente.nome}</div><div className="small muted">{r.cliente.endereco || r.cliente.cidade}</div></> },
        { key: 'compras', label: `Compras ${mesAno(janela.inicio)}–${mesAno(janela.fim)}`, num: true, value: (r) => r.compras, render: (r) => money(r.compras) },
        { key: 'raio', label: 'Raio', num: true, value: (r) => r.raioKm, render: (r) => km(r.raioKm) },
        { key: 'faixa', label: 'Situação', value: (r) => r.faixa, render: (r) => r.implantacao ? <Badge tone="info">Início — raio cheio</Badge> : <Badge tone={FAIXA[r.faixa].tone}>{FAIXA[r.faixa].label}</Badge> },
        { key: 'falta', label: 'Para subir de faixa', value: (r) => r.faltaProxima, render: (r) => r.proximoRaioKm && !r.implantacao ? <span className="small">passar de {money(r.compras + r.faltaProxima)} (faltam {money(r.faltaProxima)}) → {km(r.proximoRaioKm)}</span> : <span className="small muted">—</span> },
        { key: 'local', label: 'Localização', value: (r) => (r.ponto ? 1 : 0), render: (r) => r.ponto ? <span className="small muted">ok</span> : <Badge tone="warn">Cadastrar</Badge> },
      ]} empty="Nenhuma revenda vigente em São Paulo capital." />
      <p className="small muted" style={{ marginBottom: 0 }}>
        Compras = pedidos faturados nos meses fechados (o mês corrente entra na revisão do mês que vem). Clique numa revenda para cadastrar o endereço e a localização.
      </p>

      {editar && (
        <FormModal title={`Localização — ${editar.nome}`} initial={editar} onClose={() => setEditar(null)}
          onSave={(v) => { upsert('clientes', { ...editar, endereco: v.endereco, localizacao: v.localizacao }); setEditar(null) }}
          fields={[
            { name: 'endereco', label: 'Endereço da loja', full: true },
            { name: 'localizacao', label: 'Localização (Google Maps)', full: true, placeholder: '-23.5874, -46.6576', help: 'Cole o link do Google Maps ou as coordenadas. O raio é medido a partir deste ponto.' },
          ]} />
      )}
    </Card>
  )
}

/** Mapa esquemático em escala: cada círculo é o raio de uma revenda. */
function MapaRaios({ raios, ponto, bloqueado }: { raios: RaioRevenda[]; ponto: Ponto | null; bloqueado: boolean }) {
  const comPonto = raios.filter((r) => r.ponto)
  if (!comPonto.length) {
    return <div className="empty" style={{ alignSelf: 'center' }}>O mapa aparece quando as revendas da capital tiverem localização cadastrada.</div>
  }
  const pts = comPonto.map((r) => r.ponto!).concat(ponto ? [ponto] : [])
  const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180)
  const ky = 110.57
  const xy = (p: Ponto) => ({ x: p.lng * kx, y: -p.lat * ky })
  const margem = Math.max(...comPonto.map((r) => r.raioKm)) + 0.5
  const xs = pts.map((p) => xy(p).x)
  const ys = pts.map((p) => xy(p).y)
  const minX = Math.min(...xs) - margem
  const minY = Math.min(...ys) - margem
  const w = Math.max(...xs) + margem - minX
  const h = Math.max(...ys) + margem - minY
  const W = 560
  const H = Math.max(260, Math.min(420, (W * h) / w))
  const esc = Math.min(W / w, H / h)
  const tela = (p: Ponto) => ({ x: (xy(p).x - minX) * esc, y: (xy(p).y - minY) * esc })
  const cor = { cheio: 'var(--good)', medio: 'var(--warn)', minimo: 'var(--bad)' }
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'var(--surface-2, var(--bg))', borderRadius: 6 }} role="img" aria-label="Mapa dos raios de atuação na capital">
        {comPonto.map((r) => {
          const c = tela(r.ponto!)
          return (
            <g key={r.cliente.id}>
              <title>{`${r.cliente.nome} — raio de ${km(r.raioKm)}`}</title>
              <circle cx={c.x} cy={c.y} r={r.raioKm * esc} style={{ fill: cor[r.faixa], fillOpacity: 0.12, stroke: cor[r.faixa], strokeOpacity: 0.7 }} />
              <circle cx={c.x} cy={c.y} r={3} style={{ fill: 'var(--gold)' }} />
            </g>
          )
        })}
        {ponto && (() => {
          const c = tela(ponto)
          return (
            <g>
              <title>Endereço verificado</title>
              <circle cx={c.x} cy={c.y} r={7} style={{ fill: 'none', stroke: bloqueado ? 'var(--bad)' : 'var(--good)', strokeWidth: 2.5 }} />
              <circle cx={c.x} cy={c.y} r={2.5} style={{ fill: bloqueado ? 'var(--bad)' : 'var(--good)' }} />
            </g>
          )
        })()}
        <g transform={`translate(12 ${H - 14})`}>
          <line x1={0} x2={esc} y1={0} y2={0} style={{ stroke: 'var(--ink-2)', strokeWidth: 1.5 }} />
          <text x={esc + 6} y={4} style={{ fill: 'var(--ink-2)', fontSize: 11 }}>1 km</text>
        </g>
      </svg>
      <figcaption className="legend small" style={{ marginTop: 6 }}>
        <span><i style={{ background: 'var(--good)' }} />Raio cheio</span>
        <span><i style={{ background: 'var(--warn)' }} />Intermediário</span>
        <span><i style={{ background: 'var(--bad)' }} />Mínimo</span>
        <span><i style={{ background: 'var(--gold)' }} />Loja</span>
      </figcaption>
    </figure>
  )
}

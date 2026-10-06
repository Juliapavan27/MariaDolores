import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import type { Cliente } from '../data/types'
import { Badge, DataTable, FormModal, Modal, StatRow, Tabs, opts, type Field, Person } from './ui'
import { AtendimentoForm, RESULTADO_ATENDIMENTO, TIPO_ATENDIMENTO, novoAtendimento } from './AtendimentoForm'
import type { Atendimento } from '../data/types'
import { CANAL, REGIOES, STATUS_CLIENTE, STATUS_DEVOLUCAO, STATUS_PEDIDO, STATUS_RECLAMACAO, TIPO_CLIENTE, UFS } from '../data/labels'
import { curvaABC, faturamento12m, pedidosValidos, saldo, statusTitulo, ultimaCompraMap } from '../lib/metrics'
import { date, money, int, safeDiv } from '../lib/format'
import { diffDays, today } from '../lib/dates'

export function clienteFields(db: ReturnType<typeof useStore>['db']): Field[] {
  return [
    { name: 'nome', label: 'Nome da revenda / loja', required: true },
    { name: 'responsavelNome', label: 'Pessoa de contato' },
    { name: 'tipo', label: 'Tipo', type: 'select', options: opts(TIPO_CLIENTE), required: true },
    { name: 'documento', label: 'CNPJ / CPF' },
    { name: 'cidade', label: 'Cidade (ou bairro na capital)', required: true },
    { name: 'uf', label: 'UF', type: 'select', options: UFS.map((u) => ({ value: u, label: u })), required: true },
    { name: 'regiao', label: 'Região', type: 'select', options: REGIOES.map((r) => ({ value: r, label: r })), required: true },
    { name: 'responsavelId', label: 'Atendida por', type: 'select', required: true, options: db.colaboradores.filter((c) => c.cargo !== 'analista').map((c) => ({ value: c.id, label: c.nome })), help: db.colaboradores.some((c) => c.cargo !== 'analista') ? undefined : 'Cadastre primeiro as vendedoras e representantes em Equipe & metas.' },
    { name: 'telefone', label: 'Telefone / WhatsApp', type: 'tel' },
    { name: 'email', label: 'E-mail', type: 'email' },
    { name: 'instagram', label: 'Instagram' },
    { name: 'dataCadastro', label: 'Data de cadastro', type: 'date' },
    { name: 'aniversario', label: 'Aniversário (MM-DD)', placeholder: '03-25' },
    { name: 'limiteCredito', label: 'Limite de crédito (R$)', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: opts(STATUS_CLIENTE), required: true },
    { name: 'quedaData', label: 'Data prevista de queda / encerramento', type: 'date', help: 'Preencha quando a revenda for cair: a região aparece como “vai liberar” na Expansão.' },
    { name: 'quedaMotivo', label: 'Motivo da queda', full: true },
    { name: 'publicoFinal', label: 'Ficha — público final da loja', type: 'textarea' },
    { name: 'oQueGira', label: 'Ficha — o que gira', type: 'textarea' },
    { name: 'preferencias', label: 'Ficha — preferências de atendimento', type: 'textarea' },
    { name: 'proximoPasso', label: 'Ficha — próximo passo', full: true },
    { name: 'observacoes', label: 'Observações', type: 'textarea' },
  ]
}

export const statusTone = (s: Cliente['status']) => (s === 'ativa' ? 'good' : s === 'em_queda' ? 'warn' : undefined)

type Aba = 'resumo' | 'ficha' | 'pedidos' | 'financeiro' | 'posvenda' | 'relacionamento'

export function Cliente360({ cliente: inicial, onClose, onEdit }: { cliente: Cliente; onClose: () => void; onEdit?: () => void }) {
  const { db, upsert } = useStore()
  const cliente = db.clientes.find((c) => c.id === inicial.id) || inicial
  const [aba, setAba] = useState<Aba>('resumo')
  const [editFicha, setEditFicha] = useState(false)
  const [atend, setAtend] = useState<Atendimento | null>(null)
  const d = useMemo(() => {
    const pedidos = db.pedidos.filter((p) => p.clienteId === cliente.id).sort((a, b) => b.data.localeCompare(a.data))
    const validos = pedidosValidos(pedidos)
    const titulos = db.titulos.filter((t) => t.clienteId === cliente.id).sort((a, b) => b.vencimento.localeCompare(a.vencimento))
    const devolucoes = db.devolucoes.filter((x) => x.clienteId === cliente.id)
    const reclamacoes = db.reclamacoes.filter((x) => x.clienteId === cliente.id)
    const brindes = db.movBrindes.filter((m) => m.clienteId === cliente.id)
    const eventos = db.eventos.filter((e) => e.revendasIds?.includes(cliente.id))
    const vencido = titulos.filter((t) => statusTitulo(t) === 'vencido').reduce((s, t) => s + saldo(t), 0)
    const aVencer = titulos.filter((t) => statusTitulo(t) === 'a_vencer').reduce((s, t) => s + saldo(t), 0)
    return {
      pedidos, validos, titulos, devolucoes, reclamacoes, brindes, eventos, vencido, aVencer,
      fat12: faturamento12m(db, cliente.id),
      total: validos.reduce((s, p) => s + p.valor, 0),
      ultima: ultimaCompraMap(db).get(cliente.id),
      curva: curvaABC(db).get(cliente.id) || 'C',
    }
  }, [db, cliente.id])

  return (
    <Modal
      wide
      title={<>{cliente.nome} <span className={`curva ${d.curva}`} style={{ verticalAlign: 'middle' }}>{d.curva}</span></>}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Fechar</button><button className="btn" onClick={() => setAtend(novoAtendimento(cliente.id, cliente.responsavelId))}>Registrar atendimento</button>{onEdit && <button className="btn primary" onClick={onEdit}>Editar cadastro</button>}</>}
    >
      <div className="toolbar" style={{ gap: 6 }}>
        <Badge tone={statusTone(cliente.status)}>{STATUS_CLIENTE[cliente.status]}</Badge>
        <Badge plain>{TIPO_CLIENTE[cliente.tipo]}</Badge>
        <span className="small muted">{cliente.cidade}/{cliente.uf} · {cliente.regiao}</span>
      </div>
      <Tabs value={aba} onChange={setAba} options={[
        { value: 'resumo', label: 'Resumo' },
        { value: 'ficha', label: `Ficha & atendimentos (${db.atendimentos.filter((a) => a.clienteId === cliente.id).length})` },
        { value: 'pedidos', label: `Pedidos (${d.pedidos.length})` },
        { value: 'financeiro', label: 'Financeiro' },
        { value: 'posvenda', label: `Pós-venda (${d.devolucoes.length + d.reclamacoes.length})` },
        { value: 'relacionamento', label: 'Relacionamento' },
      ]} />

      {aba === 'ficha' && (
        <div className="grid g-1-2">
          <div>
            <StatRow label="Público final" value={cliente.publicoFinal || '—'} />
            <StatRow label="O que gira" value={cliente.oQueGira || '—'} />
            <StatRow label="Preferências" value={cliente.preferencias || '—'} />
            <StatRow label="Próximo passo" value={cliente.proximoPasso || '—'} />
            <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setEditFicha(true)}>Editar ficha</button>
            <p className="small muted">Para ninguém chegar ao showroom sem ser conhecida: revise a ficha antes de cada atendimento.</p>
          </div>
          <DataTable
            rows={db.atendimentos.filter((a) => a.clienteId === cliente.id)}
            pageSize={8}
            initialSort={{ key: 'data', dir: -1 }}
            onRowClick={setAtend}
            empty="Nenhum atendimento registrado ainda."
            columns={[
              { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => date(r.data) },
              { key: 'tipo', label: 'Contato', render: (r) => <><div>{TIPO_ATENDIMENTO[r.tipo]}</div><div className="small muted">{r.resumo}</div></> },
              { key: 'res', label: 'Resultado', render: (r) => <Badge tone={r.resultado === 'pedido' ? 'good' : r.resultado === 'sem_retorno' ? 'warn' : undefined}>{RESULTADO_ATENDIMENTO[r.resultado]}</Badge> },
              { key: 'prox', label: 'Próximo contato', value: (r) => r.proximoContato || '', render: (r) => r.proximoContato ? <span style={{ color: r.proximoContato < today() ? 'var(--bad)' : undefined }}>{date(r.proximoContato)}</span> : '—' },
            ]}
          />
        </div>
      )}

      {aba === 'resumo' && (
        <div className="grid g-2">
          <div>
            <StatRow label="Contato" value={cliente.responsavelNome} />
            <StatRow label="Telefone" value={cliente.telefone} />
            <StatRow label="E-mail" value={cliente.email} />
            <StatRow label="Instagram" value={cliente.instagram} />
            <StatRow label="Documento" value={cliente.documento} />
            <StatRow label="Cliente desde" value={date(cliente.dataCadastro)} />
            <StatRow label="Atendida por" value={<Person id={cliente.responsavelId} />} />
            {cliente.quedaData && <StatRow label="Queda prevista" value={<Badge tone="warn">{date(cliente.quedaData)} — {cliente.quedaMotivo}</Badge>} />}
          </div>
          <div>
            <StatRow label="Faturamento 12 meses" value={money(d.fat12)} />
            <StatRow label="Faturamento histórico" value={money(d.total)} />
            <StatRow label="Pedidos / ticket médio" value={`${d.validos.length} · ${money(safeDiv(d.total, d.validos.length))}`} />
            <StatRow label="Última compra" value={d.ultima ? `${date(d.ultima)} (${diffDays(today(), d.ultima)} dias)` : 'nunca comprou'} />
            <StatRow label="Débito vencido" value={<span style={{ color: d.vencido ? 'var(--bad)' : undefined }}>{money(d.vencido)}</span>} />
            <StatRow label="A vencer" value={money(d.aVencer)} />
            <StatRow label="Limite de crédito" value={money(cliente.limiteCredito)} />
            <StatRow label="Devoluções aprovadas" value={money(d.devolucoes.filter((x) => x.status === 'aprovada' || x.status === 'concluida').reduce((s, x) => s + x.valor, 0))} />
          </div>
          {cliente.observacoes && <div className="alert full" style={{ gridColumn: '1/-1' }}>{cliente.observacoes}</div>}
        </div>
      )}

      {aba === 'pedidos' && (
        <DataTable rows={d.pedidos} pageSize={12} columns={[
          { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => date(r.data) },
          { key: 'colecao', label: 'Coleção', value: (r) => r.colecao },
          { key: 'canal', label: 'Canal', value: (r) => CANAL[r.canal] },
          { key: 'pecas', label: 'Peças', num: true, value: (r) => r.pecas, render: (r) => int(r.pecas) },
          { key: 'valor', label: 'Valor', num: true, value: (r) => r.valor, render: (r) => money(r.valor) },
          { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={r.status === 'faturado' ? 'good' : r.status === 'pendente' ? 'warn' : undefined}>{STATUS_PEDIDO[r.status]}</Badge> },
        ]} />
      )}

      {aba === 'financeiro' && (
        <DataTable rows={d.titulos} pageSize={12} columns={[
          { key: 'vencimento', label: 'Vencimento', value: (r) => r.vencimento, render: (r) => date(r.vencimento) },
          { key: 'forma', label: 'Forma', value: (r) => r.formaPagamento },
          { key: 'valor', label: 'Valor', num: true, value: (r) => r.valor, render: (r) => money(r.valor) },
          { key: 'saldo', label: 'Em aberto', num: true, value: (r) => saldo(r), render: (r) => money(saldo(r)) },
          { key: 'st', label: 'Situação', value: (r) => statusTitulo(r), render: (r) => {
            const s = statusTitulo(r)
            return <Badge tone={s === 'pago' ? 'good' : s === 'vencido' ? 'bad' : 'info'}>{s === 'pago' ? 'Pago' : s === 'vencido' ? `Vencido ${diffDays(today(), r.vencimento)}d` : 'A vencer'}</Badge>
          } },
        ]} />
      )}

      {aba === 'posvenda' && (
        <div className="grid">
          <h4 style={{ margin: 0 }}>Devoluções</h4>
          <DataTable rows={d.devolucoes} pageSize={6} columns={[
            { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => date(r.data) },
            { key: 'motivo', label: 'Motivo', value: (r) => r.motivo },
            { key: 'valor', label: 'Valor', num: true, value: (r) => r.valor, render: (r) => money(r.valor) },
            { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge>{STATUS_DEVOLUCAO[r.status]}</Badge> },
          ]} empty="Sem devoluções." />
          <h4 style={{ margin: 0 }}>Reclamações</h4>
          <DataTable rows={d.reclamacoes} pageSize={6} columns={[
            { key: 'data', label: 'Data', value: (r) => r.data, render: (r) => date(r.data) },
            { key: 'cat', label: 'Categoria', value: (r) => r.categoria },
            { key: 'desc', label: 'Descrição', render: (r) => <span className="small">{r.descricao}</span> },
            { key: 'status', label: 'Status', value: (r) => r.status, render: (r) => <Badge tone={r.status === 'resolvida' ? 'good' : 'warn'}>{STATUS_RECLAMACAO[r.status]}</Badge> },
          ]} empty="Sem reclamações." />
        </div>
      )}

      {aba === 'relacionamento' && (
        <div className="grid g-2">
          <div>
            <h4 style={{ marginTop: 0 }}>Eventos que participou</h4>
            {d.eventos.length ? d.eventos.map((e) => <StatRow key={e.id} label={e.titulo} value={date(e.dataInicio)} />) : <p className="muted">Nenhum evento registrado.</p>}
            <h4>Aniversário</h4>
            <p>{cliente.aniversario ? `${cliente.aniversario.split('-')[1]}/${cliente.aniversario.split('-')[0]}` : '—'} <span className="muted small">— oportunidade de mimo e contato.</span></p>
          </div>
          <div>
            <h4 style={{ marginTop: 0 }}>Brindes recebidos</h4>
            {d.brindes.length ? d.brindes.map((m) => (
              <StatRow key={m.id} label={`${db.brindes.find((b) => b.id === m.brindeId)?.nome} — ${m.motivo}`} value={`${m.quantidade} un · ${date(m.data)}`} />
            )) : <p className="muted">Nenhum brinde registrado.</p>}
          </div>
        </div>
      )}
      {editFicha && (
        <FormModal title="Ficha da revendedora" initial={cliente} onClose={() => setEditFicha(false)}
          onSave={(v) => { upsert('clientes', v); setEditFicha(false) }}
          fields={[
            { name: 'publicoFinal', label: 'Público final da loja', type: 'textarea' },
            { name: 'oQueGira', label: 'O que gira (peças e linhas que vendem bem)', type: 'textarea' },
            { name: 'preferencias', label: 'Preferências de atendimento', type: 'textarea' },
            { name: 'proximoPasso', label: 'Próximo passo', full: true },
          ]} />
      )}
      {atend && <AtendimentoForm inicial={atend} onClose={() => setAtend(null)} />}
    </Modal>
  )
}

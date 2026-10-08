import { useMemo, useState } from 'react'
import { useFoco } from '../lib/router'
import { newId, useStore } from '../data/store'
import type { Tarefa, Visita } from '../data/types'
import { Badge, Card, FormModal, PageHead, Person, Segmented, FocoAviso, pessoasAtivas, opcoesPessoas } from '../components/ui'
import { date, dayMonth } from '../lib/format'
import { addDays, diffDays, parse, today } from '../lib/dates'
import { IcPlus } from '../components/Icons'

const STATUS_VISITA: Record<Visita['status'], string> = { agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada', no_show: 'Não compareceu' }
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function Agenda() {
  const { db, upsert, remove } = useStore()
  const [editV, setEditV] = useState<Visita | null>(null)
  const [editT, setEditT] = useState<Tarefa | null>(null)
  const [quem, setQuem] = useState('')
  const [janela, setJanela] = useState<'7' | '14' | '30'>('14')
  const hoje = today()

  const visitas = useMemo(() => {
    const fim = addDays(hoje, Number(janela))
    const xs = db.visitas.filter((v) => v.data >= hoje && v.data <= fim && (!quem || v.responsavelId === quem)).sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario))
    const porDia = new Map<string, Visita[]>()
    xs.forEach((v) => porDia.set(v.data, [...(porDia.get(v.data) || []), v]))
    return Array.from(porDia.entries())
  }, [db.visitas, hoje, janela, quem])

  const { ids: foco } = useFoco()
  const tarefas = db.tarefas.filter((t) => (!quem || t.responsavelId === quem) && (!foco || foco.has(t.id))).sort((a, b) => Number(a.concluida) - Number(b.concluida) || a.prazo.localeCompare(b.prazo))
  const eventos = db.eventos.filter((e) => e.dataInicio >= hoje && e.dataInicio <= addDays(hoje, Number(janela)) && e.status !== 'cancelado')
  const aniversarios = db.clientes.filter((c) => {
    if (c.status === 'encerrada' || !c.aniversario) return false
    for (let i = 0; i <= 7; i++) if (addDays(hoje, i).slice(5) === c.aniversario) return true
    return false
  })
  const followups = db.leads.filter((l) => l.proximoPasso && !['ganho', 'perdido'].includes(l.etapa) && (!quem || l.responsavelId === quem)).sort((a, b) => a.ultimaInteracao.localeCompare(b.ultimaInteracao)).slice(0, 8)

  return (
    <>
      <PageHead
        eyebrow="Showroom"
        title="Agenda & tarefas"
        desc="Visitas de revendas e leads ao showroom, tarefas da equipe, aniversários e follow-ups."
        actions={<>
          <button className="btn" onClick={() => setEditT({ id: newId('t'), titulo: '', responsavelId: quem || db.colaboradores[0]?.id || '', prazo: addDays(hoje, 1), concluida: false })}><IcPlus /> Tarefa</button>
          <button className="btn primary" onClick={() => setEditV({ id: newId('vis'), nomeVisitante: '', data: hoje, horario: '14h', responsavelId: quem || db.colaboradores[0]?.id || '', objetivo: '', status: 'agendada' })}><IcPlus /> Agendar visita</button>
        </>}
      />
      <FocoAviso />
      <div className="toolbar">
        <select className="input" value={quem} onChange={(e) => setQuem(e.target.value)}>
          <option value="">Toda a equipe</option>
          {pessoasAtivas(db).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <Segmented value={janela} onChange={setJanela} options={[{ value: '7', label: '7 dias' }, { value: '14', label: '14 dias' }, { value: '30', label: '30 dias' }]} />
      </div>
      <div className="grid g-2-1">
        <Card title="Visitas ao showroom" sub={`próximos ${janela} dias`}>
          {visitas.map(([dia, vs]) => (
            <div key={dia} style={{ marginBottom: 14 }}>
              <div className="eyebrow">{DIAS[parse(dia).getDay()]}, {dayMonth(dia)}{dia === hoje ? ' · hoje' : ''}</div>
              {eventos.filter((e) => e.dataInicio === dia).map((e) => <div key={e.id} className="alert info" style={{ marginBottom: 6 }}><span className="ico">★</span>Evento: {e.titulo}</div>)}
              <div className="list">
                {vs.map((v) => (
                  <div key={v.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => setEditV(v)}>
                    <b style={{ width: 54 }}>{v.horario}</b>
                    <div className="grow">
                      <div className="strong">{v.nomeVisitante}{v.leadId && <Badge tone="gold">lead</Badge>}</div>
                      <div className="small muted">{v.objetivo}{v.clienteId ? ` · ${db.clientes.find((c) => c.id === v.clienteId)?.nome}` : ''}</div>
                    </div>
                    <Person id={v.responsavelId} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!visitas.length && <div className="empty">Nenhuma visita agendada no período.</div>}
        </Card>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Tarefas">
            <div className="list">
              {tarefas.map((t) => {
                const atrasada = !t.concluida && t.prazo < hoje
                return (
                  <div key={t.id} className="list-item">
                    <input type="checkbox" className="check" style={{ accentColor: 'var(--gold)', width: 16, height: 16 }} checked={t.concluida} onChange={(e) => upsert('tarefas', { ...t, concluida: e.target.checked })} aria-label="Concluir" />
                    <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setEditT(t)}>
                      <div className={t.concluida ? 'done' : 'strong'}>{t.titulo}</div>
                      <div className="small muted">{db.colaboradores.find((c) => c.id === t.responsavelId)?.nome} · {t.relacionado}</div>
                    </div>
                    <Badge tone={t.concluida ? 'good' : atrasada ? 'bad' : diffDays(t.prazo, hoje) <= 1 ? 'warn' : undefined}>{t.concluida ? 'Feita' : date(t.prazo)}</Badge>
                  </div>
                )
              })}
              {!tarefas.length && <div className="empty">Sem tarefas.</div>}
            </div>
          </Card>
          <Card title="Aniversários de revendas" sub="próximos 7 dias">
            {aniversarios.map((c) => <div key={c.id} className="list-item"><div className="grow"><div className="strong">{c.nome}</div><div className="small muted">{c.responsavelNome} · {c.telefone}</div></div><Badge tone="gold">{c.aniversario!.split('-').reverse().join('/')}</Badge></div>)}
            {!aniversarios.length && <div className="empty">Nenhum aniversário na semana.</div>}
          </Card>
          <Card title="Follow-ups de leads" sub="mais antigos primeiro">
            {followups.map((l) => <div key={l.id} className="list-item"><div className="grow"><div className="strong">{l.nome}</div><div className="small muted">{l.proximoPasso} · {l.cidade}</div></div><span className="small muted">{diffDays(hoje, l.ultimaInteracao)}d</span></div>)}
          </Card>
        </div>
      </div>

      {editV && (
        <FormModal title="Visita ao showroom" initial={editV} onClose={() => setEditV(null)}
          onSave={(v) => {
            const cli = db.clientes.find((c) => c.id === v.clienteId)
            upsert('visitas', { ...v, nomeVisitante: v.nomeVisitante || cli?.responsavelNome || cli?.nome || '' })
            setEditV(null)
          }}
          onDelete={db.visitas.some((x) => x.id === editV.id) ? () => { remove('visitas', editV.id); setEditV(null) } : undefined}
          fields={[
            { name: 'clienteId', label: 'Revenda', type: 'select', options: db.clientes.filter((c) => c.status !== 'encerrada').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: c.nome })) },
            { name: 'leadId', label: 'ou Lead', type: 'select', options: db.leads.filter((l) => !['ganho', 'perdido'].includes(l.etapa)).map((l) => ({ value: l.id, label: `${l.nome} — ${l.cidade}` })) },
            { name: 'nomeVisitante', label: 'Nome de quem vem' },
            { name: 'responsavelId', label: 'Quem atende', type: 'select', required: true, options: opcoesPessoas(db, { atual: editV.responsavelId }) },
            { name: 'data', label: 'Data', type: 'date', required: true },
            { name: 'horario', label: 'Horário', required: true },
            { name: 'objetivo', label: 'Objetivo', full: true, placeholder: 'Reposição, lançamento, apresentação para nova revenda…' },
            { name: 'status', label: 'Status', type: 'select', required: true, options: Object.entries(STATUS_VISITA).map(([value, label]) => ({ value, label })) },
            { name: 'resultado', label: 'Resultado da visita', type: 'textarea' },
          ]} />
      )}
      {editT && (
        <FormModal title="Tarefa" initial={editT} onClose={() => setEditT(null)}
          onSave={(v) => { upsert('tarefas', v); setEditT(null) }}
          onDelete={db.tarefas.some((x) => x.id === editT.id) ? () => { remove('tarefas', editT.id); setEditT(null) } : undefined}
          fields={[
            { name: 'titulo', label: 'Tarefa', required: true, full: true },
            { name: 'responsavelId', label: 'Responsável', type: 'select', required: true, options: opcoesPessoas(db, { atual: editT.responsavelId }) },
            { name: 'prazo', label: 'Prazo', type: 'date', required: true },
            { name: 'relacionado', label: 'Área', type: 'select', options: ['Ativação', 'Débitos', 'Evento', 'Brindes', 'Tráfego', 'Leads', 'Pós-venda', 'Expansão'].map((x) => ({ value: x, label: x })) },
            { name: 'concluida', label: 'Concluída', type: 'checkbox' },
          ]} />
      )}
    </>
  )
}

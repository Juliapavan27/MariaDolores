import { newId, useStore } from '../data/store'
import type { Atendimento, ResultadoAtendimento, TipoAtendimento } from '../data/types'
import { FormModal, opts } from './ui'
import { addDays, today } from '../lib/dates'

export const TIPO_ATENDIMENTO: Record<TipoAtendimento, string> = {
  showroom: 'Visita ao showroom', whatsapp: 'WhatsApp', ligacao: 'Ligação', visita_rep: 'Visita da representante', evento: 'Evento', email: 'E-mail',
}
export const RESULTADO_ATENDIMENTO: Record<ResultadoAtendimento, string> = {
  pedido: 'Virou pedido', sem_pedido: 'Sem pedido', agendou: 'Agendou próximo passo', sem_retorno: 'Sem retorno',
}

export const novoAtendimento = (clienteId: string, responsavelId: string): Atendimento => ({
  id: newId('at'), clienteId, responsavelId, data: today(), tipo: 'whatsapp', resultado: 'sem_pedido', resumo: '', proximoContato: addDays(today(), 15),
})

/** Registro de contato. O "próximo contato" vira o follow-up que aparece no Plano da semana. */
export function AtendimentoForm({ inicial, onClose }: { inicial: Atendimento; onClose: () => void }) {
  const { db, upsert, remove } = useStore()
  const existe = db.atendimentos.some((a) => a.id === inicial.id)
  return (
    <FormModal
      title={existe ? 'Atendimento' : 'Registrar atendimento'}
      initial={inicial}
      onClose={onClose}
      onSave={(v) => { upsert('atendimentos', v); onClose() }}
      onDelete={existe ? () => { remove('atendimentos', inicial.id); onClose() } : undefined}
      fields={[
        { name: 'clienteId', label: 'Revenda', type: 'select', required: true, options: db.clientes.filter((c) => c.status !== 'encerrada').sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ value: c.id, label: `${c.nome} — ${c.cidade}` })) },
        { name: 'responsavelId', label: 'Quem atendeu', type: 'select', required: true, options: db.colaboradores.map((c) => ({ value: c.id, label: c.nome })) },
        { name: 'data', label: 'Data', type: 'date', required: true },
        { name: 'tipo', label: 'Como foi o contato', type: 'select', required: true, options: opts(TIPO_ATENDIMENTO) },
        { name: 'resultado', label: 'Resultado', type: 'select', required: true, options: opts(RESULTADO_ATENDIMENTO) },
        { name: 'proximoContato', label: 'Próximo contato (follow-up)', type: 'date', help: 'Aparece no Plano da semana quando chegar a data.' },
        { name: 'resumo', label: 'O que foi conversado', type: 'textarea' },
        { name: 'proximoPasso', label: 'Próximo passo combinado', full: true },
      ]}
    />
  )
}

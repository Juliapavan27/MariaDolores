// Importação de planilhas do sistema B2B (CSV ou Excel).
// Cada tipo de dado descreve seus campos, os nomes de coluna que costuma ter
// e como transformar uma linha da planilha num registro da plataforma.
import type {
  Cargo, CanalVenda, Cliente, Colaborador, Colecao, Database, Devolucao, EtapaLead, Lead, OrigemLead, Pedido,
  StatusCliente, StatusDevolucao, StatusPedido, TipoCliente, Titulo,
} from '../data/types'
import { REGIOES } from '../data/labels'
import { today } from './dates'
import { parseCSV } from './csv'

// ---------- Normalização e conversões no formato brasileiro ----------
export const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()

const digitos = (s: string) => s.replace(/\D/g, '')
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

/** "R$ 1.234,56", "1234.56", "1,5" → número. Vazio → undefined. */
export function numero(v: string): number | undefined {
  let s = String(v ?? '').replace(/R\$|\s/g, '').replace(/[^\d,.-]/g, '')
  if (!s) return undefined
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (s.includes(',')) s = s.replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

/** "25/03/2026", "25/03/26", "2026-03-25", "25-03-2026 14:00" ou número de série do Excel → AAAA-MM-DD. */
export function data(v: string): string | undefined {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return valida(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) return valida(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  return undefined
}

/** Recusa datas impossíveis, como 32/13/2026 ou 30/02. */
function valida(ano: number, mes: number, dia: number) {
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (ano < 1990 || ano > 2100 || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return undefined
  return d.toISOString().slice(0, 10)
}

const tem = (s: string, ...xs: string[]) => xs.some((x) => norm(s).includes(x))

// ---------- Leitura do arquivo ----------
export async function lerArquivo(file: File): Promise<Record<string, string>[]> {
  const nome = file.name.toLowerCase()
  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    // leitor de Excel carregado só quando necessário
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: '' })
    const celula = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '').trim())
    return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), celula(v)])))
  }
  // CSV: tenta UTF-8; se o arquivo não for UTF-8 válido, relê como Windows-1252 (Excel brasileiro)
  const buf = await file.arrayBuffer()
  let texto: string
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    texto = new TextDecoder('windows-1252').decode(buf)
  }
  return parseCSV(texto)
}

// ---------- Índices para ligar registros (revenda, vendedora) ----------
export interface Indices {
  revenda(ref: string): Cliente | undefined
  pessoa(ref: string): Colaborador | undefined
}

export function criarIndices(db: Database): Indices {
  const porCodigo = new Map<string, Cliente>()
  const porDoc = new Map<string, Cliente>()
  const porNome = new Map<string, Cliente>()
  db.clientes.forEach((c) => {
    if (c.codigo) porCodigo.set(norm(c.codigo), c)
    if (digitos(c.documento || '').length >= 11) porDoc.set(digitos(c.documento), c)
    porNome.set(norm(c.nome), c)
  })
  return {
    revenda(ref) {
      if (!ref) return undefined
      const d = digitos(ref)
      return porCodigo.get(norm(ref)) || (d.length >= 11 ? porDoc.get(d) : undefined) || porNome.get(norm(ref))
    },
    pessoa(ref) {
      if (!ref) return undefined
      const r = norm(ref)
      return db.colaboradores.find((c) => norm(c.nome) === r || norm(c.email) === r)
        || db.colaboradores.find((c) => norm(c.nome).split(' ')[0] === r.split(' ')[0] && r.length > 2)
    },
  }
}

// ---------- Especificação de cada tipo ----------
export interface Campo {
  chave: string
  rotulo: string
  obrigatorio?: boolean
  sinonimos: string[]
  dica?: string
}

type Resultado<T> = { item: T } | { erro: string }

export interface TipoImportacao<T extends { id: string } = { id: string }> {
  chave: string
  colecao: Colecao
  titulo: string
  descricao: string
  campos: Campo[]
  montar(linha: Record<string, string>, ix: Indices, db: Database): Resultado<T>
  resumo(item: T, db: Database): string[]
}

const idPorCodigo = (prefixo: string, codigo?: string) => (codigo ? `${prefixo}-b2b-${slug(codigo)}` : undefined)
const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

function existente<T extends { id: string }>(lista: T[], id?: string, outro?: (x: T) => boolean) {
  return (id && lista.find((x) => x.id === id)) || (outro && lista.find(outro)) || undefined
}

/** Mescla: o que veio preenchido na planilha substitui; o que veio vazio mantém o que já existia. */
function mesclar<T extends object>(antigo: T | undefined, novo: Partial<T>): T {
  const limpo = Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>
  return { ...(antigo || {}), ...limpo } as T
}

const cargo = (s: string): Cargo => (tem(s, 'rep') ? 'representante' : tem(s, 'anal', 'lead', 'sdr') ? 'analista' : 'vendedora')
const statusCliente = (s: string): StatusCliente => (tem(s, 'inativ', 'encerr', 'bloque', 'cancel', 'desativ') ? 'encerrada' : tem(s, 'queda', 'saindo', 'sair') ? 'em_queda' : 'ativa')
const tipoCliente = (s: string): TipoCliente => (tem(s, 'multimarca', 'loja') ? 'loja_multimarca' : tem(s, 'consult') ? 'consultora' : 'revenda')
const statusPedido = (s: string): StatusPedido => (tem(s, 'cancel') ? 'cancelado' : tem(s, 'pend', 'aberto', 'aguard', 'orcament', 'separ', 'aprovac', 'digitad') ? 'pendente' : 'faturado')
const canal = (s: string, rep: boolean): CanalVenda =>
  tem(s, 'show') ? 'showroom' : tem(s, 'event', 'feira') ? 'evento' : tem(s, 'online', 'site', 'whats', 'b2b', 'ecommerce', 'portal', 'loja virtual') ? 'online' : tem(s, 'rep') || rep ? 'representante' : 'showroom'
const statusDevolucao = (s: string): StatusDevolucao =>
  tem(s, 'concl', 'finaliz', 'credit') ? 'concluida' : tem(s, 'recus', 'negad') ? 'recusada' : tem(s, 'anal') ? 'em_analise' : tem(s, 'solicit', 'abert') ? 'solicitada' : 'aprovada'
const origemLead = (s: string): OrigemLead =>
  tem(s, 'facebook', 'instagram', 'meta', 'fb') ? 'meta' : tem(s, 'google', 'adwords', 'cpc', 'search') ? 'google' : tem(s, 'indica') ? 'indicacao' : tem(s, 'evento', 'feira') ? 'evento' : tem(s, 'prospec', 'outbound', 'fria', 'ativa') ? 'prospeccao' : 'organico'
const etapaLead = (s: string): EtapaLead =>
  tem(s, 'ganh', 'cliente', 'venda', 'fechad') ? 'ganho' : tem(s, 'perd', 'descart') ? 'perdido' : tem(s, 'negoc', 'oportun') ? 'negociacao' : tem(s, 'propost', 'catalog') ? 'proposta' : tem(s, 'qualif') ? 'qualificado' : tem(s, 'contat') ? 'contato' : 'novo'

/** Região: usa a da planilha se bater com a lista; senão deduz pela UF. */
function regiao(s: string, uf: string, cidade: string) {
  const r = REGIOES.find((x) => norm(x) === norm(s)) || REGIOES.find((x) => s && norm(x).includes(norm(s)))
  if (r) return r
  if (s) return s
  if (uf && uf !== 'SP') return uf === 'MG' ? 'Sul de Minas' : 'Outros estados'
  return norm(cidade).startsWith('sao paulo') ? 'Capital SP' : 'Interior / Grande SP'
}

const SIN_REVENDA = ['cnpj', 'cpf/cnpj', 'cnpj/cpf', 'codigo cliente', 'cod cliente', 'id cliente', 'cliente', 'revenda', 'loja', 'razao social', 'nome fantasia']
const SIN_RESP = ['vendedora', 'vendedor', 'representante', 'consultor', 'responsavel', 'atendente']

export const TIPOS: TipoImportacao[] = [
  {
    chave: 'equipe', colecao: 'colaboradores', titulo: 'Equipe', descricao: 'Vendedoras, representantes e analista, com metas.',
    campos: [
      { chave: 'nome', rotulo: 'Nome', obrigatorio: true, sinonimos: ['nome', 'colaborador', 'vendedora', 'vendedor', 'representante'] },
      { chave: 'cargo', rotulo: 'Cargo', sinonimos: ['cargo', 'funcao', 'tipo'], dica: 'vendedora, representante ou analista' },
      { chave: 'regiao', rotulo: 'Região / carteira', sinonimos: ['regiao', 'carteira', 'territorio'] },
      { chave: 'email', rotulo: 'E-mail', sinonimos: ['email', 'e mail'] },
      { chave: 'telefone', rotulo: 'Telefone', sinonimos: ['telefone', 'celular', 'whatsapp'] },
      { chave: 'metaMensal', rotulo: 'Meta mensal (R$)', sinonimos: ['meta mensal', 'meta faturamento', 'meta'] },
      { chave: 'metaAtivacao', rotulo: 'Meta de ativação', sinonimos: ['meta ativacao', 'ativacao'], dica: '70 ou 0,7 = 70%' },
    ],
    montar(l, _ix, db) {
      if (!l.nome) return { erro: 'sem nome' }
      const id = `col-${slug(l.nome)}`
      const antigo = existente(db.colaboradores, id, (c) => norm(c.nome) === norm(l.nome))
      const at = numero(l.metaAtivacao)
      return { item: mesclar<Colaborador>(antigo, {
        id: antigo?.id || id, nome: l.nome, cargo: l.cargo ? cargo(l.cargo) : antigo?.cargo || 'vendedora', regiao: l.regiao, email: l.email, telefone: l.telefone,
        metaMensal: numero(l.metaMensal) ?? antigo?.metaMensal ?? 0, metaAtivacao: at === undefined ? antigo?.metaAtivacao ?? db.config.metaAtivacao : at > 1 ? at / 100 : at, ativo: true,
      }) }
    },
    resumo: (c) => [c.nome, (c as Colaborador).cargo],
  } as TipoImportacao<Colaborador>,
  {
    chave: 'revendas', colecao: 'clientes', titulo: 'Revendas (clientes)', descricao: 'Carteira de revendas com cidade, responsável e status.',
    campos: [
      { chave: 'codigo', rotulo: 'Código do cliente', sinonimos: ['codigo cliente', 'cod cliente', 'id cliente', 'codigo', 'cod', 'id'] },
      { chave: 'nome', rotulo: 'Nome da revenda', obrigatorio: true, sinonimos: ['nome fantasia', 'fantasia', 'revenda', 'cliente', 'loja', 'razao social', 'nome'] },
      { chave: 'documento', rotulo: 'CNPJ / CPF', sinonimos: ['cnpj', 'cpf/cnpj', 'cnpj/cpf', 'cpf', 'documento'] },
      { chave: 'contato', rotulo: 'Pessoa de contato', sinonimos: ['contato', 'comprador', 'pessoa de contato', 'proprietaria', 'responsavel loja'] },
      { chave: 'telefone', rotulo: 'Telefone / WhatsApp', sinonimos: ['whatsapp', 'celular', 'telefone', 'fone'] },
      { chave: 'email', rotulo: 'E-mail', sinonimos: ['email', 'e mail'] },
      { chave: 'instagram', rotulo: 'Instagram', sinonimos: ['instagram', 'insta'] },
      { chave: 'cidade', rotulo: 'Cidade', obrigatorio: true, sinonimos: ['cidade', 'municipio'] },
      { chave: 'bairro', rotulo: 'Bairro (na capital vira o território)', sinonimos: ['bairro'] },
      { chave: 'uf', rotulo: 'UF', obrigatorio: true, sinonimos: ['uf', 'estado'] },
      { chave: 'regiao', rotulo: 'Região', sinonimos: ['regiao', 'zona', 'territorio'] },
      { chave: 'responsavel', rotulo: 'Vendedora / representante', sinonimos: SIN_RESP, dica: 'nome ou e-mail igual ao cadastro da Equipe' },
      { chave: 'status', rotulo: 'Status', sinonimos: ['status', 'situacao'] },
      { chave: 'tipo', rotulo: 'Tipo', sinonimos: ['tipo', 'categoria', 'segmento'] },
      { chave: 'dataCadastro', rotulo: 'Data de cadastro', sinonimos: ['data cadastro', 'data de cadastro', 'cliente desde', 'cadastro'] },
      { chave: 'limiteCredito', rotulo: 'Limite de crédito', sinonimos: ['limite de credito', 'limite', 'credito'] },
    ],
    montar(l, ix, db) {
      if (!l.nome) return { erro: 'sem nome da revenda' }
      if (!l.cidade) return { erro: 'sem cidade' }
      const uf = (l.uf || '').trim().toUpperCase().slice(0, 2)
      if (!/^[A-Z]{2}$/.test(uf)) return { erro: 'UF inválida' }
      const cidade = l.bairro && norm(l.cidade) === 'sao paulo' ? `São Paulo — ${l.bairro}` : l.cidade
      const doc = digitos(l.documento || '')
      const id = idPorCodigo('cli', l.codigo) || (doc.length >= 11 ? `cli-doc-${doc}` : undefined)
      const antigo = existente(db.clientes, id, (c) => (!!l.codigo && c.codigo === l.codigo) || (doc.length >= 11 && digitos(c.documento) === doc))
      const resp = ix.pessoa(l.responsavel)
      if (!resp && !antigo?.responsavelId) return { erro: l.responsavel ? `vendedora "${l.responsavel}" não está na Equipe` : 'sem vendedora/representante responsável' }
      return { item: mesclar<Cliente>(antigo, {
        id: antigo?.id || id || novoId('cli'), codigo: l.codigo, nome: l.nome, responsavelNome: l.contato || antigo?.responsavelNome || '', documento: l.documento || antigo?.documento || '',
        tipo: l.tipo ? tipoCliente(l.tipo) : antigo?.tipo || 'revenda', cidade, uf, regiao: regiao(l.regiao, uf, cidade),
        telefone: l.telefone || antigo?.telefone || '', email: l.email || antigo?.email || '', instagram: l.instagram || antigo?.instagram || '',
        responsavelId: resp?.id || antigo!.responsavelId, status: l.status ? statusCliente(l.status) : antigo?.status || 'ativa',
        dataCadastro: data(l.dataCadastro) || antigo?.dataCadastro || today(), limiteCredito: numero(l.limiteCredito) ?? antigo?.limiteCredito ?? 0,
      }) }
    },
    resumo: (c) => [c.nome, `${c.cidade}/${c.uf}`],
  } as TipoImportacao<Cliente>,
  {
    chave: 'pedidos', colecao: 'pedidos', titulo: 'Pedidos / faturamento', descricao: 'Pedidos com data, revenda, valor e status.',
    campos: [
      { chave: 'codigo', rotulo: 'Número do pedido', sinonimos: ['numero pedido', 'n pedido', 'no pedido', 'id pedido', 'pedido', 'numero', 'codigo'] },
      { chave: 'data', rotulo: 'Data', obrigatorio: true, sinonimos: ['data faturamento', 'data do pedido', 'data pedido', 'data emissao', 'data venda', 'emissao', 'data'] },
      { chave: 'revenda', rotulo: 'Revenda (código, CNPJ ou nome)', obrigatorio: true, sinonimos: SIN_REVENDA },
      { chave: 'valor', rotulo: 'Valor', obrigatorio: true, sinonimos: ['valor total', 'total pedido', 'valor liquido', 'valor do pedido', 'total', 'valor'] },
      { chave: 'pecas', rotulo: 'Peças', sinonimos: ['quantidade', 'qtd', 'qtde', 'pecas', 'itens'] },
      { chave: 'canal', rotulo: 'Canal', sinonimos: ['canal', 'origem', 'tipo venda'] },
      { chave: 'colecao', rotulo: 'Coleção', sinonimos: ['colecao', 'campanha', 'catalogo'] },
      { chave: 'status', rotulo: 'Status', sinonimos: ['status', 'situacao'] },
      { chave: 'responsavel', rotulo: 'Vendedora / representante', sinonimos: SIN_RESP },
    ],
    montar(l, ix, db) {
      const cli = ix.revenda(l.revenda)
      if (!cli) return { erro: l.revenda ? `revenda "${l.revenda}" não encontrada` : 'sem revenda' }
      const dt = data(l.data)
      if (!dt) return { erro: `data inválida "${l.data}"` }
      const valor = numero(l.valor)
      if (valor === undefined) return { erro: `valor inválido "${l.valor}"` }
      const id = idPorCodigo('ped', l.codigo)
      const antigo = existente(db.pedidos, id)
      const resp = ix.pessoa(l.responsavel) || db.colaboradores.find((c) => c.id === cli.responsavelId)
      return { item: mesclar<Pedido>(antigo, {
        id: antigo?.id || id || novoId('ped'), codigo: l.codigo, clienteId: cli.id, responsavelId: resp?.id || cli.responsavelId, data: dt, valor,
        pecas: numero(l.pecas) ?? antigo?.pecas ?? 0, canal: canal(l.canal, resp?.cargo === 'representante'), colecao: l.colecao || antigo?.colecao || db.config.colecaoAtual,
        status: l.status ? statusPedido(l.status) : antigo?.status || 'faturado',
      }) }
    },
    resumo: (p, db) => [db.clientes.find((c) => c.id === p.clienteId)?.nome || '', p.data, String(p.valor)],
  } as TipoImportacao<Pedido>,
  {
    chave: 'titulos', colecao: 'titulos', titulo: 'Títulos / débitos', descricao: 'Contas a receber: vencimento, valor e quanto já foi pago.',
    campos: [
      { chave: 'revenda', rotulo: 'Revenda (código, CNPJ ou nome)', obrigatorio: true, sinonimos: SIN_REVENDA },
      { chave: 'codigo', rotulo: 'Número do título', sinonimos: ['numero titulo', 'n titulo', 'titulo', 'nosso numero', 'boleto', 'duplicata', 'parcela', 'codigo'] },
      { chave: 'pedido', rotulo: 'Número do pedido', sinonimos: ['numero pedido', 'pedido'] },
      { chave: 'emissao', rotulo: 'Emissão', sinonimos: ['data emissao', 'emissao'] },
      { chave: 'vencimento', rotulo: 'Vencimento', obrigatorio: true, sinonimos: ['data vencimento', 'vencimento', 'venc'] },
      { chave: 'valorPago', rotulo: 'Valor pago', sinonimos: ['valor pago', 'valor recebido', 'pago', 'recebido'] },
      { chave: 'valor', rotulo: 'Valor', obrigatorio: true, sinonimos: ['valor titulo', 'valor original', 'valor parcela', 'valor'] },
      { chave: 'forma', rotulo: 'Forma de pagamento', sinonimos: ['forma de pagamento', 'forma pagamento', 'forma'] },
      { chave: 'status', rotulo: 'Situação', sinonimos: ['situacao', 'status'], dica: '"pago" ou "liquidado" marca como pago' },
    ],
    montar(l, ix, db) {
      const cli = ix.revenda(l.revenda)
      if (!cli) return { erro: l.revenda ? `revenda "${l.revenda}" não encontrada` : 'sem revenda' }
      const venc = data(l.vencimento)
      if (!venc) return { erro: `vencimento inválido "${l.vencimento}"` }
      const valor = numero(l.valor)
      if (valor === undefined) return { erro: `valor inválido "${l.valor}"` }
      const pagoPorStatus = tem(l.status, 'pago', 'liquid', 'quitad', 'baixad', 'recebid')
      const id = idPorCodigo('tit', l.codigo ? `${l.codigo}-${l.revenda}` : undefined)
      const antigo = existente(db.titulos, id)
      const pedido = l.pedido ? db.pedidos.find((p) => p.codigo === l.pedido) : undefined
      return { item: mesclar<Titulo>(antigo, {
        id: antigo?.id || id || novoId('tit'), codigo: l.codigo, clienteId: cli.id, pedidoId: pedido?.id, emissao: data(l.emissao) || antigo?.emissao || venc, vencimento: venc,
        valor, valorPago: numero(l.valorPago) ?? (pagoPorStatus ? valor : antigo?.valorPago ?? 0), formaPagamento: l.forma || antigo?.formaPagamento || 'Boleto',
      }) }
    },
    resumo: (t, db) => [db.clientes.find((c) => c.id === t.clienteId)?.nome || '', t.vencimento, String(t.valor)],
  } as TipoImportacao<Titulo>,
  {
    chave: 'devolucoes', colecao: 'devolucoes', titulo: 'Devoluções', descricao: 'Devoluções com motivo, valor e status.',
    campos: [
      { chave: 'codigo', rotulo: 'Número da devolução', sinonimos: ['numero devolucao', 'devolucao', 'codigo', 'numero'] },
      { chave: 'revenda', rotulo: 'Revenda (código, CNPJ ou nome)', obrigatorio: true, sinonimos: SIN_REVENDA },
      { chave: 'data', rotulo: 'Data', obrigatorio: true, sinonimos: ['data devolucao', 'data'] },
      { chave: 'valor', rotulo: 'Valor', obrigatorio: true, sinonimos: ['valor total', 'valor'] },
      { chave: 'pecas', rotulo: 'Peças', sinonimos: ['quantidade', 'qtd', 'pecas'] },
      { chave: 'motivo', rotulo: 'Motivo', sinonimos: ['motivo', 'observacao', 'causa'] },
      { chave: 'status', rotulo: 'Status', sinonimos: ['status', 'situacao'] },
    ],
    montar(l, ix, db) {
      const cli = ix.revenda(l.revenda)
      if (!cli) return { erro: l.revenda ? `revenda "${l.revenda}" não encontrada` : 'sem revenda' }
      const dt = data(l.data)
      if (!dt) return { erro: `data inválida "${l.data}"` }
      const valor = numero(l.valor)
      if (valor === undefined) return { erro: `valor inválido "${l.valor}"` }
      const id = idPorCodigo('dev', l.codigo)
      const antigo = existente(db.devolucoes, id)
      return { item: mesclar<Devolucao>(antigo, {
        id: antigo?.id || id || novoId('dev'), codigo: l.codigo, clienteId: cli.id, data: dt, valor, pecas: numero(l.pecas) ?? 0,
        motivo: l.motivo || antigo?.motivo || 'Não informado', status: l.status ? statusDevolucao(l.status) : antigo?.status || 'aprovada',
      }) }
    },
    resumo: (d, db) => [db.clientes.find((c) => c.id === d.clienteId)?.nome || '', d.data, String(d.valor)],
  } as TipoImportacao<Devolucao>,
  {
    chave: 'leads', colecao: 'leads', titulo: 'Leads', descricao: 'Leads de RD Station, planilhas de prospecção ou do B2B.',
    campos: [
      { chave: 'nome', rotulo: 'Nome', obrigatorio: true, sinonimos: ['nome', 'name', 'lead', 'contato'] },
      { chave: 'empresa', rotulo: 'Empresa / loja', sinonimos: ['empresa', 'company', 'loja'] },
      { chave: 'email', rotulo: 'E-mail', sinonimos: ['email', 'e mail'] },
      { chave: 'telefone', rotulo: 'Telefone', sinonimos: ['celular', 'telefone', 'whatsapp', 'phone', 'mobile'] },
      { chave: 'cidade', rotulo: 'Cidade', sinonimos: ['cidade', 'city'] },
      { chave: 'uf', rotulo: 'UF', sinonimos: ['uf', 'estado', 'state'] },
      { chave: 'origem', rotulo: 'Origem', sinonimos: ['origem da primeira conversao', 'origem', 'fonte', 'source', 'canal'] },
      { chave: 'etapa', rotulo: 'Etapa do funil', sinonimos: ['estagio no funil', 'estagio', 'etapa', 'lifecycle', 'status'] },
      { chave: 'dataEntrada', rotulo: 'Data de entrada', sinonimos: ['data de criacao', 'criado em', 'data da primeira conversao', 'data entrada', 'data'] },
      { chave: 'codigo', rotulo: 'ID no sistema de origem', sinonimos: ['id', 'uuid', 'codigo'] },
    ],
    montar(l, _ix, db) {
      if (!l.nome && !l.email) return { erro: 'sem nome nem e-mail' }
      const id = idPorCodigo('lead', l.codigo || l.email)
      const antigo = existente(db.leads, id, (x) => !!l.email && norm(x.email) === norm(l.email))
      const entrada = data(l.dataEntrada) || antigo?.dataEntrada || today()
      return { item: mesclar<Lead>(antigo, {
        id: antigo?.id || id || novoId('lead'), codigo: l.codigo, nome: l.nome || l.email, empresa: l.empresa || antigo?.empresa || '', email: l.email || antigo?.email || '',
        telefone: l.telefone || antigo?.telefone || '', cidade: l.cidade || antigo?.cidade || '', uf: (l.uf || antigo?.uf || 'SP').slice(0, 2).toUpperCase(),
        origem: l.origem ? origemLead(l.origem) : antigo?.origem || 'organico', etapa: l.etapa ? etapaLead(l.etapa) : antigo?.etapa || 'novo',
        responsavelId: antigo?.responsavelId || db.colaboradores.find((c) => c.cargo === 'analista')?.id || '', dataEntrada: entrada, ultimaInteracao: antigo?.ultimaInteracao || entrada,
        valorPotencial: antigo?.valorPotencial ?? 3000,
      }) }
    },
    resumo: (l) => [l.nome, `${l.cidade}/${l.uf}`],
  } as TipoImportacao<Lead>,
]

/** Liga cada campo à coluna da planilha mais provável: primeiro nomes idênticos, depois parecidos. */
export function mapearColunas(tipo: TipoImportacao, colunas: string[]): Record<string, string> {
  const usadas = new Set<string>()
  const mapa: Record<string, string> = {}
  const cols = colunas.map((c) => ({ c, n: norm(c) }))
  for (const exato of [true, false]) {
    for (const campo of tipo.campos) {
      if (mapa[campo.chave]) continue
      for (const sin of exato ? [norm(campo.rotulo), ...campo.sinonimos] : campo.sinonimos) {
        const hit = cols.find(({ c, n }) => !usadas.has(c) && (exato ? n === sin : sin.length >= 3 && n.includes(sin)))
        if (hit) {
          mapa[campo.chave] = hit.c
          usadas.add(hit.c)
          break
        }
      }
    }
  }
  return mapa
}

export function modeloCSV(tipo: TipoImportacao) {
  return tipo.campos.map((c) => c.rotulo).join(';') + '\n'
}

// Dados de demonstração gerados de forma determinística, relativos à data de hoje.
// Servem para a equipe explorar a plataforma; podem ser zerados em Configurações.
import type {
  Brinde, Campanha, Cliente, Colaborador, Criativo, Database, Devolucao, Evento, Lead,
  MovimentoBrinde, Pedido, Reclamacao, Tarefa, Atendimento, TerritorioBloqueio, Titulo, Visita, EtapaLead, OrigemLead,
} from './types'
import { addDays, addMonths, today, startOfMonth } from '../lib/dates'
import { CATEGORIAS_RECLAMACAO, MOTIVOS_DEVOLUCAO } from './labels'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEFAULT_CONFIG: Database['config'] = {
  nomeUnidade: 'Showroom São Paulo',
  metaFaturamentoMensal: 420000,
  metaAtivacao: 0.7,
  investimentoMidiaMensal: 2000,
  divisaoMeta: 0.5,
  diasInatividadeAlerta: 60,
  raioExclusividadeKm: 15,
  colecaoAtual: 'Verão 27 — Sol de Dolores',
}

const CIDADES: [string, string, string][] = [
  ['São Paulo — Moema', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Vila Mariana', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Santo Amaro', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Pinheiros', 'SP', 'Capital SP — Zona Oeste'],
  ['São Paulo — Perdizes', 'SP', 'Capital SP — Zona Oeste'],
  ['São Paulo — Butantã', 'SP', 'Capital SP — Zona Oeste'],
  ['São Paulo — Santana', 'SP', 'Capital SP — Zona Norte'],
  ['São Paulo — Tucuruvi', 'SP', 'Capital SP — Zona Norte'],
  ['São Paulo — Tatuapé', 'SP', 'Capital SP — Zona Leste'],
  ['São Paulo — Mooca', 'SP', 'Capital SP — Zona Leste'],
  ['São Paulo — Jardins', 'SP', 'Capital SP — Centro'],
  ['Santo André', 'SP', 'Grande SP'],
  ['São Bernardo do Campo', 'SP', 'Grande SP'],
  ['Osasco', 'SP', 'Grande SP'],
  ['Guarulhos', 'SP', 'Grande SP'],
  ['Barueri / Alphaville', 'SP', 'Grande SP'],
  ['Mogi das Cruzes', 'SP', 'Grande SP'],
  ['Campinas', 'SP', 'Campinas e região'],
  ['Valinhos', 'SP', 'Campinas e região'],
  ['Jundiaí', 'SP', 'Campinas e região'],
  ['Americana', 'SP', 'Campinas e região'],
  ['Piracicaba', 'SP', 'Campinas e região'],
  ['Indaiatuba', 'SP', 'Campinas e região'],
  ['São José dos Campos', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Taubaté', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Ubatuba', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Santos', 'SP', 'Baixada Santista'],
  ['Guarujá', 'SP', 'Baixada Santista'],
  ['São Vicente', 'SP', 'Baixada Santista'],
  ['Ribeirão Preto', 'SP', 'Interior — Ribeirão Preto'],
  ['Franca', 'SP', 'Interior — Ribeirão Preto'],
  ['São Carlos', 'SP', 'Interior — Ribeirão Preto'],
  ['Araraquara', 'SP', 'Interior — Ribeirão Preto'],
  ['Sorocaba', 'SP', 'Interior — Sorocaba'],
  ['Itu', 'SP', 'Interior — Sorocaba'],
  ['Bauru', 'SP', 'Interior — Oeste Paulista'],
  ['Marília', 'SP', 'Interior — Oeste Paulista'],
  ['Presidente Prudente', 'SP', 'Interior — Oeste Paulista'],
  ['São José do Rio Preto', 'SP', 'Interior — Oeste Paulista'],
  ['Pouso Alegre', 'MG', 'Sul de Minas'],
  ['Poços de Caldas', 'MG', 'Sul de Minas'],
  ['Varginha', 'MG', 'Sul de Minas'],
  ['Campo Grande', 'MS', 'Outros estados'],
  ['São Paulo — Itaim Bibi', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Brooklin', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Campo Belo', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Saúde', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Morumbi', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Vila Madalena', 'SP', 'Capital SP — Zona Oeste'],
  ['São Paulo — Vila Leopoldina', 'SP', 'Capital SP — Zona Oeste'],
  ['São Paulo — Higienópolis', 'SP', 'Capital SP — Centro'],
  ['São Paulo — Bela Vista', 'SP', 'Capital SP — Centro'],
  ['São Paulo — Aclimação', 'SP', 'Capital SP — Centro'],
  ['São Paulo — Casa Verde', 'SP', 'Capital SP — Zona Norte'],
  ['São Paulo — Vila Guilherme', 'SP', 'Capital SP — Zona Norte'],
  ['São Paulo — Anália Franco', 'SP', 'Capital SP — Zona Leste'],
  ['São Paulo — Vila Prudente', 'SP', 'Capital SP — Zona Leste'],
  ['Diadema', 'SP', 'Grande SP'],
  ['Mauá', 'SP', 'Grande SP'],
  ['Taboão da Serra', 'SP', 'Grande SP'],
  ['Carapicuíba', 'SP', 'Grande SP'],
  ['Suzano', 'SP', 'Grande SP'],
  ['Santana de Parnaíba', 'SP', 'Grande SP'],
  ['Arujá', 'SP', 'Grande SP'],
  ['Sumaré', 'SP', 'Campinas e região'],
  ['Hortolândia', 'SP', 'Campinas e região'],
  ['Paulínia', 'SP', 'Campinas e região'],
  ['Vinhedo', 'SP', 'Campinas e região'],
  ['Itatiba', 'SP', 'Campinas e região'],
  ['Rio Claro', 'SP', 'Campinas e região'],
  ['Santa Bárbara d\'Oeste', 'SP', 'Campinas e região'],
  ['Pindamonhangaba', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Guaratinguetá', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['São Sebastião', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Ilhabela', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Bertioga', 'SP', 'Baixada Santista'],
  ['Itanhaém', 'SP', 'Baixada Santista'],
  ['Peruíbe', 'SP', 'Baixada Santista'],
  ['Barretos', 'SP', 'Interior — Ribeirão Preto'],
  ['Bebedouro', 'SP', 'Interior — Ribeirão Preto'],
  ['Batatais', 'SP', 'Interior — Ribeirão Preto'],
  ['Votorantim', 'SP', 'Interior — Sorocaba'],
  ['Tatuí', 'SP', 'Interior — Sorocaba'],
  ['Itapetininga', 'SP', 'Interior — Sorocaba'],
  ['Assis', 'SP', 'Interior — Oeste Paulista'],
  ['Ourinhos', 'SP', 'Interior — Oeste Paulista'],
  ['Lins', 'SP', 'Interior — Oeste Paulista'],
  ['Jaú', 'SP', 'Interior — Oeste Paulista'],
  ['Itajubá', 'MG', 'Sul de Minas'],
  ['Três Corações', 'MG', 'Sul de Minas'],
  ['Extrema', 'MG', 'Sul de Minas'],
  ['Alfenas', 'MG', 'Sul de Minas'],
  ['Dourados', 'MS', 'Outros estados'],
  ['Londrina', 'PR', 'Outros estados'],
]

/** Cidades-alvo ainda sem revenda (aparecem como disponíveis na expansão). */
export const CIDADES_ALVO: [string, string, string][] = [
  ['São Paulo — Ipiranga', 'SP', 'Capital SP — Zona Sul'],
  ['São Paulo — Lapa', 'SP', 'Capital SP — Zona Oeste'],
  ['São Paulo — Penha', 'SP', 'Capital SP — Zona Leste'],
  ['São Caetano do Sul', 'SP', 'Grande SP'],
  ['Cotia', 'SP', 'Grande SP'],
  ['Atibaia', 'SP', 'Campinas e região'],
  ['Bragança Paulista', 'SP', 'Campinas e região'],
  ['Limeira', 'SP', 'Campinas e região'],
  ['Jacareí', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Caraguatatuba', 'SP', 'Vale do Paraíba / Litoral Norte'],
  ['Praia Grande', 'SP', 'Baixada Santista'],
  ['Sertãozinho', 'SP', 'Interior — Ribeirão Preto'],
  ['Botucatu', 'SP', 'Interior — Sorocaba'],
  ['Araçatuba', 'SP', 'Interior — Oeste Paulista'],
  ['Lavras', 'MG', 'Sul de Minas'],
  ['Uberlândia', 'MG', 'Outros estados'],
]

const NOMES_LOJA = [
  'Ateliê Dourado', 'Bijou da Ana', 'Brilho Raro', 'Casa Lua', 'Divina Peça', 'Dona Joia', 'Elas Acessórios',
  'Encanto Semijoias', 'Essência Boutique', 'Estúdio Íris', 'Flor de Sal', 'Gema Rara', 'Glamour Store',
  'Jardim de Prata', 'Joia Boa', 'Lápis-Lazúli', 'Lótus Concept', 'Luar Acessórios', 'Maré Alta', 'Meu Brilho',
  'Mimo Chic', 'Mulher Ouro', 'Nácar Store', 'Olhar de Cigana', 'Ouro & Cor', 'Pérola Negra', 'Pietra Boutique',
  'Rosa dos Ventos', 'Sal & Brilho', 'Sereia Store', 'Solar Acessórios', 'Tânia Bijoux', 'Terra Brasilis',
  'Trama Fina', 'Vitrine da Lu', 'Zélia Concept', 'Âmbar Store', 'Bela Prata', 'Coração de Ouro', 'Dália Boutique',
]
const PRENOMES = ['Ana', 'Bruna', 'Carla', 'Daniela', 'Elisa', 'Fabiana', 'Gabriela', 'Helena', 'Isabela', 'Joana', 'Karina', 'Letícia', 'Mariana', 'Natália', 'Olívia', 'Patrícia', 'Rafaela', 'Sabrina', 'Tatiana', 'Vanessa', 'Yasmin', 'Aline', 'Priscila', 'Renata', 'Simone']
const SOBRENOMES = ['Andrade', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferraz', 'Gomes', 'Hernandes', 'Lacerda', 'Machado', 'Nogueira', 'Oliveira', 'Pires', 'Queiroz', 'Ribeiro', 'Siqueira', 'Toledo', 'Vieira', 'Zanetti', 'Moura']

export function buildSeed(): Database {
  const r = rng(20261006)
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)]
  const between = (a: number, b: number) => a + r() * (b - a)
  const intBetween = (a: number, b: number) => Math.floor(between(a, b + 1))
  const hoje = today()
  let seq = 0
  const id = (p: string) => `${p}${(++seq).toString(36)}`

  const colaboradores: Colaborador[] = [
    { id: 'c-camila', nome: 'Camila Rocha', cargo: 'vendedora', regiao: 'Capital SP — Zona Sul / Centro', email: 'camila@mariadolores.com.br', telefone: '(11) 98888-1001', metaMensal: 95000, metaAtivacao: 0.7, ativo: true },
    { id: 'c-juliana', nome: 'Juliana Prado', cargo: 'vendedora', regiao: 'Capital SP — Oeste / Norte', email: 'juliana@mariadolores.com.br', telefone: '(11) 98888-1002', metaMensal: 90000, metaAtivacao: 0.7, ativo: true },
    { id: 'c-beatriz', nome: 'Beatriz Lima', cargo: 'vendedora', regiao: 'Capital SP — Leste / Grande SP', email: 'beatriz@mariadolores.com.br', telefone: '(11) 98888-1003', metaMensal: 85000, metaAtivacao: 0.7, ativo: true },
    { id: 'c-renata', nome: 'Renata Alves', cargo: 'representante', regiao: 'Campinas e Sorocaba', email: 'renata.rep@mariadolores.com.br', telefone: '(19) 97777-2001', metaMensal: 60000, metaAtivacao: 0.7, ativo: true },
    { id: 'c-marcos', nome: 'Marcos Teixeira', cargo: 'representante', regiao: 'Vale do Paraíba e Baixada', email: 'marcos.rep@mariadolores.com.br', telefone: '(12) 97777-2002', metaMensal: 45000, metaAtivacao: 0.7, ativo: true },
    { id: 'c-fernanda', nome: 'Fernanda Souza', cargo: 'representante', regiao: 'Interior, Sul de Minas e MS', email: 'fernanda.rep@mariadolores.com.br', telefone: '(16) 97777-2003', metaMensal: 45000, metaAtivacao: 0.7, ativo: true },
    { id: 'c-larissa', nome: 'Larissa Mendes', cargo: 'analista', regiao: 'Leads e expansão — todas as regiões', email: 'larissa@mariadolores.com.br', telefone: '(11) 98888-1004', metaMensal: 0, metaAtivacao: 0.7, ativo: true },
  ]

  const responsavelPorRegiao = (regiao: string) => {
    if (regiao.includes('Zona Sul') || regiao.includes('Centro')) return 'c-camila'
    if (regiao.includes('Zona Oeste') || regiao.includes('Zona Norte')) return 'c-juliana'
    if (regiao.includes('Zona Leste') || regiao === 'Grande SP') return 'c-beatriz'
    if (regiao.includes('Campinas') || regiao.includes('Sorocaba')) return 'c-renata'
    if (regiao.includes('Vale') || regiao.includes('Baixada')) return 'c-marcos'
    return 'c-fernanda'
  }

  // ---------- Clientes / revendas ----------
  const clientes: Cliente[] = []
  const propensao: Record<string, number> = {}
  const ticket: Record<string, number> = {}
  const usados = new Set<string>()
  CIDADES.forEach(([cidade, uf, regiao]) => {
    // exclusividade: uma revenda por cidade/bairro
    {
      let nome = pick(NOMES_LOJA)
      while (usados.has(nome)) {
        const base = pick(NOMES_LOJA)
        nome = `${base} ${pick(['Store', 'Concept', 'Atelier', 'Boutique', 'Acessórios', 'Joias', 'Bijoux', 'Prime'].filter((s) => !base.includes(s)))}`
      }
      usados.add(nome)
      const cid = id('cli')
      const pessoa = `${pick(PRENOMES)} ${pick(SOBRENOMES)}`
      const cadastro = addDays(hoje, -(r() < 0.07 ? intBetween(15, 80) : intBetween(120, 1400)))
      clientes.push({
        id: cid,
        nome,
        responsavelNome: pessoa,
        documento: `${intBetween(10, 99)}.${intBetween(100, 999)}.${intBetween(100, 999)}/0001-${intBetween(10, 99)}`,
        tipo: r() < 0.55 ? 'revenda' : r() < 0.75 ? 'loja_multimarca' : 'consultora',
        cidade,
        uf,
        regiao,
        telefone: `(${uf === 'MG' ? 35 : uf === 'MS' ? 67 : pick([11, 11, 19, 12, 13, 16, 15, 14])}) 9${intBetween(1000, 9999)}-${intBetween(1000, 9999)}`,
        email: `${nome.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@gmail.com`,
        instagram: '@' + nome.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''),
        responsavelId: responsavelPorRegiao(regiao),
        status: 'ativa',
        dataCadastro: cadastro,
        aniversario: `${String(intBetween(1, 12)).padStart(2, '0')}-${String(intBetween(1, 28)).padStart(2, '0')}`,
        limiteCredito: pick([5000, 8000, 10000, 15000, 20000, 30000]),
      })
      propensao[cid] = r() < 0.2 ? between(0.05, 0.18) : between(0.28, 0.85)
      ticket[cid] = between(1800, r() < 0.2 ? 14000 : 7000)
    }
  })

  // Revendas que vão cair (encerramento previsto) e encerradas
  const motivosQueda = ['Inadimplência recorrente', 'Fechamento da loja', 'Baixo volume de compras', 'Migrou para marca concorrente', 'Mudança de cidade', 'Não renovou contrato de exclusividade']
  const candidatos = clientes.filter((c) => propensao[c.id] < 0.2)
  candidatos.slice(0, 7).forEach((c, i) => {
    c.status = 'em_queda'
    c.quedaData = addDays(hoje, [6, 14, 21, 33, 45, 62, 88][i])
    c.quedaMotivo = motivosQueda[i % motivosQueda.length]
  })
  candidatos.slice(7, 11).forEach((c, i) => {
    c.status = 'encerrada'
    c.quedaData = addDays(hoje, -[20, 48, 95, 160][i])
    c.quedaMotivo = motivosQueda[(i + 2) % motivosQueda.length]
  })

  // ---------- Pedidos (13 meses) ----------
  const pedidos: Pedido[] = []
  const colecoes = ['Inverno 26 — Noite de Lua', 'Alto Verão 26 — Mar Aberto', 'Resort 26 — Jardim Secreto', 'Verão 27 — Sol de Dolores']
  const inicioHist = addMonths(startOfMonth(hoje), -12)
  for (let m = 0; m <= 12; m++) {
    const mesIni = addMonths(inicioHist, m)
    const sazonal = [0.85, 0.8, 0.95, 1, 1.15, 0.95, 0.9, 1, 1.05, 1.1, 1.25, 1.35][Number(mesIni.slice(5, 7)) - 1]
    const colecao = colecoes[Math.min(3, Math.floor(m / 3.3))]
    clientes.forEach((c) => {
      if (c.dataCadastro > mesIni) return
      if (c.status === 'encerrada' && c.quedaData && c.quedaData < mesIni) return
      // Mês atual: só até hoje
      const dia = intBetween(1, 28)
      const data = addDays(mesIni, dia - 1)
      if (data > hoje) return
      let p = propensao[c.id] * sazonal
      if (m === 12) p *= 0.75
      if (r() < p) {
        const canal = c.responsavelId.startsWith('c-renata') || c.responsavelId.startsWith('c-marcos') || c.responsavelId.startsWith('c-fernanda')
          ? (r() < 0.8 ? 'representante' : 'online')
          : (r() < 0.65 ? 'showroom' : 'online')
        const valor = Math.round(ticket[c.id] * between(0.6, 1.5) * sazonal / 10) * 10
        pedidos.push({
          id: id('ped'),
          clienteId: c.id,
          responsavelId: c.responsavelId,
          data,
          valor,
          pecas: Math.round(valor / between(38, 62)),
          canal,
          colecao,
          status: m === 12 && r() < 0.15 ? 'pendente' : r() < 0.03 ? 'cancelado' : 'faturado',
        })
      }
    })
  }

  // ---------- Títulos / débitos ----------
  const titulos: Titulo[] = []
  pedidos.filter((p) => p.status === 'faturado').forEach((p) => {
    const parcelas = p.valor > 6000 ? 3 : p.valor > 3000 ? 2 : 1
    const cli = clientes.find((c) => c.id === p.clienteId)!
    const maPagadora = propensao[cli.id] < 0.2 || cli.status === 'em_queda'
    for (let k = 1; k <= parcelas; k++) {
      const venc = addDays(p.data, 30 * k)
      const valor = Math.round((p.valor / parcelas) * 100) / 100
      let valorPago = 0
      if (venc < hoje) {
        const recente = venc > addDays(hoje, -150)
        const atraso = maPagadora ? r() < 0.4 : recente && r() < 0.012
        valorPago = atraso ? (r() < 0.3 ? Math.round(valor * 0.5) : 0) : valor
      }
      titulos.push({ id: id('tit'), clienteId: p.clienteId, pedidoId: p.id, emissao: p.data, vencimento: venc, valor, valorPago, formaPagamento: pick(['Boleto', 'Boleto', 'Pix', 'Cartão']) })
    }
  })

  // ---------- Devoluções ----------
  const devolucoes: Devolucao[] = []
  pedidos.filter((p) => p.status === 'faturado' && r() < 0.06).forEach((p) => {
    const data = addDays(p.data, intBetween(5, 40))
    if (data > hoje) return
    const recente = data > addDays(hoje, -25)
    devolucoes.push({
      id: id('dev'), clienteId: p.clienteId, pedidoId: p.id, data,
      valor: Math.round(p.valor * between(0.05, 0.25)), pecas: intBetween(2, 18),
      motivo: pick(MOTIVOS_DEVOLUCAO),
      status: recente ? pick(['solicitada', 'em_analise', 'aprovada'] as const) : pick(['concluida', 'concluida', 'concluida', 'recusada'] as const),
    })
  })

  // ---------- Reclamações ----------
  const reclamacoes: Reclamacao[] = []
  const descricoes = [
    'Brinco com fecho frouxo em 3 peças do pedido.',
    'Pedido chegou com 4 dias de atraso, cliente final reclamou.',
    'Banho escurecendo em anel da coleção anterior.',
    'Boleto emitido com valor diferente do combinado.',
    'Faltaram 2 colares no pedido conferido.',
    'Caixa amassada, peças sem saquinho individual.',
    'Demora no retorno do WhatsApp do showroom.',
    'Pedido de reposição não foi separado no prazo.',
  ]
  for (let i = 0; i < 34; i++) {
    const c = pick(clientes)
    const data = addDays(hoje, -intBetween(0, 200))
    const status = data < addDays(hoje, -30) ? (r() < 0.9 ? 'resolvida' : 'em_andamento') : pick(['aberta', 'em_andamento', 'resolvida'] as const)
    reclamacoes.push({
      id: id('rec'), clienteId: c.id, data, categoria: pick(CATEGORIAS_RECLAMACAO), descricao: pick(descricoes),
      prioridade: pick(['baixa', 'media', 'media', 'alta'] as const), status, responsavelId: c.responsavelId,
      resolvidaEm: status === 'resolvida' ? addDays(data, intBetween(1, 12)) : undefined,
      solucao: status === 'resolvida' ? pick(['Troca enviada no próximo pedido', 'Crédito concedido', 'Boleto reemitido', 'Peças repostas via motoboy']) : undefined,
    })
  }

  // ---------- Brindes ----------
  const brindes: Brinde[] = [
    { id: 'b-saquinho', nome: 'Saquinho de veludo MD', categoria: 'Embalagem', estoque: 820, estoqueMinimo: 300, custoUnitario: 2.4, regraConcessao: '1 por peça em pedidos acima de R$ 1.500' },
    { id: 'b-caixa', nome: 'Caixa presente rígida', categoria: 'Embalagem', estoque: 140, estoqueMinimo: 150, custoUnitario: 7.9, regraConcessao: '10 por pedido acima de R$ 3.000' },
    { id: 'b-expositor', nome: 'Expositor de acrílico dourado', categoria: 'PDV', estoque: 18, estoqueMinimo: 10, custoUnitario: 89, regraConcessao: 'Revendas novas e pedidos acima de R$ 8.000' },
    { id: 'b-catalogo', nome: 'Catálogo impresso da coleção', categoria: 'Material de venda', estoque: 260, estoqueMinimo: 100, custoUnitario: 14, regraConcessao: '2 por revenda a cada lançamento' },
    { id: 'b-ecobag', nome: 'Ecobag Maria Dolores', categoria: 'Mimo', estoque: 75, estoqueMinimo: 60, custoUnitario: 18.5, regraConcessao: 'Eventos e aniversário de revenda' },
    { id: 'b-flanela', nome: 'Kit flanela + guia de cuidados', categoria: 'Pós-venda', estoque: 410, estoqueMinimo: 200, custoUnitario: 3.2, regraConcessao: '1 por cliente final (revenda repassa)' },
    { id: 'b-espelho', nome: 'Espelho de mesa com logo', categoria: 'PDV', estoque: 6, estoqueMinimo: 8, custoUnitario: 64, regraConcessao: 'Lojas multimarca curva A' },
    { id: 'b-vela', nome: 'Vela aromática Dolores', categoria: 'Mimo', estoque: 48, estoqueMinimo: 30, custoUnitario: 32, regraConcessao: 'Top 10 do trimestre e convidadas VIP' },
  ]

  // ---------- Eventos ----------
  const ev = (
    dias: number, titulo: string, tipo: Evento['tipo'], local: string, colecao: string, responsavelId: string,
    metaFaturamento: number, metaClientes: number, custo: number, convidados: number, duracao = 0,
  ): Evento => {
    const dataInicio = addDays(hoje, dias)
    return {
      id: id('ev'), titulo, tipo, dataInicio, dataFim: addDays(dataInicio, duracao), horario: '14h às 20h', local, colecao,
      responsavelId, status: dias < 0 ? 'realizado' : dias < 21 ? 'confirmado' : 'planejado', metaFaturamento, metaClientes, custo, convidados,
    }
  }
  const eventos: Evento[] = [
    ev(-215, 'Lançamento Inverno 26 — Noite de Lua', 'lancamento', 'Showroom SP — Jardins', colecoes[0], 'c-camila', 180000, 45, 9500, 70, 1),
    ev(-170, 'Encontro de Revendas Interior', 'encontro_revendas', 'Hotel Vila Galé — Campinas', colecoes[0], 'c-renata', 90000, 25, 6200, 35),
    ev(-130, 'Workshop: Vitrine que vende', 'workshop', 'Showroom SP — Jardins', colecoes[1], 'c-larissa', 30000, 20, 2100, 30),
    ev(-115, 'Lançamento Alto Verão 26 — Mar Aberto', 'lancamento', 'Showroom SP — Jardins', colecoes[1], 'c-juliana', 200000, 50, 11000, 80, 1),
    ev(-75, 'Pop-up Feira Mega Moda Negócios', 'feira', 'Expo Center Norte', colecoes[2], 'c-beatriz', 120000, 40, 14500, 0, 2),
    ev(-52, 'Live de reposição Resort', 'live', 'Instagram @mariadolores', colecoes[2], 'c-larissa', 40000, 30, 800, 0),
    ev(-24, 'Lançamento Verão 27 — Sol de Dolores', 'lancamento', 'Showroom SP — Jardins', colecoes[3], 'c-camila', 220000, 55, 12500, 85, 1),
    ev(-9, 'Atendimento VIP — Curva A', 'atendimento_vip', 'Showroom SP — Jardins', colecoes[3], 'c-juliana', 80000, 12, 1800, 14),
    ev(4, 'Workshop: Instagram para revendas', 'workshop', 'Showroom SP — Jardins', colecoes[3], 'c-larissa', 25000, 25, 1500, 35),
    ev(12, 'Encontro de Revendas Vale & Litoral', 'encontro_revendas', 'Hotel em São José dos Campos', colecoes[3], 'c-marcos', 70000, 18, 4800, 25),
    ev(26, 'Esquenta Black Friday & Natal', 'feira', 'Showroom SP — Jardins', colecoes[3], 'c-beatriz', 160000, 45, 7000, 60, 1),
    ev(47, 'Atendimento VIP — Natal', 'atendimento_vip', 'Showroom SP — Jardins', colecoes[3], 'c-camila', 90000, 15, 2200, 16),
    ev(75, 'Pré-lançamento Inverno 27', 'lancamento', 'Showroom SP — Jardins', 'Inverno 27', 'c-camila', 240000, 60, 13000, 90, 1),
  ]
  // Resultados dos eventos realizados + pedidos de evento
  eventos.filter((e) => e.status === 'realizado').forEach((e) => {
    const desempenho = between(0.7, 1.25)
    const presentes = Math.max(5, Math.round(e.metaClientes * between(0.75, 1.15)))
    const pool = clientes.filter((c) => c.status !== 'encerrada').sort(() => r() - 0.5).slice(0, Math.round(presentes * 0.7))
    e.clientesPresentes = presentes
    e.revendasIds = pool.map((c) => c.id)
    e.novosCadastros = intBetween(1, 7)
    e.leadsGerados = intBetween(3, 22)
    e.nps = Math.round(between(7.6, 9.8) * 10) / 10
    e.pecasVendidas = 0
    e.aprendizados = pick([
      'Brincos maxi foram o destaque; faltou grade de anéis.',
      'Revendas pediram condição especial para pedidos acima de R$ 10 mil.',
      'Horário estendido funcionou; pico de público às 18h.',
      'Kit vitrine com expositor aumentou o ticket médio.',
      'Precisamos confirmar presença com 48h de antecedência.',
    ])
    pool.forEach((c) => {
      const valor = Math.round((e.metaFaturamento / pool.length) * desempenho * between(0.5, 1.5) / 10) * 10
      e.pecasVendidas! += Math.round(valor / 48)
      pedidos.push({ id: id('ped'), clienteId: c.id, responsavelId: c.responsavelId, data: e.dataInicio, valor, pecas: Math.round(valor / 48), canal: 'evento', colecao: e.colecao, eventoId: e.id, status: 'faturado' })
    })
  })

  // ---------- Movimentos de brinde ----------
  const movBrindes: MovimentoBrinde[] = []
  brindes.forEach((b) => movBrindes.push({ id: id('mb'), brindeId: b.id, data: addDays(hoje, -200), tipo: 'entrada', quantidade: b.estoque + intBetween(80, 400), motivo: 'Compra / reposição de estoque' }))
  eventos.filter((e) => e.status === 'realizado').forEach((e) => {
    ;['b-ecobag', 'b-catalogo', 'b-vela'].forEach((bid) => movBrindes.push({ id: id('mb'), brindeId: bid, data: e.dataInicio, tipo: 'saida', quantidade: intBetween(8, 40), eventoId: e.id, motivo: 'Distribuição no evento' }))
  })
  pedidos.filter((p) => p.valor > 8000 && p.data > addDays(hoje, -120)).forEach((p) => {
    movBrindes.push({ id: id('mb'), brindeId: pick(['b-expositor', 'b-caixa', 'b-espelho']), data: p.data, tipo: 'saida', quantidade: intBetween(1, 3), clienteId: p.clienteId, motivo: 'Bonificação por volume de pedido' })
  })

  // ---------- Campanhas e criativos ----------
  const campanhas: Campanha[] = [
    { id: 'cp-meta-lal', nome: 'Seja Revenda MD — Lookalike lojistas', plataforma: 'meta', objetivo: 'Cadastro de leads', publico: 'Mulheres 25-50, lojistas e empreendedoras SP/MG', status: 'ativa', inicio: addDays(hoje, -120), orcamentoMensal: 600 },
    { id: 'cp-meta-rmk', nome: 'Remarketing catálogo Verão 27', plataforma: 'meta', objetivo: 'Conversão (WhatsApp)', publico: 'Visitantes do site e engajamento IG 90d', status: 'ativa', inicio: addDays(hoje, -30), orcamentoMensal: 400 },
    { id: 'cp-meta-inv', nome: 'Seja Revenda — Inverno 26', plataforma: 'meta', objetivo: 'Cadastro de leads', publico: 'Interesses: semijoias, moda, empreendedorismo', status: 'encerrada', inicio: addDays(hoje, -240), fim: addDays(hoje, -121), orcamentoMensal: 1000 },
    { id: 'cp-g-search', nome: 'Pesquisa — Revender semijoias', plataforma: 'google', objetivo: 'Leads (formulário do site)', publico: 'Palavras-chave: revender semijoias, semijoias atacado, fornecedor de semijoias', status: 'ativa', inicio: addDays(hoje, -200), orcamentoMensal: 700 },
    { id: 'cp-g-pmax', nome: 'Performance Max — Atacado SP', plataforma: 'google', objetivo: 'Leads', publico: 'SP e Sul de MG, sinais de público lojista', status: 'ativa', inicio: addDays(hoje, -60), orcamentoMensal: 300 },
    { id: 'cp-g-display', nome: 'Display — Lojistas multimarca', plataforma: 'google', objetivo: 'Alcance', publico: 'Afinidade: varejo de moda', status: 'pausada', inicio: addDays(hoje, -150), orcamentoMensal: 0 },
  ]
  const cr = (campanhaId: string, nome: string, formato: Criativo['formato'], headline: string, copy: string, imp: number, ctr: number, cvr: number, inv: number, conv: number, ativo = true): Criativo => {
    const cliques = Math.round(imp * ctr)
    return { id: id('cr'), campanhaId, nome, formato, headline, copy, impressoes: imp, cliques, leads: Math.round(cliques * cvr), conversoes: conv, investido: inv, ativo }
  }
  const criativos: Criativo[] = [
    cr('cp-meta-lal', 'Reels — Bastidores do ateliê', 'reels', 'Do ateliê para a sua vitrine', 'Design autoral, banho de qualidade e margem de até 2,5x. Seja revenda Maria Dolores.', 48200, 0.0185, 0.11, 260, 3),
    cr('cp-meta-lal', 'Carrossel — Margem e kit inicial', 'carrossel', 'Quanto você lucra revendendo MD', 'Pedido mínimo acessível, kit vitrine e suporte do showroom. Toque e cadastre-se.', 39500, 0.0142, 0.09, 210, 2),
    cr('cp-meta-lal', 'Imagem — Depoimento revenda', 'imagem', '"Minha loja dobrou o ticket"', 'Revendas Maria Dolores contam como as peças autorais giram rápido.', 22100, 0.0098, 0.07, 130, 0, false),
    cr('cp-meta-rmk', 'Stories — Catálogo Sol de Dolores', 'stories', 'A coleção Verão 27 chegou', 'Peças solares, irreverentes e com a assinatura MD. Peça o catálogo no WhatsApp.', 30500, 0.021, 0.06, 190, 1),
    cr('cp-meta-rmk', 'Vídeo — Unboxing pedido revenda', 'video', 'Assim chega o seu pedido', 'Embalagem premium, saquinhos de veludo e mimo para suas clientes.', 18800, 0.0165, 0.08, 160, 1),
    cr('cp-meta-inv', 'Imagem — Noite de Lua', 'imagem', 'Seja revenda da coleção Noite de Lua', 'Semijoias autorais com DNA irreverente.', 61000, 0.0105, 0.06, 880, 2, false),
    cr('cp-g-search', 'RSA — Revender semijoias', 'pesquisa', 'Revenda Semijoias de Design | Maria Dolores', 'Marca autoral de Curitiba. Exclusividade por região. Cadastre sua loja.', 9800, 0.072, 0.085, 560, 4),
    cr('cp-g-search', 'RSA — Semijoias atacado SP', 'pesquisa', 'Semijoias no Atacado em SP | Showroom MD', 'Visite nosso showroom em SP. Pedido mínimo acessível e frete grátis.', 7400, 0.061, 0.07, 420, 2),
    cr('cp-g-pmax', 'PMax — Conjunto Lojistas', 'display', 'Semijoias autorais para sua loja', 'Exclusividade de região, kit vitrine e coleções a cada temporada.', 52000, 0.0068, 0.05, 290, 1),
    cr('cp-g-display', 'Banner — Multimarcas', 'display', 'A marca que falta na sua vitrine', 'Maria Dolores: design, irreverência e paixão pelos detalhes.', 74000, 0.0031, 0.03, 240, 0, false),
  ]

  // ---------- Leads ----------
  const leads: Lead[] = []
  const etapasPeso: [EtapaLead, number][] = [['novo', 0.18], ['contato', 0.2], ['qualificado', 0.15], ['proposta', 0.1], ['negociacao', 0.07], ['ganho', 0.1], ['perdido', 0.2]]
  const pickEtapa = () => {
    let x = r()
    for (const [e, w] of etapasPeso) { if ((x -= w) < 0) return e }
    return 'novo' as EtapaLead
  }
  const origens: [OrigemLead, number][] = [['meta', 0.38], ['google', 0.26], ['prospeccao', 0.2], ['indicacao', 0.07], ['evento', 0.06], ['organico', 0.03]]
  const pickOrigem = () => {
    let x = r()
    for (const [o, w] of origens) { if ((x -= w) < 0) return o }
    return 'meta' as OrigemLead
  }
  const todasCidades = [...CIDADES, ...CIDADES_ALVO, ...CIDADES_ALVO]
  for (let i = 0; i < 150; i++) {
    const origem = pickOrigem()
    const [cidade, uf] = pick(todasCidades)
    const entrada = addDays(hoje, -intBetween(0, 150))
    const antiga = entrada < addDays(hoje, -60)
    let etapa = pickEtapa()
    if (antiga && ['novo', 'contato'].includes(etapa)) etapa = r() < 0.6 ? 'perdido' : 'qualificado'
    const camps = campanhas.filter((c) => c.plataforma === origem && (c.status !== 'encerrada' || antiga))
    const camp = camps.length ? pick(camps) : undefined
    const crs = camp ? criativos.filter((c) => c.campanhaId === camp.id) : []
    const nome = `${pick(PRENOMES)} ${pick(SOBRENOMES)}`
    leads.push({
      id: id('lead'), nome, empresa: r() < 0.6 ? `${pick(['Loja', 'Boutique', 'Espaço', 'Ateliê', 'Studio'])} ${pick(SOBRENOMES)}` : 'Pessoa física',
      cidade, uf, telefone: `(11) 9${intBetween(1000, 9999)}-${intBetween(1000, 9999)}`, email: `${nome.split(' ')[0].toLowerCase()}${intBetween(1, 99)}@gmail.com`,
      origem, campanhaId: camp?.id, criativoId: crs.length ? pick(crs).id : undefined, etapa,
      responsavelId: 'c-larissa', dataEntrada: entrada, ultimaInteracao: [addDays(entrada, intBetween(0, 20)), hoje].sort()[0],
      proximoPasso: ['ganho', 'perdido'].includes(etapa) ? undefined : pick(['Enviar catálogo digital', 'Agendar visita ao showroom', 'Ligar para qualificar', 'Enviar proposta de kit inicial', 'Checar disponibilidade da região']),
      valorPotencial: pick([2500, 3500, 5000, 8000, 12000]),
      motivoPerda: etapa === 'perdido' ? pick(['Região indisponível (exclusividade)', 'Sem capital para pedido mínimo', 'Sem retorno', 'Preferiu concorrente', 'Pessoa física sem CNPJ']) : undefined,
      rdStationId: origem !== 'prospeccao' ? `rd-${intBetween(100000, 999999)}` : undefined,
    })
  }

  // ---------- Bloqueios de território ----------
  const territorios: TerritorioBloqueio[] = [
    { id: id('ter'), cidade: 'São Paulo — Jardins', uf: 'SP', regiao: 'Capital SP — Centro', tipo: 'bloqueada', motivo: 'Raio de proteção da loja própria / showroom' },
    { id: id('ter'), cidade: 'Curitiba', uf: 'PR', regiao: 'Outros estados', tipo: 'bloqueada', motivo: 'Praça atendida pela matriz' },
    { id: id('ter'), cidade: 'Atibaia', uf: 'SP', regiao: 'Campinas e região', tipo: 'reservada', motivo: 'Negociação avançada com lead indicado', ate: addDays(hoje, 30) },
    { id: id('ter'), cidade: 'Praia Grande', uf: 'SP', regiao: 'Baixada Santista', tipo: 'prioritaria', motivo: 'Alta demanda de leads, prioridade de abertura' },
    { id: id('ter'), cidade: 'Uberlândia', uf: 'MG', regiao: 'Outros estados', tipo: 'prioritaria', motivo: 'Cidade polo sem revenda' },
  ]

  // ---------- Visitas ao showroom ----------
  const visitas: Visita[] = []
  for (let i = 0; i < 14; i++) {
    const c = pick(clientes.filter((x) => x.status === 'ativa' && x.responsavelId.match(/camila|juliana|beatriz/)))
    const dias = intBetween(-10, 14)
    visitas.push({
      id: id('vis'), clienteId: c.id, nomeVisitante: c.responsavelNome, data: addDays(hoje, dias), horario: pick(['10h', '11h', '14h', '15h30', '17h']),
      responsavelId: c.responsavelId, objetivo: pick(['Reposição de coleção', 'Conhecer lançamento', 'Montagem de vitrine', 'Negociação de débito']),
      status: dias < 0 ? pick(['realizada', 'realizada', 'no_show'] as const) : 'agendada',
    })
  }
  leads.filter((l) => l.etapa === 'proposta' || l.etapa === 'negociacao').slice(0, 4).forEach((l, i) => {
    visitas.push({ id: id('vis'), leadId: l.id, nomeVisitante: `${l.nome} (lead)`, data: addDays(hoje, 1 + i * 2), horario: '16h', responsavelId: 'c-larissa', objetivo: 'Apresentação para nova revenda', status: 'agendada' })
  })

  // ---------- Atendimentos (follow-up) ----------
  const atendimentos: Atendimento[] = []
  const resumos = ['Apresentei a coleção nova pelo WhatsApp', 'Visita ao showroom para reposição', 'Conversa sobre giro das peças da última compra', 'Ligação para entender por que parou de comprar', 'Envio de pré-seleção pelo perfil da loja']
  clientes.filter((c) => c.status !== 'encerrada').forEach((c) => {
    const n = intBetween(0, 4)
    let d = addDays(hoje, -intBetween(40, 120))
    for (let k = 0; k < n; k++) {
      d = addDays(d, intBetween(7, 30))
      if (d > hoje) break
      const res = pick(['pedido', 'sem_pedido', 'agendou', 'sem_retorno'] as const)
      atendimentos.push({
        id: id('at'), clienteId: c.id, responsavelId: c.responsavelId, data: d, tipo: pick(['whatsapp', 'whatsapp', 'showroom', 'ligacao', 'visita_rep'] as const),
        resultado: res, resumo: pick(resumos), proximoContato: addDays(d, pick([7, 15, 15, 30])), proximoPasso: pick(['Enviar pré-seleção da coleção', 'Conversar sobre giro', 'Convidar para o lançamento', 'Confirmar pedido']),
      })
    }
    // a maioria das revendas tem o próximo contato já combinado para os próximos dias
    const ult = atendimentos[atendimentos.length - 1]
    if (ult && ult.clienteId === c.id && ult.proximoContato && ult.proximoContato < hoje && r() < 0.85) ult.proximoContato = addDays(hoje, intBetween(1, 20))
    if (r() < 0.5) {
      c.publicoFinal = pick(['Mulheres 30-50, classe A/B', 'Jovens 20-30, ticket médio', 'Noivas e festas', 'Executivas, peças discretas'])
      c.oQueGira = pick(['Brincos maxi e argolas', 'Colares curtos dourados', 'Anéis com pedras coloridas', 'Pulseiras finas para composição'])
      c.preferencias = pick(['Prefere atendimento pelo WhatsApp à tarde', 'Gosta de ver as peças pessoalmente', 'Compra sempre no lançamento', 'Pede kit vitrine junto com o pedido'])
    }
  })

  const tarefas: Tarefa[] = [
    { id: id('t'), titulo: 'Confirmar presenças do Workshop Instagram', responsavelId: 'c-larissa', prazo: addDays(hoje, 1), concluida: false, relacionado: 'Evento' },
    { id: id('t'), titulo: 'Cobrar títulos vencidos > 30 dias da carteira', responsavelId: 'c-beatriz', prazo: addDays(hoje, 2), concluida: false, relacionado: 'Débitos' },
    { id: id('t'), titulo: 'Subir novos criativos Verão 27 no Meta', responsavelId: 'c-larissa', prazo: addDays(hoje, 3), concluida: false, relacionado: 'Tráfego' },
    { id: id('t'), titulo: 'Repor caixas presente (estoque abaixo do mínimo)', responsavelId: 'c-camila', prazo: addDays(hoje, 5), concluida: false, relacionado: 'Brindes' },
    { id: id('t'), titulo: 'Visitar revendas inativas de Campinas', responsavelId: 'c-renata', prazo: addDays(hoje, 7), concluida: false, relacionado: 'Ativação' },
    { id: id('t'), titulo: 'Enviar relatório do lançamento Verão 27', responsavelId: 'c-camila', prazo: addDays(hoje, -2), concluida: true, relacionado: 'Evento' },
  ]

  return {
    config: { ...DEFAULT_CONFIG },
    colaboradores, clientes, pedidos, devolucoes, reclamacoes, titulos, brindes, movBrindes, eventos,
    leads, campanhas, criativos, territorios, visitas, tarefas, atendimentos,
  }
}

export function emptyDatabase(): Database {
  return {
    config: { ...DEFAULT_CONFIG }, colaboradores: [], clientes: [], pedidos: [], devolucoes: [], reclamacoes: [], titulos: [],
    brindes: [], movBrindes: [], eventos: [], leads: [], campanhas: [], criativos: [], territorios: [], visitas: [], tarefas: [], atendimentos: [],
  }
}

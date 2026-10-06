# Maria Dolores · Gestão do Showroom SP

Plataforma de gestão à vista do Showroom São Paulo da Maria Dolores: equipe comercial, carteira de revendas, faturamento, pós-venda, débitos, brindes, eventos, leads, tráfego pago e expansão por território.

## Como rodar

```bash
npm install
npm run dev      # ambiente de desenvolvimento (http://localhost:5173)
npm run build    # gera a versão estática em dist/
```

A pasta `dist/` pode ser publicada em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages, S3). Não precisa de servidor.

### Versão de página única

`npm run build:artifact` gera `dist-artifact/maria-dolores-showroom.html`, um arquivo único com CSS e JS embutidos (usado para publicar a plataforma como link no claude.ai).

## Abas

| Aba | O que mostra |
|---|---|
| **Visão geral** | Faturamento x meta, ativação da base (meta de 70%), ticket médio, devoluções, débitos vencidos, ranking da equipe, próximos eventos, revendas que vão cair, leads e a lista "Atenção hoje" |
| **Equipe & metas** | Cada vendedora e representante com meta de faturamento e meta de ativação de 70% da **própria** carteira, quantas revendas faltam ativar, devoluções, reclamações e débitos da carteira. A analista comercial aparece com os indicadores de leads |
| **Carteira de revendas** | Base completa com curva ABC, última compra, ativação no período, débito vencido, aniversariantes e ativação por região. Clique numa revenda para abrir a visão 360° (pedidos, financeiro, pós-venda, eventos e brindes) |
| **Faturamento** | Bruto, devoluções, líquido, ticket médio e pedidos pendentes, com quebras por canal, coleção e pessoa. Ao lançar um pedido, os boletos podem ser gerados automaticamente |
| **Devoluções & reclamações** | Motivos, valores, status, prioridade e tempo médio de resolução |
| **Débitos** | Títulos em aberto, aging dos vencidos, inadimplência dos últimos 12 meses e prioridade de cobrança |
| **Brindes** | Estoque, estoque mínimo, regra de concessão e movimentações por revenda ou evento, com o custo de cada uma |
| **Eventos** | Calendário mensal do showroom (com as visitas agendadas) e o resultado de cada evento: revendas presentes e compradoras, clientes, faturamento, atingimento da meta, ROI (o custo inclui os brindes), NPS, peças, leads e aprendizados |
| **Agenda & tarefas** | Visitas ao showroom, tarefas da equipe, aniversários de revendas e follow-ups de leads |
| **Leads** | Funil em kanban (arrastar e soltar), lista e análise: funil de conversão, leads por semana e por origem (Meta, Google, prospecção fria, indicação, evento), CPL, CAC e motivos de perda. Importa CSV do RD Station. Cada lead mostra se a cidade dele está disponível |
| **Tráfego & criativos** | Verba planejada de R$ 2.000/mês (50% Meta, 50% Google) comparada ao orçamento ativo, campanhas, galeria de criativos com CTR, leads, CPL e revendas geradas, ranking dos melhores criativos e leituras automáticas (o que escalar, o que pausar) |
| **Expansão & territórios** | Linha do tempo das revendas que vão cair (data, cidade, região, motivo), mapa de cidades por região (ocupada, vai liberar, disponível, prioritária, reservada, bloqueada), leads prontos para avançar e leads em espera |
| **Configurações** | Metas gerais, verba de mídia, regras de alerta, backup e restauração em JSON, e opção de zerar a base |

O seletor de período no topo (mês, mês anterior, trimestre, semestre, ano, 12 meses) vale para todas as abas. As metas mensais são multiplicadas pelo número de meses do período.

## Regras de negócio

- **Ativação**: uma revenda está ativa quando tem pelo menos um pedido faturado no período. A base considerada são as revendas ativas mais as que vão cair; as encerradas ficam de fora.
- **Revenda que vai cair**: em Carteira (editar) ou em Expansão (registrar), informe a data e o motivo. Até essa data, a cidade aparece como "vai liberar". Depois dela, ou ao confirmar o encerramento, a cidade passa a "disponível".
- **Exclusividade**: as cidades (ou bairros, na capital) com revenda ativa ficam como "ocupada". Para marcar uma cidade como prioritária, reservada ou bloqueada, use "Cidade / bloqueio".
- **Curva ABC**: calculada sobre o faturamento dos últimos 12 meses (A = 80% do faturamento, B = 15%, C = 5%).

## Dados

- Na primeira abertura, a plataforma carrega **dados de demonstração** para a equipe explorar. Em Configurações › "Zerar base", você começa com os dados reais.
- Os dados ficam salvos no navegador (localStorage). Faça backup em Configurações e use o arquivo para levar os dados para outro computador.
- Todas as tabelas exportam para CSV (separador `;`, abre direto no Excel).

## Integrações

- **RD Station**: exporte os contatos em CSV e use Leads › "Importar do RD Station". As colunas Nome, E-mail, Celular, Cidade, Estado, Origem e Estágio do funil são reconhecidas automaticamente, e e-mails já cadastrados são ignorados.
- **Meta Ads / Google Ads**: atualize os números de cada criativo a partir dos relatórios de anúncio.
- **Próximo passo sugerido**: um banco de dados na nuvem (ex.: Supabase) para a equipe usar ao mesmo tempo, mais sincronização automática com RD Station, Meta e Google por API.

## Stack

React 18, TypeScript, Vite, React Router e Recharts. A identidade visual usa Cormorant Garamond (títulos) e Jost (interface). A paleta vem da identidade da marca: fundo gesso claro, monograma MD em ouro cobre (#C58941 → #9D6937) e rosé como cor de apoio. O modo noturno é opcional e usa tons de cacau, sem preto.

# Dashboard Comercial Omni · v1

Duas abas: **Geral** (HubSpot, ao vivo) e **Receita** (Book Receita - Sales Omni). A faixa de receita também aparece no topo da Geral.

```
public/index.html      a página (sem dependências, gráficos em SVG)
api/dados.js           GET /api/dados   negócios, leads, empresas e donos do HubSpot (app privado)
api/receita.js         GET /api/receita big numbers do Book, via Google Sheets API
lib/normalize.js       formato único dos negócios (API e preview)
lib/receita.js         leitura da aba Book pelos rótulos das linhas
middleware.js          usuário e senha na porta (todas as rotas)
scripts/build-preview.js  gera preview.html com uma foto dos dados embutida
```

## Subir na Vercel

1. Coloque esta pasta num repositório do GitHub e importe na Vercel (Framework: **Other**, sem build).
2. Em **Settings → Environment Variables**, crie:

| Variável | O que é |
|---|---|
| `HUBSPOT_TOKEN` | Token do app privado do HubSpot. Escopos: `crm.objects.deals.read`, `crm.objects.companies.read`, `crm.objects.leads.read`, `crm.objects.owners.read` |
| `GOOGLE_SA_EMAIL` | E-mail da conta de serviço do Google Cloud (com a Google Sheets API ativada) |
| `GOOGLE_SA_PRIVATE_KEY` | Chave privada dessa conta (o campo `private_key` do JSON, inteiro) |
| `DASH_USER` / `DASH_PASSWORD` | Login que o time usa para abrir o dashboard |
| `BOOK_SHEET_ID` (opcional) | Padrão: o Book atual |
| `BOOK_RANGE` (opcional) | Padrão: `Book!A1:BZ25` |

3. Compartilhe o Book Receita com o e-mail da conta de serviço, como **Leitor**.
4. Deploy. Os dados ficam em cache por 5 min (HubSpot) e 10 min (Book).

O token e a chave nunca vão para o navegador: só as funções em `api/` falam com o HubSpot e o Google.

## Regras de negócio

- **Modalidade**: pipeline Expansão Distribuidor = Distribuidor. Em Novos Negócios RH, vale o Tipo de Venda (direta, intermediador, distribuidor). Captação Parceiros = Novos Parceiros (não soma receita).
- **Negócio aberto**: chegou à etapa gatilho (Coleta de informações em RH e Captação, Proposta em Distribuidor), mesmo que depois tenha sido ganho ou perdido. Data: primeira data de entrada a partir do gatilho; sem ela, a criação.
- **Migração Pipedrive**: datas de etapa entre 10 e 16/08/2026 em negócios criados antes disso caem para a criação.
- **Etapa avançada**: depois de Negociação sempre; em Negociação só com "Negociação avançada" marcado.
- **Leads**: objeto Lead do HubSpot (pipelines Campanha RH, Inbound RH e Inbound Só Email). Parceiros aparecem à parte.
- **Ganhos e Perdidos**: pela data de fechamento dentro do período.
- **Metas de abertura**: até out/26 VD 20, INT 10, DIST 10; de nov/26 em diante VD 30, INT 15, DIST 15 (divisão da Indireta provisória), Parceiros 50.
- **Pipe coverage** (definido por Matteo em 17/11/2026): pipe em aberto ÷ média mensal ganha nos 6 meses fechados anteriores.

## Preview sem servidor

`node scripts/build-preview.js <pasta> preview.html` junta `deals_raw.json` (propriedades cruas do HubSpot por ID) e `extra.json` (donos, parceiros, leads por dia, receita) numa página única.

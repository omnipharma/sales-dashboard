// Formato único que a página consome, venha o dado da API do HubSpot (Vercel)
// ou da foto usada no preview. Mudou aqui, muda nos dois lugares.

const PIPES = ['905377457', '909751331', '905381684']; // RH, Distribuidor, Captação

// Propriedades de data de entrada em etapa. O pipeline Distribuidor não tem
// essas propriedades ligadas no HubSpot, então lá a abertura usa a criação.
const STAGE_DATE_PROPS = [
  'hs_v2_date_entered_1370199980', // RH · Coleta de informações (gatilho)
  'hs_v2_date_entered_1370199981', // RH · Proposta
  'hs_v2_date_entered_1370199982', // RH · Negociação
  'hs_v2_date_entered_1370199983', // RH · Contratação
  'hs_v2_date_entered_1370127123', // Captação · Coleta de informações (gatilho)
];

const DEAL_PROPS = [
  'dealname', 'pipeline', 'dealstage', 'amount', 'tipo_de_venda', 'createdate',
  'closedate', 'hs_is_closed_won', 'hs_is_closed_lost', 'negociacao_avancada',
  'hubspot_owner_id', ...STAGE_DATE_PROPS,
];

// "Empresa - Venda Indireta via Intermediador (Via MDS)" -> "Empresa".
// O nome do negócio vem com o tipo de venda colado por automação.
function empresaDoNome(nome) {
  return String(nome || '')
    .replace(/\s*-\s*Venda\s+(Direta|Indireta).*$/i, '')
    .replace(/\s*\(Via [^)]*\)\s*$/i, '')
    .trim();
}

const bool = (v) => v === true || String(v).toLowerCase() === 'true';
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function normalizeDeal(id, p, extras = {}) {
  const datas = {};
  STAGE_DATE_PROPS.forEach((k) => {
    if (p[k]) datas[k.replace('hs_v2_date_entered_', '')] = p[k];
  });
  return {
    id: String(id),
    nome: p.dealname || '',
    empresa: extras.empresa || empresaDoNome(p.dealname),
    parceiro: extras.parceiro || null,
    pipeline: p.pipeline,
    stage: p.dealstage,
    amount: num(p.amount),
    tipo: p.tipo_de_venda || null,
    criado: p.createdate || null,
    fechado: p.closedate || null,
    ganho: bool(p.hs_is_closed_won),
    perdido: bool(p.hs_is_closed_lost),
    negAv: bool(p.negociacao_avancada),
    dono: extras.dono || null,
    datas,
  };
}

// Data local de São Paulo (UTC-3, sem horário de verão desde 2019).
function diaSP(iso) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function agregaLeads(leads) {
  const m = new Map();
  leads.forEach((l) => {
    if (!l.criado) return;
    const k = l.pipeline + '|' + diaSP(l.criado);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].map(([k, n]) => {
    const [p, d] = k.split('|');
    return [p, d, n];
  });
}

module.exports = { PIPES, DEAL_PROPS, STAGE_DATE_PROPS, empresaDoNome, normalizeDeal, agregaLeads, diaSP };

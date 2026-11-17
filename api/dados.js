// GET /api/dados · negócios e leads do HubSpot, lidos com o token do app privado.
// O token fica só na variável de ambiente HUBSPOT_TOKEN da Vercel.
// Escopos do app privado: crm.objects.deals.read, crm.objects.companies.read,
// crm.objects.leads.read, crm.objects.owners.read.

const { PIPES, DEAL_PROPS, normalizeDeal, agregaLeads } = require('../lib/normalize');

const API = 'https://api.hubapi.com';
const ROTULO_PARCEIRO = 'parceiro'; // rótulo customizado da associação negócio x empresa
const PRIMARY_TYPE_ID = 5; // associação primária negócio -> empresa (definida pelo HubSpot)

async function hs(path, { method = 'GET', body } = {}, tentativa = 0) {
  const r = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.HUBSPOT_TOKEN,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // A busca do HubSpot limita a poucas chamadas por segundo: espera e tenta de novo.
  if (r.status === 429 && tentativa < 4) {
    await new Promise((ok) => setTimeout(ok, 1100 * (tentativa + 1)));
    return hs(path, { method, body }, tentativa + 1);
  }
  if (!r.ok) throw new Error(`HubSpot ${r.status} em ${path}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function buscaTudo(objeto, body) {
  const out = [];
  let after;
  do {
    const j = await hs(`/crm/v3/objects/${objeto}/search`, {
      method: 'POST',
      body: { ...body, limit: 200, after },
    });
    out.push(...j.results);
    after = j.paging && j.paging.next && j.paging.next.after;
  } while (after);
  return out;
}

const lotes = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function associacoes(dealIds) {
  // deal -> [{empresaId, rotulos[]}]
  const mapa = {};
  for (const lote of lotes(dealIds, 100)) {
    const j = await hs('/crm/v4/associations/deals/companies/batch/read', {
      method: 'POST',
      body: { inputs: lote.map((id) => ({ id })) },
    });
    (j.results || []).forEach((r) => {
      mapa[String(r.from.id)] = (r.to || []).map((t) => ({
        empresaId: String(t.toObjectId),
        primaria: (t.associationTypes || []).some((a) => a.typeId === PRIMARY_TYPE_ID),
        parceiro: (t.associationTypes || []).some((a) => String(a.label || '').toLowerCase() === ROTULO_PARCEIRO),
      }));
    });
  }
  return mapa;
}

async function nomesEmpresas(ids) {
  const nomes = {};
  for (const lote of lotes([...new Set(ids)], 100)) {
    const j = await hs('/crm/v3/objects/companies/batch/read', {
      method: 'POST',
      body: { inputs: lote.map((id) => ({ id })), properties: ['name'] },
    });
    (j.results || []).forEach((c) => { nomes[String(c.id)] = c.properties.name; });
  }
  return nomes;
}

async function donos() {
  const j = await hs('/crm/v3/owners?limit=500&archived=false');
  const j2 = await hs('/crm/v3/owners?limit=500&archived=true').catch(() => ({ results: [] }));
  const m = {};
  [...(j.results || []), ...(j2.results || [])].forEach((o) => {
    m[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email;
  });
  return m;
}

module.exports = async (req, res) => {
  if (!process.env.HUBSPOT_TOKEN) {
    res.status(500).json({ erro: 'Falta a variável HUBSPOT_TOKEN no projeto da Vercel.' });
    return;
  }
  try {
    const anoPassado = new Date().getUTCFullYear() - 1;
    const desde = `${anoPassado}-12-01T00:00:00Z`;
    const inicioAno = `${anoPassado + 1}-01-01T00:00:00Z`;
    const noPipe = { propertyName: 'pipeline', operator: 'IN', values: PIPES };

    // Mesmo recorte do preview: criados desde dez do ano passado, em aberto,
    // ou fechados no ano corrente.
    const brutos = await buscaTudo('deals', {
      properties: DEAL_PROPS,
      filterGroups: [
        { filters: [noPipe, { propertyName: 'createdate', operator: 'GTE', value: desde }] },
        { filters: [noPipe, { propertyName: 'hs_is_closed', operator: 'EQ', value: 'false' }] },
        { filters: [noPipe, { propertyName: 'closedate', operator: 'GTE', value: inicioAno }] },
      ],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
    });

    const [assoc, owners] = await Promise.all([associacoes(brutos.map((d) => d.id)), donos()]);
    const nomes = await nomesEmpresas(Object.values(assoc).flat().map((a) => a.empresaId));

    const deals = brutos.map((d) => {
      const as = assoc[String(d.id)] || [];
      const parceiros = as.filter((a) => a.parceiro).map((a) => nomes[a.empresaId]).filter(Boolean);
      const primaria = as.find((a) => a.primaria && !a.parceiro);
      return normalizeDeal(d.id, d.properties, {
        empresa: primaria ? nomes[primaria.empresaId] : null,
        parceiro: parceiros.length ? [...new Set(parceiros)].sort().join(', ') : null,
        dono: owners[String(d.properties.hubspot_owner_id)] || null,
      });
    });

    const leads = await buscaTudo('leads', {
      properties: ['hs_pipeline', 'hs_createdate'],
      filterGroups: [{ filters: [{ propertyName: 'hs_createdate', operator: 'GTE', value: desde }] }],
    });
    const leadsDia = agregaLeads(leads.map((l) => ({ pipeline: l.properties.hs_pipeline, criado: l.properties.hs_createdate })));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    res.status(200).json({ atualizadoEm: new Date().toISOString(), deals, leadsDia });
  } catch (e) {
    res.status(502).json({ erro: String(e.message || e) });
  }
};

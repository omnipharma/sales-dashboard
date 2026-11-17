// Gera preview.html: a mesma página, com uma foto dos dados embutida, para ver
// sem servidor (Artifact do Claude ou abrindo o arquivo no navegador).
// Uso: node scripts/build-preview.js <pasta-com-deals_raw.json-e-extra.json> <saida.html> [AAAA-MM-DDTHH:MM:SSZ]

const fs = require('fs');
const path = require('path');
const { normalizeDeal } = require('../lib/normalize');

const [dir, saida, quando] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(path.join(dir, 'deals_raw.json'), 'utf8'));
const extra = JSON.parse(fs.readFileSync(path.join(dir, 'extra.json'), 'utf8'));

const deals = Object.entries(raw).map(([id, p]) => normalizeDeal(id, p, {
  parceiro: extra.parceiros[id] || null,
  dono: extra.owners[String(p.hubspot_owner_id)] || null,
}));

const snap = {
  dados: { atualizadoEm: quando || new Date().toISOString(), deals, leadsDia: extra.leadsDia },
  receita: { atualizadoEm: quando || new Date().toISOString(), ...extra.receita },
};

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const marca = '<script id="snapshot" type="application/json">null</script>';
if (!html.includes(marca)) throw new Error('Marcador do snapshot não encontrado em index.html');
const json = JSON.stringify(snap).replace(/</g, '\\u003c');
fs.writeFileSync(saida, html.replace(marca, `<script id="snapshot" type="application/json">${json}</script>`));
console.log(`preview: ${deals.length} negócios, ${extra.leadsDia.length} dias de leads -> ${saida}`);

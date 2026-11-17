// Lê a aba Book do "Book Receita - Sales Omni" (valores sem formatação) e
// devolve as séries mensais que o dashboard usa. Procura as linhas pelo rótulo,
// não pela posição, para sobreviver a linhas novas inseridas na planilha.

const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

// Cabeçalho de mês: número de série do Sheets (data) ou texto "nov.-26".
function mesDoCabecalho(v) {
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const m = String(v || '').toLowerCase().match(/^([a-zç]{3})\.?[-/ ]?(\d{2,4})$/);
  if (!m || !MESES[m[1]]) return null;
  const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  return `${ano}-${String(MESES[m[1]]).padStart(2, '0')}`;
}

function numero(v) {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  if (typeof v === 'number') return v;
  // texto em pt-BR: "2.186.217", "(0,5%)", "8,81%"
  let s = String(v).trim();
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  const pct = s.endsWith('%');
  s = s.replace(/[()%\s-]/g, '').replace(/\./g, '').replace(',', '.');
  if (s === '') return null;
  let n = Number(s);
  if (Number.isNaN(n)) return null;
  if (pct) n /= 100;
  return neg ? -n : n;
}

const norm = (s) => String(s || '').trim().toLowerCase();

function parseBook(rows) {
  // Linha de cabeçalho: a que tem mais células reconhecidas como mês.
  let hIdx = -1, best = 0;
  rows.slice(0, 15).forEach((r, i) => {
    const n = r.filter((c) => mesDoCabecalho(c)).length;
    if (n > best) { best = n; hIdx = i; }
  });
  if (hIdx < 0) throw new Error('Não achei a linha de meses no Book.');
  const header = rows[hIdx];
  const cols = [];
  header.forEach((c, j) => { const m = mesDoCabecalho(c); if (m) cols.push([j, m]); });

  const porRotulo = (rotulo, coluna = 6) => rows.find((r) => norm(r[coluna]) === norm(rotulo));
  const serie = (rotulo) => {
    const r = porRotulo(rotulo);
    return cols.map(([j]) => (r ? numero(r[j]) : null));
  };
  const celula = (rotuloC) => {
    const r = rows.find((x) => norm(x[2]).startsWith(norm(rotuloC)));
    return r ? numero(r[4]) : null;
  };

  const mrr = serie('MRR Total');
  const contratada = serie('Contratada');
  return {
    fonte: 'Book Receita - Sales Omni, aba Book',
    inicio: cols[0][1],
    meses: cols.map(([, m]) => m),
    mrr,
    contratada: contratada.map((v, i) => (v == null ? mrr[i] : v)),
    upsell: serie('Em Upsell').map((v) => v || 0),
    emContratacao: serie('Em Contratação').map((v) => v || 0),
    pctMeta: serie('% da meta cheia global'),
    meta2026: celula('Meta 2026: 100%'),
    piso2026: celula('Meta 2026: 85%'),
    cagrYtd: celula('CAGR YTD'),
  };
}

module.exports = { parseBook, mesDoCabecalho, numero };

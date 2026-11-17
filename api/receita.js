// GET /api/receita · big numbers do Book Receita, via Google Sheets API.
// Autentica com uma conta de serviço do Google Cloud. A planilha precisa estar
// compartilhada (leitor) com o e-mail dessa conta.
// Variáveis: GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY, e opcionais BOOK_SHEET_ID e BOOK_RANGE.

const crypto = require('crypto');
const { parseBook } = require('../lib/receita');

const SHEET_ID = process.env.BOOK_SHEET_ID || '1-ktLNf7hpU97vZrrTb2L2xXlvlbwrLLbtXlwxuzhjAM';
const RANGE = process.env.BOOK_RANGE || 'Book!A1:BZ25';

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function tokenGoogle() {
  const agora = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: process.env.GOOGLE_SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  }));
  // A Vercel guarda a chave com "\n" literais: devolve as quebras de linha.
  const chave = (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const assinatura = crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(chave);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${b64url(assinatura)}`,
    }),
  });
  if (!r.ok) throw new Error('Google recusou a conta de serviço: ' + (await r.text()).slice(0, 200));
  return (await r.json()).access_token;
}

module.exports = async (req, res) => {
  if (!process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY) {
    res.status(500).json({ erro: 'Faltam GOOGLE_SA_EMAIL e GOOGLE_SA_PRIVATE_KEY no projeto da Vercel.' });
    return;
  }
  try {
    const token = await tokenGoogle();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}`
      + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error(`Sheets ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const { values } = await r.json();
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
    res.status(200).json({ atualizadoEm: new Date().toISOString(), ...parseBook(values || []) });
  } catch (e) {
    res.status(502).json({ erro: String(e.message || e) });
  }
};

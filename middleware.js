// Senha na porta: o dashboard mostra receita e pipeline, então nada abre sem
// usuário e senha. Variáveis DASH_USER e DASH_PASSWORD na Vercel.
// Se o time tiver plano Pro, dá para trocar isto pela "Vercel Authentication".

export const config = { matcher: '/:path*' };

export default function middleware(request) {
  const user = process.env.DASH_USER;
  const pass = process.env.DASH_PASSWORD;
  if (!user || !pass) {
    return new Response('Configure DASH_USER e DASH_PASSWORD no projeto da Vercel.', { status: 503 });
  }
  const auth = request.headers.get('authorization') || '';
  const [tipo, valor] = auth.split(' ');
  if (tipo === 'Basic' && valor) {
    const [u, ...resto] = atob(valor).split(':');
    if (u === user && resto.join(':') === pass) return; // segue para a página ou a API
  }
  return new Response('Acesso restrito', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Dashboard Comercial Omni", charset="UTF-8"' },
  });
}

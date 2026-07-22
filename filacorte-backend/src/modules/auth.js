const { collection, uid } = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const jwt = require('../utils/jwt');
const Router = require('../utils/router');

const router = new Router();

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// POST /api/auth/register
// Cadastro de uma nova barbearia + seu usuário dono/barbeiro principal.
// Cria automaticamente: tenant (com 7 dias de teste grátis) + user + plano básico de cortes.
router.post('/register', (req, res) => {
  const { shopName, ownerName, email, password, phone } = req.body || {};
  if (!shopName || !ownerName || !email || !password) {
    return res.status(400).json({ error: 'Preencha nome da barbearia, seu nome, e-mail e senha.' });
  }

  const existing = collection('users').findOne((u) => u.email === email);
  if (existing) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  }

  let slug = slugify(shopName);
  let suffix = 1;
  while (collection('tenants').findOne((t) => t.slug === slug)) {
    slug = `${slugify(shopName)}-${suffix++}`;
  }

  const tenant = collection('tenants').insert({
    name: shopName,
    slug,
    hours: 'Seg–Sáb · 09h às 20h',
    address: '',
    whatsapp: phone || '',
    plan: 'Básico',
    status: 'ativo',
    trial: true,
    trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  const user = collection('users').insert({
    tenantId: tenant.id,
    name: ownerName,
    email,
    passwordHash: hashPassword(password),
    role: 'barbeiro', // dono/gestor da barbearia
  });

  collection('barbers').insert({ tenantId: tenant.id, name: ownerName });

  const token = jwt.sign({ userId: user.id, tenantId: tenant.id, role: user.role, email: user.email });
  return res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, trial: tenant.trial },
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }
  const user = collection('users').findOne((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }
  const token = jwt.sign({ userId: user.id, tenantId: user.tenantId || null, role: user.role, email: user.email });
  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId || null },
  });
});

// POST /api/auth/forgot-password
// Em produção isso dispararia um e-mail com link de redefinição (ex: via
// provedor tipo SendGrid/SES). Aqui devolvemos um token de reset de exemplo.
router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const user = collection('users').findOne((u) => u.email === email);
  // Não revelamos se o e-mail existe ou não, por segurança.
  if (user) {
    const resetToken = jwt.sign({ userId: user.id, purpose: 'password-reset' }, 900); // 15 min
    // TODO produção: enviar `resetToken` por e-mail, nunca retornar na resposta da API.
    return res.json({ message: 'Se o e-mail existir, um link de redefinição foi enviado.', devResetToken: resetToken });
  }
  return res.json({ message: 'Se o e-mail existir, um link de redefinição foi enviado.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
  }
  try {
    const jwtLib = require('../utils/jwt');
    const payload = jwtLib.verify(resetToken);
    if (payload.purpose !== 'password-reset') throw new Error('Token inválido');
    collection('users').update(payload.userId, { passwordHash: hashPassword(newPassword) });
    return res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (e) {
    return res.status(400).json({ error: 'Token inválido ou expirado.' });
  }
});

// Garante que exista um superadmin no primeiro boot (a partir do .env)
function ensureSuperadmin(config) {
  const exists = collection('users').findOne((u) => u.role === 'superadmin');
  if (!exists) {
    collection('users').insert({
      tenantId: null,
      name: 'Administrador FilaCorte',
      email: config.superadmin.email,
      passwordHash: hashPassword(config.superadmin.password),
      role: 'superadmin',
    });
    console.log(`[seed] Superadmin criado: ${config.superadmin.email}`);
  }
}

module.exports = { router, ensureSuperadmin, slugify };

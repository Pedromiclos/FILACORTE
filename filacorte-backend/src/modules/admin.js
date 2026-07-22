const { collection } = require('../db');
const Router = require('../utils/router');
const { requireAuth, requireRole } = require('../middleware/auth');
const { slugify } = require('./auth');

const router = new Router();

// Todas as rotas exigem login como "superadmin" (equipe FilaCorte).
router.get('/tenants', requireAuth, requireRole('superadmin'), (req, res) => {
  return res.json({ tenants: collection('tenants').find(() => true) });
});

router.post('/tenants', requireAuth, requireRole('superadmin'), (req, res) => {
  const { name, plan, whatsapp } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nome da barbearia é obrigatório.' });
  let slug = slugify(name), suffix = 1;
  while (collection('tenants').findOne((t) => t.slug === slug)) slug = `${slugify(name)}-${suffix++}`;
  const tenant = collection('tenants').insert({
    name, slug, hours: 'Seg–Sáb · 09h às 20h', address: '', whatsapp: whatsapp || '',
    plan: plan || 'Básico', status: 'ativo', trial: true, trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return res.status(201).json({ tenant });
});

router.patch('/tenants/:id/suspend', requireAuth, requireRole('superadmin'), (req, res) => {
  const tenant = collection('tenants').findById(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Barbearia não encontrada.' });
  const status = tenant.status === 'ativo' ? 'suspenso' : 'ativo';
  const updated = collection('tenants').update(tenant.id, { status });
  return res.json({ tenant: updated });
});

router.patch('/tenants/:id/trial', requireAuth, requireRole('superadmin'), (req, res) => {
  const tenant = collection('tenants').findById(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Barbearia não encontrada.' });
  const updated = collection('tenants').update(tenant.id, {
    trial: !tenant.trial,
    trialEndsAt: !tenant.trial ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null,
  });
  return res.json({ tenant: updated });
});

router.patch('/tenants/:id/plan', requireAuth, requireRole('superadmin'), (req, res) => {
  const { plan } = req.body || {};
  const tenant = collection('tenants').findById(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Barbearia não encontrada.' });
  const updated = collection('tenants').update(tenant.id, { plan });
  return res.json({ tenant: updated });
});

router.delete('/tenants/:id', requireAuth, requireRole('superadmin'), (req, res) => {
  const ok = collection('tenants').delete(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Barbearia não encontrada.' });
  return res.json({ ok: true });
});

// ---- Planos ----
router.get('/plans', requireAuth, requireRole('superadmin'), (req, res) => {
  return res.json({ plans: collection('plans').find(() => true) });
});

router.post('/plans', requireAuth, requireRole('superadmin'), (req, res) => {
  const { name, price, features } = req.body || {};
  if (!name || price == null) return res.status(400).json({ error: 'Nome e preço são obrigatórios.' });
  const plan = collection('plans').insert({ name, price: Number(price), features: features || [] });
  return res.status(201).json({ plan });
});

// ---- Dashboard financeiro ----
router.get('/dashboard', requireAuth, requireRole('superadmin'), (req, res) => {
  const tenants = collection('tenants').find(() => true);
  const plans = collection('plans').find(() => true);
  const priceByPlan = Object.fromEntries(plans.map((p) => [p.name, p.price]));
  const mrr = tenants
    .filter((t) => t.status === 'ativo' && !t.trial)
    .reduce((sum, t) => sum + (priceByPlan[t.plan] || 0), 0);
  return res.json({
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t) => t.status === 'ativo').length,
    trialTenants: tenants.filter((t) => t.trial).length,
    mrr,
  });
});

module.exports = { router };

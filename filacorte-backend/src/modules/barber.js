const { collection } = require('../db');
const Router = require('../utils/router');
const { requireAuth, requireRole, requireActiveTenant } = require('../middleware/auth');
const { waitingQueueFor } = require('./public');

const router = new Router();

const barberOnly = [requireAuth, requireRole('barbeiro'), requireActiveTenant];

// Todas as rotas abaixo exigem login como "barbeiro" (dono/gestor da barbearia)
// e operam SEMPRE restritas ao tenantId do usuário logado — isolamento multi-tenant.
router.get('/queue', ...barberOnly, (req, res) => {
  const waiting = waitingQueueFor(req.user.tenantId);
  return res.json({ queue: waiting });
});

router.post('/queue/manual', ...barberOnly, (req, res) => {
  const { name, phone, barberId, cutId, notes } = req.body || {};
  if (!name || !barberId || !cutId) {
    return res.status(400).json({ error: 'Nome, barbeiro e corte são obrigatórios.' });
  }
  const all = collection('queue').find((q) => q.tenantId === req.user.tenantId);
  const entry = collection('queue').insert({
    tenantId: req.user.tenantId,
    ticket: 100 + all.length + 1,
    name, phone: phone || '', barberId, cutId, beard: false, notes: notes || '',
    status: 'waiting',
  });
  return res.status(201).json({ entry });
});

function assertOwnership(req, res, entry) {
  if (!entry || entry.tenantId !== req.user.tenantId) {
    res.status(404).json({ error: 'Cliente não encontrado na fila desta barbearia.' });
    return false;
  }
  return true;
}

router.post('/queue/:id/finish', ...barberOnly, (req, res) => {
  const entry = collection('queue').findById(req.params.id);
  if (!assertOwnership(req, res, entry)) return;
  const updated = collection('queue').update(entry.id, { status: 'finished', finishedAt: Date.now() });
  return res.json({ entry: updated });
});

router.post('/queue/:id/cancel', ...barberOnly, (req, res) => {
  const entry = collection('queue').findById(req.params.id);
  if (!assertOwnership(req, res, entry)) return;
  const updated = collection('queue').update(entry.id, { status: 'cancelled' });
  return res.json({ entry: updated });
});

router.post('/queue/:id/skip', ...barberOnly, (req, res) => {
  const entry = collection('queue').findById(req.params.id);
  if (!assertOwnership(req, res, entry)) return;
  // Reenvia para o fim da fila: simplesmente atualiza um campo de ordenação.
  const updated = collection('queue').update(entry.id, { skippedAt: Date.now(), createdAt: Date.now() });
  return res.json({ entry: updated });
});

// ---- Cortes (catálogo) ----
router.get('/cuts', ...barberOnly, (req, res) => {
  return res.json({ cuts: collection('cuts').find((c) => c.tenantId === req.user.tenantId) });
});

router.post('/cuts', ...barberOnly, (req, res) => {
  const { name, desc, price, time, icon } = req.body || {};
  if (!name || price == null || !time) {
    return res.status(400).json({ error: 'Nome, preço e tempo são obrigatórios.' });
  }
  const cut = collection('cuts').insert({
    tenantId: req.user.tenantId, name, desc: desc || '', price: Number(price), time: Number(time), icon: icon || '✂️',
  });
  return res.status(201).json({ cut });
});

router.patch('/cuts/:id', ...barberOnly, (req, res) => {
  const cut = collection('cuts').findById(req.params.id);
  if (!cut || cut.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Corte não encontrado.' });
  const updated = collection('cuts').update(cut.id, req.body || {});
  return res.json({ cut: updated });
});

router.delete('/cuts/:id', ...barberOnly, (req, res) => {
  const cut = collection('cuts').findById(req.params.id);
  if (!cut || cut.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Corte não encontrado.' });
  collection('cuts').delete(cut.id);
  return res.json({ ok: true });
});

// ---- Barbeiros (equipe) ----
router.get('/barbers', ...barberOnly, (req, res) => {
  return res.json({ barbers: collection('barbers').find((b) => b.tenantId === req.user.tenantId) });
});

router.post('/barbers', ...barberOnly, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
  const barber = collection('barbers').insert({ tenantId: req.user.tenantId, name });
  return res.status(201).json({ barber });
});

router.delete('/barbers/:id', ...barberOnly, (req, res) => {
  const barber = collection('barbers').findById(req.params.id);
  if (!barber || barber.tenantId !== req.user.tenantId) return res.status(404).json({ error: 'Barbeiro não encontrado.' });
  collection('barbers').delete(barber.id);
  return res.json({ ok: true });
});

// ---- Faturamento e histórico ----
router.get('/revenue', ...barberOnly, (req, res) => {
  const finished = collection('queue').find((q) => q.tenantId === req.user.tenantId && q.status === 'finished');
  const cuts = collection('cuts').find((c) => c.tenantId === req.user.tenantId);
  const cutMap = Object.fromEntries(cuts.map((c) => [c.id, c]));
  const total = finished.reduce((sum, f) => sum + (cutMap[f.cutId]?.price || 0), 0);
  return res.json({
    totalRevenue: total,
    clientsServed: finished.length,
    averageTicket: finished.length ? total / finished.length : 0,
  });
});

router.get('/history', ...barberOnly, (req, res) => {
  const history = collection('queue')
    .find((q) => q.tenantId === req.user.tenantId && q.status !== 'waiting')
    .sort((a, b) => b.createdAt - a.createdAt);
  return res.json({ history });
});

module.exports = { router };

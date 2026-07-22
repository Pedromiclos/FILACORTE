const { collection } = require('../db');
const Router = require('../utils/router');

const router = new Router();

function getTenantBySlug(slug) {
  return collection('tenants').findOne((t) => t.slug === slug);
}

function waitingQueueFor(tenantId) {
  return collection('queue')
    .find((q) => q.tenantId === tenantId && q.status === 'waiting')
    .sort((a, b) => a.createdAt - b.createdAt);
}

function nextTicketNumber(tenantId) {
  const all = collection('queue').find((q) => q.tenantId === tenantId);
  return 100 + all.length + 1;
}

// GET /api/public/:slug — dados da barbearia para a tela inicial do cliente
router.get('/:slug', (req, res) => {
  const tenant = getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status !== 'ativo') {
    return res.status(404).json({ error: 'Barbearia não encontrada ou indisponível.' });
  }
  const barbers = collection('barbers').find((b) => b.tenantId === tenant.id);
  const cuts = collection('cuts').find((c) => c.tenantId === tenant.id);
  return res.json({
    shop: {
      name: tenant.name, slug: tenant.slug, hours: tenant.hours,
      address: tenant.address, whatsapp: tenant.whatsapp,
    },
    barbers: barbers.map((b) => ({ id: b.id, name: b.name })),
    cuts,
    peopleInQueue: waitingQueueFor(tenant.id).length,
  });
});

// POST /api/public/:slug/queue — cliente entra na fila
router.post('/:slug/queue', (req, res) => {
  const tenant = getTenantBySlug(req.params.slug);
  if (!tenant || tenant.status !== 'ativo') {
    return res.status(404).json({ error: 'Barbearia não encontrada ou indisponível.' });
  }
  const { name, phone, barberId, cutId, beard, notes } = req.body || {};
  if (!name || !phone || !barberId || !cutId) {
    return res.status(400).json({ error: 'Preencha nome, telefone, barbeiro e corte.' });
  }
  const cut = collection('cuts').findOne((c) => c.id === cutId && c.tenantId === tenant.id);
  if (!cut) return res.status(400).json({ error: 'Corte inválido.' });

  const entry = collection('queue').insert({
    tenantId: tenant.id,
    ticket: nextTicketNumber(tenant.id),
    name, phone, barberId, cutId,
    beard: !!beard,
    notes: notes || '',
    status: 'waiting',
  });
  return res.status(201).json({ entry, positionInfo: positionInfo(entry) });
});

function positionInfo(entry) {
  const waiting = waitingQueueFor(entry.tenantId);
  const idx = waiting.findIndex((q) => q.id === entry.id);
  const peopleAhead = idx === -1 ? 0 : idx;
  return {
    position: idx === -1 ? null : idx + 1,
    peopleAhead,
    estimatedMinutes: peopleAhead * 25,
    status: entry.status,
  };
}

// GET /api/public/:slug/queue/:entryId — status atual do ticket do cliente (polling)
router.get('/:slug/queue/:entryId', (req, res) => {
  const entry = collection('queue').findById(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Ticket não encontrado.' });
  return res.json({ entry, positionInfo: positionInfo(entry) });
});

// DELETE /api/public/:slug/queue/:entryId — cliente desiste da fila
router.delete('/:slug/queue/:entryId', (req, res) => {
  const entry = collection('queue').findById(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Ticket não encontrado.' });
  const updated = collection('queue').update(entry.id, { status: 'cancelled' });
  return res.json({ entry: updated });
});

// POST /api/public/:slug/queue/:entryId/rating — avaliação pós-atendimento
router.post('/:slug/queue/:entryId/rating', (req, res) => {
  const { stars, comment } = req.body || {};
  const entry = collection('queue').findById(req.params.entryId);
  if (!entry) return res.status(404).json({ error: 'Ticket não encontrado.' });
  if (entry.status !== 'finished') {
    return res.status(400).json({ error: 'Só é possível avaliar atendimentos finalizados.' });
  }
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Nota deve ser de 1 a 5 estrelas.' });
  }
  const rating = collection('ratings').insert({
    tenantId: entry.tenantId, entryId: entry.id, stars, comment: comment || '',
  });
  return res.status(201).json({ rating });
});

module.exports = { router, waitingQueueFor, positionInfo };

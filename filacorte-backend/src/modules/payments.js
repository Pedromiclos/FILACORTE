// ---------------------------------------------------------------------------
// Módulo de pagamentos.
//
// IMPORTANTE: esta é uma camada de INTEGRAÇÃO, propositalmente deixada como
// stub/mock. Para produção, ela precisa ser conectada aos SDKs oficiais:
//   npm install stripe mercadopago axios
// e as chaves reais devem vir de config.js (já lido do .env).
//
// O objetivo aqui é já deixar prontos: o formato das rotas, o fluxo de
// criação de assinatura, e os endpoints de webhook que cada gateway vai
// chamar quando um pagamento for confirmado/falhar — só falta plugar a
// chamada real ao SDK de cada provedor nos pontos marcados com TODO.
// ---------------------------------------------------------------------------

const { collection } = require('../db');
const Router = require('../utils/router');
const { requireAuth, requireRole } = require('../middleware/auth');
const config = require('../config');

const router = new Router();

// POST /api/payments/checkout — inicia uma assinatura para a barbearia logada
router.post('/checkout', requireAuth, requireRole('barbeiro'), (req, res) => {
  const { provider, planName } = req.body || {}; // provider: 'stripe' | 'mercadopago' | 'asaas' | 'pix' | 'boleto'
  const tenant = collection('tenants').findById(req.user.tenantId);
  const plan = collection('plans').findOne((p) => p.name === planName);
  if (!tenant || !plan) return res.status(400).json({ error: 'Barbearia ou plano inválido.' });

  switch (provider) {
    case 'stripe':
      // TODO produção:
      // const stripe = require('stripe')(config.payments.stripeSecretKey);
      // const session = await stripe.checkout.sessions.create({
      //   mode: 'subscription',
      //   line_items: [{ price: PRICE_ID_DO_PLANO, quantity: 1 }],
      //   success_url: `${APP_URL}/assinatura/sucesso`,
      //   cancel_url: `${APP_URL}/assinatura/cancelado`,
      //   client_reference_id: tenant.id,
      // });
      // return res.json({ checkoutUrl: session.url });
      return res.json({ checkoutUrl: `https://checkout.stripe.com/mock/${tenant.id}`, mock: true });

    case 'mercadopago':
      // TODO produção: usar SDK "mercadopago" para criar uma "preference"
      // com back_urls e external_reference = tenant.id.
      return res.json({ checkoutUrl: `https://mercadopago.com/mock-checkout/${tenant.id}`, mock: true });

    case 'asaas':
      // TODO produção: chamar POST /v3/subscriptions da API do Asaas
      // (cobrança recorrente via boleto, cartão ou PIX).
      return res.json({ checkoutUrl: `https://asaas.com/mock-checkout/${tenant.id}`, mock: true });

    case 'pix':
    case 'boleto':
      // TODO produção: gerar cobrança via Asaas ou Mercado Pago com o método escolhido.
      return res.json({
        message: `Cobrança via ${provider.toUpperCase()} gerada (simulada).`,
        mock: true,
        amount: plan.price,
      });

    default:
      return res.status(400).json({ error: 'Provedor de pagamento inválido. Use: stripe, mercadopago, asaas, pix ou boleto.' });
  }
});

// ---- Webhooks (chamados pelos gateways, não pelo app) ----

// POST /api/payments/webhooks/stripe
router.post('/webhooks/stripe', (req, res) => {
  // TODO produção: validar a assinatura do evento com config.payments.stripeWebhookSecret
  // const event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  const { tenantId, status } = req.body || {};
  applySubscriptionEvent(tenantId, status);
  return res.json({ received: true });
});

// POST /api/payments/webhooks/mercadopago
router.post('/webhooks/mercadopago', (req, res) => {
  const { tenantId, status } = req.body || {};
  applySubscriptionEvent(tenantId, status);
  return res.json({ received: true });
});

// POST /api/payments/webhooks/asaas
router.post('/webhooks/asaas', (req, res) => {
  const { tenantId, status } = req.body || {};
  applySubscriptionEvent(tenantId, status);
  return res.json({ received: true });
});

function applySubscriptionEvent(tenantId, status) {
  if (!tenantId) return;
  const tenant = collection('tenants').findById(tenantId);
  if (!tenant) return;
  if (status === 'paid' || status === 'active') {
    collection('tenants').update(tenant.id, { status: 'ativo', trial: false });
  } else if (status === 'failed' || status === 'cancelled') {
    collection('tenants').update(tenant.id, { status: 'suspenso' });
  }
}

module.exports = { router };

// Carrega variáveis de ambiente de um arquivo .env (implementação simples,
// sem depender do pacote "dotenv") e expõe a configuração da aplicação.

const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  });
}

loadDotEnv();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-nao-use-em-producao',
  jwtExpiresIn: parseInt(process.env.JWT_EXPIRES_IN || '604800', 10), // segundos
  superadmin: {
    email: process.env.SUPERADMIN_EMAIL || 'admin@filacorte.com',
    password: process.env.SUPERADMIN_PASSWORD || 'admin123',
  },
  payments: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    asaasApiKey: process.env.ASAAS_API_KEY || '',
  },
};

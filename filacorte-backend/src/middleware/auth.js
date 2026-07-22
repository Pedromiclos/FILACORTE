const jwt = require('../utils/jwt');
const { collection } = require('../db');

// Exige um token JWT válido no header Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token de acesso não informado.' });
  }
  try {
    const payload = jwt.verify(token);
    req.user = payload; // { userId, role, tenantId, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// Bloqueia o acesso de barbeiros cuja assinatura (tenant) esteja suspensa pelo
// admin do SaaS. Deve ser usado DEPOIS de requireAuth + requireRole('barbeiro').
function requireActiveTenant(req, res, next) {
  if (!req.user.tenantId) {
    return res.status(403).json({ error: 'Usuário não está vinculado a nenhuma barbearia.' });
  }
  const tenant = collection('tenants').findById(req.user.tenantId);
  if (!tenant) {
    return res.status(404).json({ error: 'Barbearia não encontrada.' });
  }
  if (tenant.status !== 'ativo') {
    return res.status(402).json({ error: 'Assinatura suspensa. Regularize o pagamento para continuar usando o FilaCorte.' });
  }
  next();
}

// Exige que o usuário autenticado tenha um dos papéis informados
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar este recurso.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireActiveTenant };

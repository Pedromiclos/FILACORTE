const Router = require('./utils/router');
const authModule = require('./modules/auth');
const publicModule = require('./modules/public');
const barberModule = require('./modules/barber');
const adminModule = require('./modules/admin');
const paymentsModule = require('./modules/payments');

const router = new Router();

router.use('/api/auth', authModule.router);
router.use('/api/public', publicModule.router);
router.use('/api/barber', barberModule.router);
router.use('/api/admin', adminModule.router);
router.use('/api/payments', paymentsModule.router);

// Healthcheck
router.get('/api/health', (req, res) => res.json({ ok: true, service: 'filacorte-backend' }));

module.exports = router;

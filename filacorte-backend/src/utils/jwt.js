// Implementação mínima de JWT (HS256), sem dependências externas.
// Compatível com o formato padrão (header.payload.signature em base64url),
// então dá para trocar por "jsonwebtoken" no futuro sem quebrar nada.

const crypto = require('crypto');
const config = require('../config');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf-8');
}

function sign(payload, expiresInSeconds = config.jwtExpiresIn) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const headerEnc = base64url(JSON.stringify(header));
  const payloadEnc = base64url(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${headerEnc}.${payloadEnc}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerEnc}.${payloadEnc}.${signature}`;
}

function verify(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token malformado');
  const [headerEnc, payloadEnc, signature] = parts;

  const expectedSig = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${headerEnc}.${payloadEnc}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Assinatura inválida');
  }

  const payload = JSON.parse(base64urlDecode(payloadEnc));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token expirado');
  }
  return payload;
}

module.exports = { sign, verify };

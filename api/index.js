const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Banco de dados em memória
let barbeiros = [];

// Auxiliar para pegar o domínio atual (Vercel ou local)
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

// 1. Enviar comprovante
app.post('/enviar-comprovante', (req, res) => {
  const { email, nomeBarbearia } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'E-mail válido é obrigatório.' });
  }

  const emailFormatado = email.toLowerCase().trim();
  const baseUrl = getBaseUrl(req);
  const slugFila = (nomeBarbearia || 'barbearia').toLowerCase().trim().replace(/\s+/g, '-');
  const linkFila = `${baseUrl}/fila/${slugFila}`;

  let barbeiro = barbeiros.find(b => b.email === emailFormatado);

  if (barbeiro) {
    barbeiro.status = 'pendente';
    barbeiro.nomeBarbearia = nomeBarbearia || barbeiro.nomeBarbearia;
    barbeiro.linkFila = linkFila;
  } else {
    barbeiro = {
      email: emailFormatado,
      nomeBarbearia: nomeBarbearia || 'Barbearia',
      status: 'pendente',
      linkFila
    };
    barbeiros.push(barbeiro);
  }

  return res.json({
    sucesso: true,
    mensagem: 'Confirmação enviada! Seu link de fila será liberado assim que o Pix for confirmado.'
  });
});

// 2. Status do barbeiro
app.get('/status-acesso/:email', (req, res) => {
  const emailFormatado = decodeURIComponent(req.params.email).toLowerCase().trim();
  const barbeiro = barbeiros.find(b => b.email === emailFormatado);

  if (!barbeiro) {
    return res.json({ status: 'nao_encontrado' });
  }

  return res.json({
    status: barbeiro.status,
    linkFila: barbeiro.linkFila
  });
});

// 3. Rota de aprovação (Admin)
app.post('/admin/aprovar-barbeiro', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Informe o e-mail do barbeiro.' });
  }

  const emailFormatado = email.toLowerCase().trim();
  const barbeiro = barbeiros.find(b => b.email === emailFormatado);

  if (!barbeiro) {
    return res.status(404).json({ error: 'Barbeiro não encontrado na lista.' });
  }

  barbeiro.status = 'ativo';

  return res.json({
    sucesso: true,
    mensagem: `Plano ativado para ${emailFormatado}! Link: ${barbeiro.linkFila}`
  });
});

module.exports = app;
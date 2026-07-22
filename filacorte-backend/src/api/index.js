const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

let barbeiros = [];

app.post('/enviar-comprovante', (req, res) => {
  const { email, nomeBarbearia } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório.' });
  }

  let barbeiro = barbeiros.find(b => b.email === email);

  if (barbeiro) {
    barbeiro.status = 'pendente';
    barbeiro.nomeBarbearia = nomeBarbearia || barbeiro.nomeBarbearia;
  } else {
    const slugFila = (nomeBarbearia || 'barbearia').toLowerCase().replace(/\s+/g, '-');
    barbeiro = {
      email,
      nomeBarbearia: nomeBarbearia || 'Barbearia',
      status: 'pendente',
      linkFila: `https://filacorte-app.vercel.app/fila/${slugFila}`
    };
    barbeiros.push(barbeiro);
  }

  res.json({
    sucesso: true,
    mensagem: 'Confirmação enviada! Seu link de fila será liberado assim que o Pix for confirmado.'
  });
});

app.get('/status-acesso/:email', (req, res) => {
  const { email } = req.params;
  const barbeiro = barbeiros.find(b => b.email === email);

  if (!barbeiro) {
    return res.json({ status: 'nao_encontrado' });
  }

  res.json({
    status: barbeiro.status,
    linkFila: barbeiro.linkFila
  });
});

app.post('/admin/aprovar-barbeiro', (req, res) => {
  const { email } = req.body;
  const barbeiro = barbeiros.find(b => b.email === email);

  if (!barbeiro) {
    return res.status(404).json({ error: 'Barbeiro não encontrado.' });
  }

  barbeiro.status = 'ativo';

  res.json({
    sucesso: true,
    mensagem: `Plano ativado para ${email}! Link gerado: ${barbeiro.linkFila}`
  });
});

module.exports = app;
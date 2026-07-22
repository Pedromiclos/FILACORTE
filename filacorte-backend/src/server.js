const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Simulação do banco de dados de barbeiros
let barbeiros = [];

// 1. Rota para o Barbeiro enviar a confirmação do Pix
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
      linkFila: `https://filacorte.app/fila/${slugFila}`
    };
    barbeiros.push(barbeiro);
  }

  console.log(`[PIX PENDENTE] O barbeiro ${email} (${barbeiro.nomeBarbearia}) solicita liberação do plano.`);

  res.json({
    sucesso: true,
    mensagem: 'Confirmação enviada! Seu link de fila será liberado assim que o Pix for confirmado.'
  });
});

// 2. Rota para o aplicativo checar se o plano do barbeiro já está ativo
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

// 3. Rota de Aprovação (Você executa quando o Pix cai no seu Nubank)
app.post('/admin/aprovar-barbeiro', (req, res) => {
  const { email } = req.body;
  const barbeiro = barbeiros.find(b => b.email === email);

  if (!barbeiro) {
    return res.status(404).json({ error: 'Barbeiro não encontrado.' });
  }

  barbeiro.status = 'ativo';
  console.log(`[PLANO ATIVADO] Barbeiro ${email} aprovado! Link da fila: ${barbeiro.linkFila}`);

  res.json({
    sucesso: true,
    mensagem: `Plano ativado para ${email}! Link gerado: ${barbeiro.linkFila}`
  });
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
module.exports = app;
# FilaCorte — Backend (API REST)

API do sistema de fila online para barbearias, no modelo SaaS multi-tenant.

## Por que sem Express/Firebase por enquanto?

Este backend foi escrito usando **só os módulos nativos do Node.js** (sem `express`,
sem `firebase-admin`), de propósito: assim ele roda com **zero instalação**, com
`node src/server.js`, em qualquer máquina com Node 18+. Isso foi útil para
testar e validar toda a lógica de negócio agora, sem depender de acesso à
internet para `npm install` nem de um projeto Firebase configurado.

A arquitetura já foi organizada para migrar sem dor para as tecnologias
definitivas do projeto:

| Camada atual | Para produção |
|---|---|
| `src/db.js` (arquivo JSON) | Firebase Firestore (a API `collection().find/insert/update/delete` foi desenhada para ficar parecida com o SDK do Firestore — só essa camada muda) |
| `src/utils/router.js` (router próprio) | Express (`npm install express` e trocar as rotas por `app.get(...)`) |
| `src/utils/jwt.js` (JWT manual) | Firebase Auth, ou `jsonwebtoken` |
| `src/modules/payments.js` (stubs) | SDKs reais do Stripe / Mercado Pago / Asaas |

Nada na lógica de negócio (regras de fila, isolamento multi-tenant, papéis de
usuário) precisa mudar nessa migração — só a camada de infraestrutura.

## Como rodar

```bash
cd filacorte-backend
cp .env.example .env     # ajuste as variáveis se quiser
node src/server.js
```

Na primeira execução, o servidor:
- cria o arquivo `data/db.json` (banco de dados);
- semeia uma barbearia de exemplo (`barbearia-do-joao`) com barbeiros e cortes;
- cria o usuário **superadmin** com o e-mail/senha definidos no `.env`
  (padrão: `admin@filacorte.com` / `admin123` — **troque em produção**).

O servidor sobe em `http://localhost:3000` (porta configurável via `PORT`).

## Autenticação

A API usa **JWT** (Bearer token). Após login/cadastro, envie o token em todas
as chamadas protegidas:

```
Authorization: Bearer <token>
```

Papéis (`role`):
- `cliente` — não precisa de login; os endpoints públicos (`/api/public/*`) não exigem token.
- `barbeiro` — dono/gestor de uma barbearia; acessa apenas dados do seu próprio `tenantId`.
- `superadmin` — equipe do FilaCorte; gerencia todas as barbearias.

## Endpoints

### Autenticação — `/api/auth`
| Método | Rota | Descrição |
|---|---|---|
| POST | `/register` | Cadastra uma nova barbearia + usuário dono (7 dias de teste grátis) |
| POST | `/login` | Login (barbeiro ou superadmin) |
| POST | `/forgot-password` | Solicita redefinição de senha |
| POST | `/reset-password` | Confirma nova senha com o token recebido |

### Área do cliente (pública) — `/api/public/:slug`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/:slug` | Dados da barbearia (nome, horário, endereço, barbeiros, catálogo de cortes) |
| POST | `/:slug/queue` | Cliente entra na fila |
| GET | `/:slug/queue/:entryId` | Consulta posição/tempo estimado (usar como polling) |
| DELETE | `/:slug/queue/:entryId` | Cliente sai da fila |
| POST | `/:slug/queue/:entryId/rating` | Avalia o atendimento (1–5 estrelas) |

### Painel do barbeiro (autenticado, `role=barbeiro`) — `/api/barber`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/queue` | Lista a fila de espera da barbearia |
| POST | `/queue/manual` | Adiciona cliente manualmente |
| POST | `/queue/:id/finish` | Finaliza atendimento |
| POST | `/queue/:id/cancel` | Cancela atendimento |
| POST | `/queue/:id/skip` | Move cliente para o fim da fila |
| GET/POST | `/cuts` | Lista / cadastra modelo de corte |
| PATCH/DELETE | `/cuts/:id` | Edita / remove um corte (preço, tempo, etc.) |
| GET/POST | `/barbers` | Lista / cadastra barbeiro da equipe |
| DELETE | `/barbers/:id` | Remove barbeiro |
| GET | `/revenue` | Faturamento total, clientes atendidos, ticket médio |
| GET | `/history` | Histórico de atendimentos (finalizados/cancelados) |

Se a assinatura da barbearia estiver **suspensa**, todas as rotas acima
retornam `402 Payment Required`.

### Painel administrador (autenticado, `role=superadmin`) — `/api/admin`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/tenants` | Lista todas as barbearias |
| POST | `/tenants` | Cadastra uma barbearia manualmente |
| PATCH | `/tenants/:id/suspend` | Suspende/reativa assinatura |
| PATCH | `/tenants/:id/trial` | Liga/desliga teste grátis |
| PATCH | `/tenants/:id/plan` | Altera o plano da barbearia |
| DELETE | `/tenants/:id` | Exclui barbearia |
| GET/POST | `/plans` | Lista / cadastra planos de assinatura |
| GET | `/dashboard` | Métricas gerais (MRR, nº de assinantes ativos/trial) |

### Pagamentos — `/api/payments`
| Método | Rota | Descrição |
|---|---|---|
| POST | `/checkout` | Inicia assinatura (`provider`: `stripe`\|`mercadopago`\|`asaas`\|`pix`\|`boleto`) |
| POST | `/webhooks/stripe` | Webhook do Stripe (confirma pagamento) |
| POST | `/webhooks/mercadopago` | Webhook do Mercado Pago |
| POST | `/webhooks/asaas` | Webhook do Asaas |

> ⚠️ Os endpoints de pagamento estão **mockados** (retornam URLs de exemplo).
> Os pontos exatos para plugar os SDKs reais estão marcados com `// TODO produção`
> em `src/modules/payments.js`.

## Exemplo de fluxo completo (curl)

```bash
# 1. Cliente vê a barbearia
curl http://localhost:3000/api/public/barbearia-do-joao

# 2. Cliente entra na fila
curl -X POST http://localhost:3000/api/public/barbearia-do-joao/queue \
  -H "Content-Type: application/json" \
  -d '{"name":"Pedro Lima","phone":"11999990000","barberId":"<id>","cutId":"<id>","beard":true}'

# 3. Barbeiro faz login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@filacorte.com","password":"admin123"}'

# 4. Barbeiro vê a fila
curl http://localhost:3000/api/barber/queue -H "Authorization: Bearer <token>"
```

## Estrutura de pastas

```
filacorte-backend/
├── data/db.json          # "banco de dados" (gerado automaticamente)
├── src/
│   ├── server.js         # servidor HTTP + seed inicial
│   ├── app.js             # monta todas as rotas
│   ├── config.js          # variáveis de ambiente
│   ├── db.js               # camada de dados (trocar por Firestore em produção)
│   ├── middleware/auth.js  # JWT + verificação de papel + assinatura ativa
│   ├── utils/              # jwt.js, password.js, router.js
│   └── modules/
│       ├── auth.js         # cadastro/login/recuperação de senha
│       ├── public.js       # área do cliente (sem login)
│       ├── barber.js       # painel do barbeiro (multi-tenant)
│       ├── admin.js        # painel administrador (SaaS)
│       └── payments.js     # assinaturas e webhooks (stub)
└── .env.example
```

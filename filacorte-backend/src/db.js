// ---------------------------------------------------------------------------
// Camada de banco de dados.
//
// Nesta fase o "banco" é um arquivo JSON em disco (data/db.json), mas a API
// exposta aqui (collection().find/insert/update/delete) foi desenhada de
// propósito para imitar o SDK do Firestore. Isso significa que, para migrar
// para Firestore de verdade em produção, só é necessário reescrever ESTE
// arquivo — nenhuma rota ou controller precisa mudar.
//
// Modelo multi-tenant: todo documento de uma coleção "por barbearia" carrega
// um campo tenantId. Toda query feita pelos módulos barber/public já filtra
// por tenantId, garantindo isolamento total entre barbearias (equivalente a
// usar subcoleções /tenants/{tenantId}/queue no Firestore).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function defaultData() {
  return {
    tenants: [],   // barbearias (empresas assinantes)
    users: [],     // usuários com login (barbeiros/donos + superadmin)
    barbers: [],   // profissionais que atendem (podem ou não ter login)
    cuts: [],      // catálogo de cortes por tenant
    queue: [],     // fila (inclui histórico: status waiting|finished|cancelled)
    ratings: [],   // avaliações de clientes
    plans: [],     // planos de assinatura do SaaS
  };
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    writeDb(defaultData());
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Coleção com API estilo Firestore: find(filterFn), findOne, insert, update, delete
function collection(name) {
  return {
    find(filterFn = () => true) {
      const db = readDb();
      return (db[name] || []).filter(filterFn);
    },
    findOne(filterFn) {
      const db = readDb();
      return (db[name] || []).find(filterFn) || null;
    },
    findById(id) {
      const db = readDb();
      return (db[name] || []).find((d) => d.id === id) || null;
    },
    insert(doc) {
      const db = readDb();
      const record = { id: doc.id || uid(name.slice(0, 2)), createdAt: Date.now(), ...doc };
      db[name] = db[name] || [];
      db[name].push(record);
      writeDb(db);
      return record;
    },
    update(id, patch) {
      const db = readDb();
      const list = db[name] || [];
      const idx = list.findIndex((d) => d.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
      writeDb(db);
      return list[idx];
    },
    delete(id) {
      const db = readDb();
      const list = db[name] || [];
      const next = list.filter((d) => d.id !== id);
      const changed = next.length !== list.length;
      db[name] = next;
      writeDb(db);
      return changed;
    },
  };
}

module.exports = { collection, uid, readDb, writeDb, defaultData };

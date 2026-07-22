// Router minimalista com suporte a parâmetros de rota (:id) e middlewares
// encadeados, para não depender do Express.

class Router {
  constructor() {
    this.routes = []; // { method, pattern, keys, handlers }
  }

  _add(method, pattern, handlers) {
    const keys = [];
    const regexStr = pattern
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    const regex = new RegExp(`^${regexStr}/?$`);
    this.routes.push({ method, regex, keys, handlers });
  }

  get(pattern, ...handlers) { this._add('GET', pattern, handlers); }
  post(pattern, ...handlers) { this._add('POST', pattern, handlers); }
  patch(pattern, ...handlers) { this._add('PATCH', pattern, handlers); }
  put(pattern, ...handlers) { this._add('PUT', pattern, handlers); }
  delete(pattern, ...handlers) { this._add('DELETE', pattern, handlers); }

  // usa outro Router (ou lista de rotas) sob um prefixo
  use(prefix, otherRouter) {
    otherRouter.routes.forEach((r) => {
      this.routes.push({
        ...r,
        regex: new RegExp(
          `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${r.regex.source.slice(1)}`
        ),
      });
    });
  }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(pathname);
      if (m) {
        const params = {};
        route.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { handlers: route.handlers, params };
      }
    }
    return null;
  }
}

module.exports = Router;

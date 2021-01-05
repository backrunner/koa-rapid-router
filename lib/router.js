const path = require('path');
const StringToRegexp = require('./string-to-regexp');
const methods = require('methods');
const PREFIX = Symbol('router:prefix');
const SERVER = Symbol('router.server');
const MIDDLEWARES = Symbol('router.middlewares');
const VERB = Symbol('router#verb');
let callbackId = 1;

function Router(server) {
  this[SERVER] = server;
  this[PREFIX] = '/';
  this[MIDDLEWARES] = [];
}

Router.prototype.prefix = function (prefix) {
  this[PREFIX] = prefix;
  return this;
};

Router.prototype.use = function (...middlewares) {
  this[MIDDLEWARES].push(
    ...middlewares.map((middleware) => {
      if (!middleware.__ID__) {
        this[SERVER].callbacks[(middleware.__ID__ = callbackId++)] = middleware;
      }
      return middleware.__ID__;
    })
  );
  return this;
};

Router.prototype[VERB] = function (method, router, ...callbacks) {
  resolvedRouter = router.startsWith('/') ? `${this[PREFIX]}${router.substr(1)}` : `${this[PREFIX]}${router}`;

  callbacks = callbacks.map((callback) => {
    if (!callback.__ID__) {
      this[SERVER].callbacks[(callback.__ID__ = callbackId++)] = callback;
    }
    return callback.__ID__;
  });

  if (StringToRegexp.isStatic(resolvedRouter)) {
    if (!this[SERVER].statics[method]) this[SERVER].statics[method] = {};
    this[SERVER].statics[method][resolvedRouter] = [].concat(this[MIDDLEWARES]).concat(callbacks);
    return this;
  }

  const routes = resolvedRouter.split('/');
  if (!this[SERVER].features[method]) this[SERVER].features[method] = CustomOptions();
  let target = this[SERVER].features[method];
  routes.forEach((route, index) => {
    if (!route) return;
    if (!target[route]) target[route] = CustomOptions();
    if (!StringToRegexp.isStatic(route)) {
      if (!this[SERVER].vars[route]) this[SERVER].vars[route] = new StringToRegexp(route, this[SERVER].expressions);
      target.__REGEXPS__.push(route);
    }
    if (routes.length === index + 1) {
      const middlewares = [].concat(this[MIDDLEWARES]).concat(callbacks);
      target[route].__MIDDLEWARES__.push(...middlewares);
    }
    target = target[route];
  });

  return this;
};

methods.forEach((method) => {
  Router.prototype[method] = function (router, ...callback) {
    return this[VERB](method.toUpperCase(), router, ...callback);
  };
});

module.exports = Router;

function CustomOptions() {
  return {
    __REGEXPS__: [],
    __MIDDLEWARES__: [],
    __CACHES__: new Map(),
  };
}

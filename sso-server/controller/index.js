const uuidv4 = require("uuid/v4");
const Hashids = require("hashids");
const URL = require("url").URL;
const hashids = new Hashids();
const { genJwtToken } = require("./jwt_helper");

const re = /(\S+)\s+(\S+)/;

// Note: express http converts all headers
// to lower case.
const AUTH_HEADER = "authorization";
const BEARER_AUTH_SCHEME = "bearer";

function parseAuthHeader(hdrValue) {
  if (typeof hdrValue !== "string") {
    return null;
  }
  const matches = hdrValue.match(re);
  return matches && { scheme: matches[1], value: matches[2] };
}

const fromAuthHeaderWithScheme = function(authScheme) {
  const authSchemeLower = authScheme.toLowerCase();
  return function(request) {
    let token = null;
    if (request.headers[AUTH_HEADER]) {
      const authParams = parseAuthHeader(request.headers[AUTH_HEADER]);
      if (authParams && authSchemeLower === authParams.scheme.toLowerCase()) {
        token = authParams.value;
      }
    }
    return token;
  };
};

const fromAuthHeaderAsBearerToken = function() {
  return fromAuthHeaderWithScheme(BEARER_AUTH_SCHEME);
};

const appTokenFromRequest = fromAuthHeaderAsBearerToken();

// El token de la aplicación para validar la solicitud proviene únicamente del servidor autenticado.
const appTokenDB = {
  sso_consumer: "l1Q7zkOL59cRqWBkQ12ZiGVW2DBL",
  simple_sso_consumer: "1g0jJwGmRQhJwvwNOrY4i90kD0m"
};

const alloweOrigin = {
  "http://consumer.simple-sso.in.sr.intra.net:3020": true,
  "http://consumertwo.simple-sso.in.sr.intra.net:3030": true,
  "http://sso.simple-sso.in.sr.intra.net:3080": false
};

const deHyphenatedUUID = () => uuidv4().replace(/-/gi, "");
const encodedId = () => hashids.encodeHex(deHyphenatedUUID());

// Un aviso temporal para almacenar todas las aplicaciones que han iniciado sesión con la sesión actual.
// Puede ser útil para varios propósitos de auditoría.
const sessionUser = {};
const sessionApp = {};

const originAppName = {
  "http://consumer.simple-sso.in.sr.intra.net:3020": "sso_consumer",
  "http://consumertwo.simple-sso.in.sr.intra.net:3030": "simple_sso_consumer"
};

const userDB = {
  "info@simple-sso.com": {
    password: "test",
    userId: encodedId(), // En caso de que no desee compartir el correo electrónico del usuario.
    appPolicy: {
      sso_consumer: { role: "admin", shareEmail: true },
      simple_sso_consumer: { role: "user", shareEmail: false }
    }
  }
};

// estas fichas son para el propósito de validación
const intrmTokenCache = {};

const fillIntrmTokenCache = (origin, id, intrmToken) => {
  intrmTokenCache[intrmToken] = [id, originAppName[origin]];
};
const storeApplicationInCache = (origin, id, intrmToken) => {
  if (sessionApp[id] == null) {
    sessionApp[id] = {
      [originAppName[origin]]: true
    };
    fillIntrmTokenCache(origin, id, intrmToken);
  } else {
    sessionApp[id][originAppName[origin]] = true;
    fillIntrmTokenCache(origin, id, intrmToken);
  }
  console.log({ ...sessionApp }, { ...sessionUser }, { intrmTokenCache });
};

const generatePayload = ssoToken => {
  const globalSessionToken = intrmTokenCache[ssoToken][0];
  const appName = intrmTokenCache[ssoToken][1];
  const userEmail = sessionUser[globalSessionToken];
  const user = userDB[userEmail];
  const appPolicy = user.appPolicy[appName];
  const email = appPolicy.shareEmail === true ? userEmail : undefined;
  const payload = {
    ...{ ...appPolicy },
    ...{
      email,
      shareEmail: undefined,
      uid: user.userId,
      // SessionID global para la funcionalidad de cierre de sesión.
      globalSessionID: globalSessionToken
    }
  };
  return payload;
};

const verifySsoToken = async (req, res, next) => {
  const appToken = appTokenFromRequest(req);
  const { ssoToken } = req.query;
  // si el token de la aplicación no está presente o la solicitud de ssoToken no es válida
  // si el ssoToken no está presente en el caché, algunos son inteligentes.
  if (
    appToken == null ||
    ssoToken == null ||
    intrmTokenCache[ssoToken] == null
  ) {
    return res.status(400).json({ message: "badRequest" });
  }

  // si el appToken está presente y verifica si es válido para la aplicación
  const appName = intrmTokenCache[ssoToken][1];
  const globalSessionToken = intrmTokenCache[ssoToken][0];
  // Si appToken no es igual al token dado durante el registro de la aplicación sso o en una etapa posterior a la no válida
  if (
    appToken !== appTokenDB[appName] ||
    sessionApp[globalSessionToken][appName] !== true
  ) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  // comprobando si el token pasado ha sido generado
  const payload = generatePayload(ssoToken);

  const token = await genJwtToken(payload);
  // se elimina la clave itrmCache para ningún otro uso
  delete intrmTokenCache[ssoToken];
  return res.status(200).json({ token });
};
const doLogin = (req, res, next) => {
  // hacer la validación con correo electrónico y contraseña
  const { email, password } = req.body;
  if (!(userDB[email] && password === userDB[email].password)) {
    return res.status(404).json({ message: "Email y password erroneos" });
  }

  // else redirect
  const { serviceURL } = req.query;
  const id = encodedId();
  req.session.user = id;
  sessionUser[id] = email;
  if (serviceURL == null) {
    return res.redirect("/");
  }
  const url = new URL(serviceURL);
  const intrmid = encodedId();
  storeApplicationInCache(url.origin, id, intrmid);
  return res.redirect(`${serviceURL}?ssoToken=${intrmid}`);
};

const login = (req, res, next) => {
  // El req.query tendrá la url de redireccionamiento donde necesitamos redireccionar después de tener éxito
  // iniciar sesión y con el token sso.
  // Esto también se puede usar para verificar el origen desde donde se recibió la solicitud
  // para la redirección
  const { serviceURL } = req.query;
  // El acceso directo dará el error dentro de la nueva URL.
  if (serviceURL != null) {
    const url = new URL(serviceURL);
    if (alloweOrigin[url.origin] !== true) {
      return res
        .status(400)
        .json({ message: "No tienes acceso al sso-server" });
    }
  }
  if (req.session.user != null && serviceURL == null) {
    return res.redirect("/");
  }
  // si la sesión global ya tiene al usuario, lo redirige directamente con el token.
  if (req.session.user != null && serviceURL != null) {
    const url = new URL(serviceURL);
    const intrmid = encodedId();
    storeApplicationInCache(url.origin, req.session.user, intrmid);
    return res.redirect(`${serviceURL}?ssoToken=${intrmid}`);
  }

  return res.render("login", {
    title: "SSO-Server | Login"
  });
};
const logout = (req, res) => {
  // realiza el logout de la sesion.
  // solo debemos tener en cuenta estas tres relaciones
  // 1.La sesión local existe, la sesión global debe existir.
  // 2. La sesión global existe, la sesión local no necesariamente existe.
  // 3. La sesión global se destruye, la sesión local debe ser destruida.
   const appToken = appTokenFromRequest(req)
  const { ssoToken } = req.query
  const appName = intrmTokenCache[ssoToken][1]
  const globalSessionToken = intrmTokenCache[ssoToken][0]
  console.log(appToken);
  //console.log(ssoToken);
  // caso 1
/* if (req.session.user != null && sessionApp[globalSessionToken][appName] == true) {
    req.session.destroy()
    delete intrmTokenCache[ssoToken]
    return res.status(200).send('logout success!')
  } else if (sessionApp[globalSessionToken][appName] == true) {
    // caso 2
    delete intrmTokenCache[ssoToken]
    return res.status(200).send('logout success!')
  }*/
  console.log(req.session.user != null);
  res.status(200).send('logout success!')
  //console.log(res);
}
module.exports = Object.assign({}, { doLogin, login, verifySsoToken, logout })

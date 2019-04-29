# Creación de un servidor de inicio de sesión único (SSO) en Node.js

La aplicación web utiliza la arquitectura del tipo cliente/servidor, y HTTP como el protocolo de comunicación. HTTP Es un protocolo sin estado. Cada vez que el navegador lo solicita, el servidor lo procesa de forma independiente y no se asocia con la solicitud anterior o posterior. Pero también significa que cualquier usuario puede acceder a los recursos del servidor a través del navegador. Si se desea proteger algunos recursos del servidor, debemos restringir la solicitud del navegador, se debe autenticar, para responder a la solicitud legítima, ignorar la solicitud ilegal. Dado que el protocolo HTTP no tiene estado, permitimos que el servidor y el navegador mantengan un estado juntos, utilizando un mecanismo como 'Cookies' o 'Sesiones' o 'JWT'.

## Tabla de contenidos

1. [Introducción](#Introducción)
2. [Funcionamiento](#Funcionamiento)
3. [Configuración Servidor](#Configuración-Servidor)
4. [Configuración GIT](#Configuración-GIT)
5. [Configuración App](#Configuración_APP) 
6. [Iniciar App](#Iniciar_APP)
7. [Referencias](#Referencias)

## Introducción

Cuando tenemos un solo sistema, el mecanismo de estado, a través de la autenticación de inicio de sesión, es fácil de mantener. Pero cuando un sistema único se convierte en sistema múltiple, ¿cómo mantenemos el estado de cada sistema individual, los usuarios tienen que iniciar sesión uno por uno y luego desconectarse uno por uno?.

La regla de oro de la solución de buenos usuarios es que la complejidad creciente de su arquitectura debe ser asumida por el sistema en lugar del usuario. No importa lo complejo que sean los elementos internos del sistema web. Es decir, todo el grupo de aplicaciones del usuario que accede al sistema web es lo mismo que acceder a un solo sistema.

Entonces, ¿cómo escribimos el sistema utilizando una solución de inicio de sesión de sistema único? 

La gente comenzó a usar diferentes tecnologías para construir sus servicios en algún momento utilizando diferentes dominios, donde el valor clave de la cookie (JSESSIONID en Java) es diferente de (sesión en Node.js), y de repente la sesión no fue más fácil de mantener.

El principio de funcionamiento básico sobre el que funciona SSO es que puede iniciar sesión en un sistema en un grupo de aplicaciones multisistema y ser autorizado en todos los demás sistemas sin tener que iniciar sesión nuevamente, incluido el inicio de sesión único y el cierre de sesión único.
En el corazón de SSO tenemos un único servidor de autenticación independiente, que puede aceptar información de seguridad como el correo electrónico, el nombre de usuario y la contraseña del usuario. Otros sistemas no proporcionan acceso de inicio de sesión y solo aceptan la autorización indirecta del servidor de autenticación. La autorización indirecta se implementa utilizando el token.

## Funcionamiento

1. El usuario accede al recurso protegido del sistema "sso-consumer". "sso-consumer" encuentra que el usuario no ha iniciado sesión, salta al "sso-server", utilizando su propia dirección como parámetro. 
Vamos a construir el middleware express.js para verificar lo mismo para nuestra solicitud.

```
const isAuthenticated = (req, res, next) => {
  // simple comprobación para ver si el usuario está autenticado o no,
  // si no redirige al usuario al servidor SSO para iniciar sesión
  // pasar la URL de redireccionamiento como URL actual
  // serviceURL es donde el sso debe redireccionar en caso de un usuario válido
  const redirectURL = `${req.protocol}://${req.headers.host}${req.path}`;
  if (req.session.user == null) {
    return res.redirect(
      `http://sso.simple-sso.com.sr.intra.net:3010/simplesso/login?serviceURL=${redirectURL}`
    );
  }
  next();
};

module.exports = isAuthenticated;

```

2. El servidor de autenticación SSO encuentra que el usuario no ha iniciado sesión y lo dirige a la página de inicio de sesión.

```
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
```
> Punteros de seguridad adicionales:  
Estamos comprobando si el serviceURL que vino como consulta al 'sso-server' se ha registrado para usar el 'sso-server' o no.

```
const alloweOrigin = {
  "http://consumer.simple-sso.in.sr.intra.net:3020": true,
  "http://consumertwo.simple-sso.in.sr.intra.net:3030": true,
  "http://sso.simple-sso.in.sr.intra.net:3080": false
};
```
3. El usuario ingresa el nombre de usuario y la contraseña para enviar la solicitud de inicio de sesión.

![Login Server-SSO](/images/login-server-sso.png)

4. El servidor de autenticación SSO verifica la información del usuario y crea una sesión entre el usuario y el servidor de autenticación sso. Esto se denomina sesión global y crea un token de autorización. El token de autorización es una cadena de caracteres aleatorios. No importa cómo se genere. Mientras no se repita y no sea fácil de modificar.

5. El servidor de autenticación SSO toma el token de autorización para saltar a la dirección de solicitud inicial (sistema "sso-consumer").

´´´
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
´´´
>Punteros de seguridad adicionales: 
>* Siempre considere este token como token intermedio e intercambie los datos reales usando este token. 
>* Si está utilizando JWT como el token intermedio, evite compartir datos críticos a través de este JWT.

6 . El 'sso-consumer' obtiene el token y va a la autenticación del 'sso-server' para verificar si el token es válido. El 'SSO-SERVER' verifica el token y devuelve otro token con información del usuario al "sso-consumer" . El "sso-consumidor" usa este token para crear una sesión con el usuario. Esta sesión se llama sesión local.

Aquí hay un breve middleware de sso-consumer dentro de la aplicación "sso-consumer", creado con el 'express.js'

```
const ssoRedirect = () => {
  return async function(req, res, next) {
    // comprueba si el requisito tiene el queryParameter como ssoToken
    // y quien es el referente.
    const { ssoToken } = req.query;
    if (ssoToken != null) {
     // para eliminar el ssoToken en el redireccionamiento de parámetros de consulta.
      const redirectURL = url.parse(req.url).pathname;
      try {
        const response = await axios.get(
          `${ssoServerJWTURL}?ssoToken=${ssoToken}`,
          {
            headers: {
              Authorization: "Bearer l1Q7zkOL59cRqWBkQ12ZiGVW2DBL"
            }
          }
        );
        const { token } = response.data;
        const decoded = await verifyJwtToken(token);
        // ahora que hemos descifrado el jwt, usa el, global-session-id como el id de sesión 
        // para que el cierre de sesión se puede implementar con la sesión global.
        req.session.user = decoded;
      } catch (err) {
        return next(err);
      }

      return res.redirect(`${redirectURL}`);
    }

    return next();
  };
};

```
Después de la solicitud de sso-consumer, sso-server comprueba el token para averiguar si el token existe y caduca. La verificación del token tiene éxito.

El servidor SSO en nuestro caso, devolveremos un JWT firmado con información del usuario, después de la validación exitosa.

```
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
```
También puede definir la política de nivel de aplicación en el lugar centralizado.

```
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
```
Después de que el usuario inicie sesión correctamente, se establece una sesión con el "servidor de autenticación sso" y cada subsistema del consumidor. La sesión establecida entre el usuario y el "servidor de autenticación sso" se denomina sesión global . La sesión establecida entre el usuario y cada "subsistema de consumidores" se denomina sesión local . Una vez establecida la sesión local, el usuario puede acceder a los recursos protegidos del subsistema del consumidor.

![Simulación de ejecución](/images/simulacion.gif)

Se establecen "sesión local" y "sesión global".

>Breve vistazo a las funciones que sso-client y sso-server que hemos implementado.
>
>SSO-CONSUMIDOR:
>
>a. El subsistema sso-consumer no inicia sesión en la solicitud del usuario y salta al servidor sso para la autenticación.
>
>b. Recibe el token enviado por el servidor de autenticación sso.
>
>c. Comuníquese con sso-server para verificar la validez del token.
>
>d. Recibe un JWT, verifica el JWT usando la clave pública.
>
>e. Establecer una sesión local.
>
>SSO-SERVIDOR:
>
>a. Verifique la información de inicio de sesión del usuario.
>
>b. Crear una sesión global.
>
>c. Crear un token de autorización.
>
>d. Enviar un token con comunicación sso-cliente.
>
>e. Verificar la validez del token sso-client.
>
>f. Enviar un JWT con la información del usuario.

## Configuración-Servidor

Para correr la aplicación se deberá tener instalado:

- npm
- node.js
- git

## Configuración-GIT

Debemos clonar el proyecto en nuestro entorno local, para lo cual debemos ejecutar el siguiente comando.

```
    git clone https://github.com/ebellera/sso.git 
```

## Configuración_APP

Para poder iniciar la App, debemos instalar antes las dependencias de los framworks Express, Morgan y ejs-mate.
Para lo cual debemos ejecutar desde la consola los siguentes comandos, ubicados en la carpeta de la App.

```
  npm install express
  npm install morgan
  npm install ejs-mate
```

## Iniciar_APP

1. Para iniciar el servidor de sso, debemos ingresar por la consola hasta el directorio /sso-server y ejecutar:

```
    node index.js
```

Automáticamente se levantará el webserver que correrá en el puerto 3010, para acceder hay que pegar la siguiente url:

```
   http://sso.simple-sso.com.sr.intra.net:3010/ 
```

2. Para iniciar el consumidor, debemos acceder hasta su carpeta y ejecutar la siguiente instrucción:

```
    node index.js
```

El consumidor correrá en un puerto diferente ya que estamos simulando en LOCALHOST, para acceder debemos coipar la siguiente url:

```
    http://consumer.simple-sso.in.sr.intra.net:3020
```

### sso-server es nuestra unidad central de autorización

Para correr el ejemplo se deberá agregar las siguientes entradas al archivo hosts `/etc/hosts` 
en linux yn windows `/windows/system32/drivers/etc/hosts`

```
127.0.0.1   sso.simple-sso.com
127.0.0.1   consumer.simple-sso.in
```
## Referencias

## [NPM](https://www.npmjs.com/)

Es el manejador de paquetes por defecto para Node.js, un entorno de ejecución para JavaScript. 
Además, permite a los usuarios instalar aplicaciones Node.js que se encuentran en el repositorio. npm está escrito enteramente en JavaScript.

## [Node.js](https://nodejs.org/es/)

Es un entorno en tiempo de ejecución multiplataforma, de código abierto, para la capa del servidor (pero no limitándose a ello) basado en el lenguaje de programación ECMAScript, asíncrono, con I/O de datos en una arquitectura orientada a eventos y basado en el motor V8 de Google.

## [Express](https://expressjs.com/)

Express es una infraestructura de aplicaciones web Node.js mínima y flexible que proporciona un conjunto sólido de características para las aplicaciones web. Proporciona una delgada capa de características de aplicación web básicas, que no ocultan las características de Node.js

## [Morgan](https://www.npmjs.com/package/morgan)

Middleware HTTP de logger para las solicitudes de node.js. Basicamente nos ayuda a registrar el acceso a todas las rutas e imprimirlas por pantalla.

## [EJS](https://www.npmjs.com/package/ejs-mate)

Motor de templates para Express

## [GIT](https://git-scm.com/)

Es un sistema de control de revisión distribuido, rápido y escalable con un conjunto de comandos inusualmente rico que proporciona operaciones de alto nivel y acceso completo a las partes internas.

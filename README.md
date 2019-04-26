# Creación de un servidor de inicio de sesión único (SSO) en Node.js

La aplicación web utiliza la arquitectura del tipo cliente/servidor, y HTTP como el protocolo de comunicación. HTTP Es un protocolo sin estado. Cada vez que el navegador lo solicita, el servidor lo procesa de forma independiente y no se asocia con la solicitud anterior o posterior. Pero también significa que cualquier usuario puede acceder a los recursos del servidor a través del navegador. Si se desea proteger algunos recursos del servidor, debemos restringir la solicitud del navegador, se debe autenticar, para responder a la solicitud legítima, ignorar la solicitud ilegal. Dado que el protocolo HTTP no tiene estado, permitimos que el servidor y el navegador mantengan un estado juntos, utilizando un mecanismo como 'Cookies' o 'Sesiones' o 'JWT'.

## Tabla de contenidos

1. [Introducción](#Introducción)
2. [Funcionamiento](#Funcionamiento)
2. [Configuración Servidor](#Configuración-Servidor)
3. [Configuración GIT](#Configuración-GIT)
4. [Configuración App](#Configuración_APP) 
4. [Iniciar App](#Iniciar_APP)

## Introducción

Cuando tenemos un solo sistema, el mecanismo de estado, a través de la autenticación de inicio de sesión, es fácil de mantener. Pero cuando un sistema único se convierte en sistema múltiple, ¿cómo mantenemos el estado de cada sistema individual, los usuarios tienen que iniciar sesión uno por uno y luego desconectarse uno por uno?.

La regla de oro de la solución de buenos usuarios es que la complejidad creciente de su arquitectura debe ser asumida por el sistema en lugar del usuario. No importa lo complejo que sean los elementos internos del sistema web. Es decir, todo el grupo de aplicaciones del usuario que accede al sistema web es lo mismo que acceder a un solo sistema.

Entonces, ¿cómo escribimos el sistema utilizando una solución de inicio de sesión de sistema único? 

La gente comenzó a usar diferentes tecnologías para construir sus servicios en algún momento utilizando diferentes dominios, donde el valor clave de la cookie (JSESSIONID en Java) es diferente de (sesión en Node.js), y de repente la sesión no fue más fácil de mantener.

###Inicio de sesión único (SSO)

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

 

## Configuración-Servidor

Para correr la aplicación se deberá tener instalado:

- node.js
- git

## Configuración-GIT

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

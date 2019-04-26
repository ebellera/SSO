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

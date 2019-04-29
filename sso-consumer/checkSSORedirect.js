const url = require("url");
const axios = require("axios");
const { URL } = url;
const { verifyJwtToken } = require("./jwt_verify");
const validReferOrigin = "http://sso.simple-sso.com.sr.intra.net:3010";
const ssoServerJWTURL = "http://sso.simple-sso.com.sr.intra.net:3010/simplesso/verifytoken";

const ssoRedirect = () => {
  return async function(req, res, next) {
    // comprueba si el requisito tiene el queryParameter como ssoToken
    // y quien es el referente.
    const { ssoToken } = req.query;
    if (ssoToken != null) {
     // para eliminar el ssoToken en el redireccionamiento de parรกmetros de consulta.
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
        // ahora que hemos descifrado el jwt, usa el, global-session-id como el id de sesiรณn 
        // para que el cierre de sesiรณn se puede implementar con la sesiรณn global.
        req.session.user = decoded;
      } catch (err) {
        return next(err);
      }

      return res.redirect(`${redirectURL}`);
    }

    return next();
  };
};

module.exports = ssoRedirect;

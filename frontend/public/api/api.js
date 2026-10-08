// Shared API endpoints for every frontend page.
// When served by the backend, use the current origin. For a separate local
// frontend dev server, fall back to the backend's localhost port.
(() => {
  const backendOrigin = window.location.port === '3000'
    ? window.location.origin
    : `${window.location.protocol}//${window.location.hostname || 'localhost'}:3000`;

  const apiRoot = `${backendOrigin}/api`;
  window.API = Object.freeze({
    baseUrl: backendOrigin,
    auth: `${backendOrigin}/auth`,
    user: `${apiRoot}/user`,
    audio: `${apiRoot}/audio`,
    image: `${apiRoot}/image`,
    note: `${apiRoot}/note`,
    shop: `${apiRoot}/shop`,
    admin: `${apiRoot}/admin`,
    skin: `${apiRoot}/skin`,
    flow: `${apiRoot}/flow`,

    // Use this helper for JSON requests. FormData requests can be passed
    // directly; the browser will set their multipart Content-Type boundary.
    request(path, options = {}) {
      return fetch(`${backendOrigin}${path}`, options);
    }
  });
})();

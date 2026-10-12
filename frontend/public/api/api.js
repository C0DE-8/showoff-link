// Shared API endpoints for every frontend page.
// Shared production API origin.
(() => {
  // Allow deployments to override the API host without rebuilding the pages.
  // Same-origin hosting can set API_BASE_URL to an empty string and proxy /api.
  const configuredOrigin = document.querySelector('meta[name="api-base-url"]')?.content
    || window.API_BASE_URL
    || 'https://api.showoff.c0de8.space';
  const backendOrigin = configuredOrigin.replace(/\/$/, '');

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

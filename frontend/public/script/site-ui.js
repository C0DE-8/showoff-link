(() => {
  const currentFile = location.pathname.split('/').pop() || 'index.html';
  const excludedNav = new Set(['index.html', 'dashboard.html', '404.html', 'forgot.html', 'reset.html']);
  const isAdminPage = /^(admin|token-manger)/i.test(currentFile);

  const toastContainer = document.createElement('div');
  toastContainer.id = 'appToastContainer';
  toastContainer.setAttribute('role', 'region');
  toastContainer.setAttribute('aria-label', 'Notifications');
  toastContainer.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastContainer);

  window.showAppToast = (message, type = 'info', duration = 4200) => {
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = String(message ?? '');
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    window.setTimeout(() => {
      toast.classList.remove('show');
      window.setTimeout(() => toast.remove(), 250);
    }, duration);
    return toast;
  };

  // Route legacy browser alerts through the shared glass notification UI.
  window.alert = (message) => window.showAppToast(message, 'info');

  if (excludedNav.has(currentFile) || isAdminPage) return;

  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'Main navigation');
  const brand = document.createElement('a');
  brand.className = 'site-nav-brand';
  brand.href = './index.html';
  brand.textContent = 'SHOWOFF LINKS';

  const links = document.createElement('div');
  links.className = 'site-nav-links';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'site-nav-back';
  back.innerHTML = '<span aria-hidden="true">←</span><span class="site-nav-back-label">Back</span>';
  back.addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.href = './dashboard.html';
  });
  const home = document.createElement('a');
  home.href = './index.html';
  home.textContent = 'Home';
  const dashboard = document.createElement('a');
  dashboard.href = './dashboard.html';
  dashboard.className = 'site-nav-primary';
  dashboard.textContent = 'Dashboard';
  const hasPageReturnLink = document.querySelector('a.back-btn, a.back-link, a.back-arrow, a.return-btn');
  if (!hasPageReturnLink) links.appendChild(back);
  links.append(home, dashboard);
  nav.append(brand, links);
  document.body.prepend(nav);
})();

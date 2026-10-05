// Applies the stored theme before first paint (no flash) without an inline script, so the CSP can stay script-src 'self'.
(function () {
  var t = null;
  try { t = localStorage.getItem('atlas.theme'); } catch (e) { /* storage unavailable */ }
  if (t !== 'light' && t !== 'dark') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
})();

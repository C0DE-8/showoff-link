(() => {
  const audio = document.createElement('audio');
  audio.src = './aud/hope.mp3';
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0.28;
  audio.setAttribute('aria-hidden', 'true');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'background-audio-toggle';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Play background music');
  button.title = 'Play background music';
  button.innerHTML = '<span aria-hidden="true">♫</span><span class="background-audio-label">Sound off</span>';

  const style = document.createElement('style');
  style.textContent = `
    .background-audio-toggle {
      position: fixed; right: 18px; bottom: 18px; z-index: 999;
      display: inline-flex; align-items: center; gap: 9px;
      min-height: 42px; padding: 0 14px; border: 1px solid rgba(255,255,255,.2);
      border-radius: 999px; color: #f8fafc; background: rgba(22,19,38,.72);
      box-shadow: 0 10px 30px rgba(0,0,0,.28); backdrop-filter: blur(16px) saturate(145%);
      -webkit-backdrop-filter: blur(16px) saturate(145%); font: 600 13px/1 system-ui,sans-serif;
      cursor: pointer; transition: background .2s ease, border-color .2s ease, transform .2s ease;
    }
    .background-audio-toggle:hover { transform: translateY(-2px); border-color: rgba(216,180,254,.58); }
    .background-audio-toggle[aria-pressed="true"] { background: rgba(126,34,206,.72); }
    .background-audio-toggle span[aria-hidden] { font-size: 18px; }
    @media (max-width: 600px) { .background-audio-toggle { right: 12px; bottom: 12px; min-height: 40px; } }
  `;
  document.head.appendChild(style);
  document.body.append(audio, button);

  const setPlaying = (playing) => {
    button.setAttribute('aria-pressed', String(playing));
    button.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
    button.title = playing ? 'Pause background music' : 'Play background music';
    button.querySelector('.background-audio-label').textContent = playing ? 'Sound on' : 'Sound off';
  };

  try {
    if (localStorage.getItem('backgroundAudioEnabled') === 'true') {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  } catch (_) { /* Storage may be disabled; the control still works for this visit. */ }

  button.addEventListener('click', async () => {
    if (!audio.paused) {
      audio.pause();
      setPlaying(false);
      try { localStorage.setItem('backgroundAudioEnabled', 'false'); } catch (_) {}
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
      try { localStorage.setItem('backgroundAudioEnabled', 'true'); } catch (_) {}
    } catch (error) {
      console.warn('Background audio could not start:', error);
      setPlaying(false);
    }
  });
})();

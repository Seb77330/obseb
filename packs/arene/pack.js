/* Pack « Arène » : braises qui montent et emblème de l'intro */
(function () {
  const stage = document.getElementById('stage');
  if (!stage) return;
  // Emblème : cercle bronze traversé d'une flèche (dessin original)
  const intro = document.getElementById('intro');
  if (intro && !intro.querySelector('.embleme')) {
    intro.insertAdjacentHTML('afterbegin', `
      <svg class="embleme" viewBox="0 0 200 200" aria-hidden="true">
        <defs><linearGradient id="bz" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff1cf"/><stop offset=".45" stop-color="#f0b765"/><stop offset="1" stop-color="#8a4512"/></linearGradient></defs>
        <circle cx="100" cy="100" r="88" fill="none" stroke="url(#bz)" stroke-width="6"/>
        <circle cx="100" cy="100" r="74" fill="none" stroke="url(#bz)" stroke-width="1.5" stroke-dasharray="3 7"/>
        <g fill="url(#bz)">
          <path d="M38 162 L150 50 L156 56 L44 168 Z"/>
          <path d="M150 50 L170 30 L164 58 Z M150 50 L170 30 L142 36 Z"/>
          <path d="M44 168 L30 160 L36 156 Z M44 168 L36 182 L40 174 Z M44 168 L52 182 L48 172 Z"/>
        </g>
      </svg>`);
  }
  // Braises
  const c = document.createElement('canvas');
  c.className = 'braises'; c.width = 1920; c.height = 1080;
  stage.insertBefore(c, stage.children[1] || null);
  const ctx = c.getContext('2d');
  const N = 110, P = [];
  const nouvelle = (bas) => ({
    x: Math.random() * 1920, y: bas ? 1080 + Math.random() * 200 : Math.random() * 1080,
    r: 0.8 + Math.random() * 2.6, vy: 0.4 + Math.random() * 1.3, vx: (Math.random() - .5) * .5,
    ph: Math.random() * 6.28, vie: 0.5 + Math.random() * 0.5
  });
  for (let i = 0; i < N; i++) P.push(nouvelle(false));
  function tic(t) {
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      p.y -= p.vy; p.x += p.vx + Math.sin(t / 900 + p.ph) * 0.35;
      if (p.y < -20) Object.assign(p, nouvelle(true));
      const haut = 1 - p.y / 1080;                       // s'éteint en montant
      const a = Math.max(0, (1 - haut * 0.9) * p.vie * (0.6 + 0.4 * Math.sin(t / 180 + p.ph)));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(255,210,140,${a})`); g.addColorStop(.35, `rgba(240,130,40,${a * .7})`); g.addColorStop(1, 'rgba(200,60,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.29); ctx.fill();
    }
    requestAnimationFrame(tic);
  }
  requestAnimationFrame(tic);
})();

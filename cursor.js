(function () {
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cursor = document.createElement('div');
  cursor.setAttribute('aria-hidden', 'true');
  cursor.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:14px',
    'height:14px',
    'margin:-7px 0 0 -7px',
    'border-radius:50%',
    'background:#fff',
    'pointer-events:none',
    'z-index:99999',
    'mix-blend-mode:difference',
    'will-change:transform',
    'transition:transform 80ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease, width 160ms ease, height 160ms ease, margin 160ms ease',
    'opacity:0'
  ].join(';');

  const attach = () => {
    document.body.appendChild(cursor);
    document.documentElement.classList.add('cursor-hidden');
  };
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });

  let raf = 0, tx = 0, ty = 0, x = 0, y = 0;

  const onMove = (e) => {
    tx = e.clientX;
    ty = e.clientY;
    if (cursor.style.opacity !== '1') cursor.style.opacity = '1';
  };
  const onLeave = () => { cursor.style.opacity = '0'; };
  const onDown = () => {
    cursor.style.width = '22px';
    cursor.style.height = '22px';
    cursor.style.margin = '-11px 0 0 -11px';
  };
  const onUp = () => {
    cursor.style.width = '14px';
    cursor.style.height = '14px';
    cursor.style.margin = '-7px 0 0 -7px';
  };
  const tick = () => {
    x += (tx - x) * 0.32;
    y += (ty - y) * 0.32;
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
})();

// Injected into every session page served by TikTok Live Studio.
// OBS pages (?obs=1 or /obs) silently follow the active session; operator pages get a session pill.
(() => {
  const script = document.currentScript;
  const pageSession = script?.dataset.session || '';
  const params = new URLSearchParams(location.search);
  // OBS / TikTok LIVE Studio pages: ?obs=1 (prayer, wedding), ?view=stage (classroom), or /obs itself
  const isObs = params.get('obs') === '1' || params.get('view') === 'stage' || location.pathname === '/obs';
  const embedded = window.top !== window.self;

  function follow() {
    let source;
    let retry = 1000;
    const open = () => {
      source = new EventSource('/studio/api/events');
      source.onmessage = (message) => {
        retry = 1000;
        let data;
        try { data = JSON.parse(message.data); } catch { return; }
        const active = data.active || '';
        if (active === pageSession) return;
        if (isObs) location.replace('/obs');
        else if (!embedded) location.replace(active ? '/' : '/studio');
      };
      source.onerror = () => {
        source.close();
        setTimeout(open, retry);
        retry = Math.min(10000, retry * 2);
      };
    };
    open();
  }

  follow();
  if (isObs || embedded || !pageSession) return;

  const names = { prayer: 'Chùa Linh Ứng', wedding: 'Lễ cưới', classroom: 'Lớp Học Chữ' };
  const accent = { prayer: '#f2c46b', wedding: '#ff6f91', classroom: '#7cc4ff' }[pageSession] || '#f2c46b';
  const pill = document.createElement('a');
  pill.href = '/studio';
  pill.className = 'studio-session-pill';
  pill.setAttribute('aria-label', `Phiên đang mở: ${names[pageSession]}. Mở TikTok Live Studio để đổi phiên.`);
  pill.innerHTML = '<span class="studio-pill-dot" aria-hidden="true"></span><span class="studio-pill-copy"><small>LIVE STUDIO</small><b></b></span><span class="studio-pill-action">Đổi phiên</span>';
  pill.querySelector('b').textContent = names[pageSession] || pageSession;
  const style = document.createElement('style');
  style.textContent = `
    .studio-session-pill { position: fixed; z-index: 2147483000; left: 16px; bottom: 16px; display: inline-flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; border: 1px solid #ffffff2e; border-radius: 999px; background: #17120fee; box-shadow: 0 10px 30px #0000004d; color: #f7efe2; font: 500 13px/1.1 'Be Vietnam Pro', system-ui, sans-serif; text-decoration: none; }
    .studio-session-pill:hover { background: #241b16; }
    .studio-session-pill:focus-visible { outline: 3px solid #f2c46b; outline-offset: 3px; }
    .studio-pill-dot { width: 9px; height: 9px; border-radius: 50%; background: ${accent}; box-shadow: 0 0 0 4px ${accent}33; }
    .studio-pill-copy { display: flex; flex-direction: column; gap: 2px; }
    .studio-pill-copy small { font-size: 10px; letter-spacing: .12em; opacity: .65; }
    .studio-pill-copy b { font-weight: 700; }
    .studio-pill-action { padding: 7px 12px; border-radius: 999px; background: #f7efe2; color: #17120f; font-weight: 700; }
    @media print { .studio-session-pill { display: none; } }
  `;
  document.head.append(style);
  document.body.append(pill);
})();

/* ─── FORCE SCROLL TO TOP ─── */
if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

/* ─── SMOOTH SCROLL ─── */
function smoothScroll(selector) {
  var el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ─── NAVBAR ─── */
var navbar = document.getElementById('navbar');
var menuToggle = document.getElementById('menu-toggle');
var mobileMenu = document.getElementById('mobile-menu');
var iconMenu = document.getElementById('icon-menu');
var iconClose = document.getElementById('icon-close');
var menuOpen = false;

window.addEventListener('scroll', function () {
  var scrolled = window.scrollY > 56;
  if (scrolled) {
    navbar.classList.add('nav-scrolled');
    navbar.style.background = '';
  } else {
    navbar.classList.remove('nav-scrolled');
    navbar.style.background = 'hsl(0, 0%, 100%)';
  }
}, { passive: true });

menuToggle.addEventListener('click', function () {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('open', menuOpen);
  iconMenu.style.display = menuOpen ? 'none' : 'block';
  iconClose.style.display = menuOpen ? 'block' : 'none';
});

function closeMobileMenu() {
  menuOpen = false;
  mobileMenu.classList.remove('open');
  iconMenu.style.display = 'block';
  iconClose.style.display = 'none';
}

document.getElementById('brand-link').addEventListener('click', function (e) {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ─── BACK TO TOP ─── */
var btt = document.getElementById('back-to-top');
window.addEventListener('scroll', function () {
  btt.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

/* ─── SCROLL REVEAL ─── */
var revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });

/* ─── MARQUEE BAND ─── */
var marqueeItems = [
  { emoji: '💬', label: 'Just connected with 3 classmates' },
  { emoji: '📅', label: 'Tech Fest registrations open!' },
  { emoji: '🏆', label: 'Hackathon 2026 — team up now' },
  { emoji: '📝', label: 'Internship tips thread trending' },
  { emoji: '🎓', label: 'Placement drive this Friday' },
  { emoji: '🌐', label: 'Open-source club recruiting' },
  { emoji: '📸', label: 'Photography club photowalk' },
  { emoji: '🤝', label: 'Alumni connect session tonight' },
  { emoji: '📢', label: 'Campus news from your batch' },
  { emoji: '🎤', label: 'Cultural night lineup revealed' },
  { emoji: '🏋️', label: 'Sports tryouts this weekend' },
  { emoji: '🔬', label: 'Research paper reading group' },
];

function buildBadge(item) {
  return '<div style="display:flex;flex-shrink:0;align-items:center;gap:10px;border-radius:9999px;border:1px solid var(--border);background:var(--card);padding:8px 16px;box-shadow:0 1px 3px hsl(221 30% 50% / 0.08);margin:0 8px;">' +
    '<span style="font-size:1rem;line-height:1;">' + item.emoji + '</span>' +
    '<span style="white-space:nowrap;font-size:0.875rem;font-weight:500;color:var(--muted-fg);">' + item.label + '</span>' +
    '</div>';
}

['mq1a', 'mq1b', 'mq2a', 'mq2b'].forEach(function (id) {
  document.getElementById(id).innerHTML = marqueeItems.map(buildBadge).join('');
});

/* ─── MORPHING TEXT ─── */
(function () {
  var words = ['Connected', 'Empowered', 'Unified', 'Thriving', 'Limitless', 'Elevated', 'Dynamic'];
  var t1 = document.getElementById('morph-t1');
  var t2 = document.getElementById('morph-t2');
  var spacer = document.querySelector('.morph-spacer');
  var MORPH_TIME = 1.0;
  var COOLDOWN = 1.6;
  var index = 0;
  var morphVal = 0;
  var cooldown = COOLDOWN;
  var lastTime = null;

  spacer.textContent = words.reduce(function (a, b) { return a.length >= b.length ? a : b; }, '');
  t1.textContent = words[0];
  t2.textContent = words[1];
  t2.style.opacity = '0%';

  function setMorph(f) {
    var blur2 = Math.min(8 / f - 8, 100);
    t2.style.filter = 'blur(' + blur2 + 'px)';
    t2.style.opacity = (Math.pow(f, 0.4) * 100) + '%';
    var inv = 1 - f;
    var blur1 = Math.min(8 / inv - 8, 100);
    t1.style.filter = 'blur(' + blur1 + 'px)';
    t1.style.opacity = (Math.pow(inv, 0.4) * 100) + '%';
  }

  function doCooldown() {
    morphVal = 0;
    t2.style.filter = '';
    t2.style.opacity = '100%';
    t1.style.filter = '';
    t1.style.opacity = '0%';
  }

  function animate(ts) {
    if (!lastTime) lastTime = ts;
    var dt = (ts - lastTime) / 1000;
    lastTime = ts;
    cooldown -= dt;

    if (cooldown <= 0) {
      if (morphVal === 0) {
        t1.textContent = words[index % words.length];
        index = (index + 1) % words.length;
        t2.textContent = words[index % words.length];
      }
      morphVal += dt / MORPH_TIME;
      if (morphVal >= 1) {
        cooldown = COOLDOWN;
        doCooldown();
      } else {
        setMorph(morphVal);
      }
    }
    requestAnimationFrame(animate);
  }

  index = 1;
  requestAnimationFrame(animate);
})();

/* ─── NUMBER TICKER ─── */
(function () {
  var tickers = document.querySelectorAll('[data-ticker]');
  var tickerObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var target = parseInt(el.dataset.ticker, 10);
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      var dur = 1600;
      var start = performance.now();
      var easeOut = function (t) { return 1 - Math.pow(1 - t, 4); };
      function tick(now) {
        var elapsed = now - start;
        var progress = Math.min(elapsed / dur, 1);
        var val = Math.floor(easeOut(progress) * target);
        el.textContent = prefix + val + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      tickerObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  tickers.forEach(function (el) { tickerObserver.observe(el); });
})();

/* ─── GALLERY HOVER LABELS ─── */
document.querySelectorAll('.gallery-label').forEach(function (label) {
  var card = label.closest('div[onmouseover]');
  if (card) {
    card.addEventListener('mouseenter', function () { label.style.opacity = '1'; });
    card.addEventListener('mouseleave', function () { label.style.opacity = '0'; });
  }
});

/* ─── PIXEL IMAGE CANVAS ─── */
(function () {
  var canvases = document.querySelectorAll('canvas[data-pixel]');
  var pixelObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var canvas = entry.target;
      var src = canvas.dataset.src;
      pixelObs.unobserve(canvas);

      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      img.onload = function () {
        var ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var maxPx = 48;
        var dur = 1800;
        var startT = performance.now();

        function draw(now) {
          var progress = Math.min((now - startT) / dur, 1);
          var eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          var px = Math.max(1, Math.round(maxPx * (1 - eased)));
          var w = canvas.width, h = canvas.height;
          if (px === 1) {
            ctx.drawImage(img, 0, 0);
          } else {
            ctx.clearRect(0, 0, w, h);
            var offW = Math.ceil(w / px);
            var offH = Math.ceil(h / px);
            ctx.drawImage(img, 0, 0, offW, offH);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(canvas, 0, 0, offW, offH, 0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
          }
          if (progress < 1) requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
      };
    });
  }, { threshold: 0.3 });
  canvases.forEach(function (c) { pixelObs.observe(c); });
})();

/* ─── TERMINAL ─── */
(function () {
  var terminalLines = [
    { type: 'comment', text: '# Initializing secure session', delay: 200 },
    { type: 'command', text: 'campus-connect auth --uid 2400217...', delay: 600 },
    { type: 'output', text: 'Validating enrollment... Dispatching OTP...', delay: 300 },
    { type: 'success', text: '✓ 2FA Verified. Session token issued.', delay: 600 },
    { type: 'command', text: 'campus-connect crypto --hash-password', delay: 700 },
    { type: 'output', text: 'Bcrypt hashing... Salting credentials...', delay: 300 },
    { type: 'success', text: '✓ Credentials secured. Redirecting...', delay: 800 },
    { type: 'command', text: 'campus-connect fetch --endpoint /api/feed', delay: 700 },
    { type: 'output', text: 'Querying relational graph... Aggregating posts...', delay: 400 },
    { type: 'success', text: '✓ Feed synced. 200 OK.', delay: 600 },
    { type: 'command', text: 'campus-connect db --update profile', delay: 700 },
    { type: 'output', text: 'Committing transaction... Updating index...', delay: 300 },
    { type: 'success', text: '✓ Write successful.', delay: 600 },
    { type: 'command', text: 'campus-connect get --resource events', delay: 700 },
    { type: 'output', text: 'Fetching metadata... Filtering by date...', delay: 400 },
    { type: 'success', text: '✓ 5 events cached.', delay: 600 },
    { type: 'command', text: 'campus-connect socket --emit connection_request', delay: 700 },
    { type: 'output', text: 'Handshaking... Sending payload...', delay: 300 },
    { type: 'success', text: '✓ Event acknowledged.', delay: 600 },
    { type: 'command', text: 'exit', delay: 1000 },
    { type: 'comment', text: '# Process terminated.', delay: 400 },
  ];

  var body = document.getElementById('terminal-body');
  var terminal = document.getElementById('terminal');
  var started = false;

  function lineHTML(line) {
    if (line.type === 'command') {
      return '<div class="term-line"><span class="term-prompt">❯</span><span class="term-command">' + line.text + '</span></div>';
    }
    var clsMap = { output: 'term-output', success: 'term-success', comment: 'term-comment', error: 'term-output' };
    var cls = clsMap[line.type] || 'term-output';
    return '<p class="' + cls + '">' + line.text + '</p>';
  }

  function startTerminal() {
    started = true;
    body.innerHTML = '';
    var lineIdx = 0;

    function scheduleNext() {
      if (lineIdx >= terminalLines.length) {
        body.innerHTML += '<div class="term-line"><span class="term-prompt" style="color:var(--primary)">❯</span><span class="term-cursor"></span></div>';
        return;
      }
      var line = terminalLines[lineIdx];
      setTimeout(function () {
        if (line.type === 'command') {
          var row = document.createElement('div');
          row.className = 'term-line';
          row.innerHTML = '<span class="term-prompt">❯</span><span class="term-command" id="type-target"></span><span class="term-cursor" id="type-cursor"></span>';
          body.appendChild(row);
          body.scrollTop = body.scrollHeight;

          var target = row.querySelector('#type-target');
          var cursor = row.querySelector('#type-cursor');
          var charIdx = 0;
          var fullText = line.text;

          function typeChar() {
            charIdx++;
            target.textContent = fullText.slice(0, charIdx);
            if (charIdx < fullText.length) {
              setTimeout(typeChar, 40);
            } else {
              cursor.remove();
              lineIdx++;
              scheduleNext();
            }
          }
          typeChar();
        } else {
          body.innerHTML += lineHTML(line);
          body.scrollTop = body.scrollHeight;
          lineIdx++;
          scheduleNext();
        }
      }, line.delay || 400);
    }
    scheduleNext();
  }

  var obs = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !started) startTerminal();
  }, { threshold: 0.3 });
  obs.observe(terminal);
})();

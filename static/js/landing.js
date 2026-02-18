// ===== NAVBAR SCROLL SHRINK =====
(function () {
  var nav = document.getElementById('mainNav');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 60) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });
})();

// ===== SMOOTH SCROLL FOR NAV LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
  anchor.addEventListener('click', function (e) {
    var target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
      // Close mobile menu
      var navCollapse = document.getElementById('navMenu');
      if (navCollapse && navCollapse.classList.contains('show')) {
        var bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
        if (bsCollapse) bsCollapse.hide();
      }
    }
  });
});

// ===== SCROLL REVEAL (Intersection Observer) =====
(function () {
  var revealElements = document.querySelectorAll(
    '.reveal-up, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger'
  );

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  revealElements.forEach(function (el) {
    observer.observe(el);
  });
})();

// ===== JOURNEY SCROLL ANIMATION =====
(function () {
  var wrapper = document.getElementById('journeyWrapper');
  var lineFill = document.getElementById('journeyLineFill');
  var dots = document.querySelectorAll('.journey-dot');
  var cards = document.querySelectorAll('.journey-card');

  function handleJourneyScroll() {
    if (!wrapper) return;
    var wrapperRect = wrapper.getBoundingClientRect();
    var triggerY = window.innerHeight * 0.6;
    var lastActiveDotBottom = 0;

    dots.forEach(function (dot, i) {
      var dotRect = dot.getBoundingClientRect();
      if (dotRect.top < triggerY) {
        dot.classList.add('dot-active');
        if (cards[i]) cards[i].classList.add('card-active');
        lastActiveDotBottom = dotRect.top - wrapperRect.top + dot.offsetHeight / 2;
      }
    });

    if (lineFill) {
      lineFill.style.height = lastActiveDotBottom + 'px';
    }
  }

  window.addEventListener('scroll', handleJourneyScroll, { passive: true });
  handleJourneyScroll();
})();

// ===== ROTATING WORDS =====
(function () {
  var words = document.querySelectorAll('.animate-word');
  if (!words.length) return;
  var activeIndex = 0;

  setInterval(function () {
    words[activeIndex].classList.remove('word-active');
    activeIndex = (activeIndex + 1) % words.length;
    words[activeIndex].classList.add('word-active');
  }, 2000);
})();
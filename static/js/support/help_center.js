document.addEventListener('DOMContentLoaded', function () {

    var backBtn = document.getElementById('back-btn');
    if (backBtn) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 200) {
                backBtn.classList.add('scrolled');
            } else {
                backBtn.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach(function (el) {
        revealObserver.observe(el);
    });

    var faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(function (item) {
        var btn = item.querySelector('.faq-btn');
        btn.addEventListener('click', function () {
            var isOpen = item.classList.contains('open');
            faqItems.forEach(function (other) {
                if (other !== item) {
                    other.classList.remove('open');
                    var otherBtn = other.querySelector('.faq-btn');
                    if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                }
            });
            item.classList.toggle('open', !isOpen);
            btn.setAttribute('aria-expanded', String(!isOpen));
        });
    });

    var searchInput = document.getElementById('help-search');
    var categoryCards = document.querySelectorAll('#category-grid .category-card');
    var noResults = document.getElementById('no-results');
    var faqSection = document.getElementById('faq-section');
    var debounceTimer = null;

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                performSearch(searchInput.value.trim().toLowerCase());
            }, 200);
        });
    }

    function performSearch(query) {
        if (!query) {
            categoryCards.forEach(function (card) { card.style.display = ''; card.style.opacity = '1'; });
            faqItems.forEach(function (item) { item.style.display = ''; });
            if (noResults) noResults.classList.add('hidden');
            return;
        }

        var faqMatchCount = 0;
        var cardMatchCount = 0;

        faqItems.forEach(function (item) {
            var text = item.textContent.toLowerCase();
            if (text.indexOf(query) !== -1) {
                item.style.display = '';
                faqMatchCount++;
                item.classList.add('open');
                var btn = item.querySelector('.faq-btn');
                if (btn) btn.setAttribute('aria-expanded', 'true');
            } else {
                item.style.display = 'none';
                item.classList.remove('open');
            }
        });

        categoryCards.forEach(function (card) {
            var text = card.textContent.toLowerCase();
            if (text.indexOf(query) !== -1) {
                card.style.display = '';
                card.style.opacity = '1';
                cardMatchCount++;
            } else {
                card.style.display = 'none';
            }
        });

        var totalMatches = faqMatchCount + cardMatchCount;
        if (noResults) noResults.classList.toggle('hidden', totalMatches > 0);

        if (faqMatchCount > 0 && faqSection) {
            faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    categoryCards.forEach(function (card) {
        var href = card.getAttribute('href');
        if (href && href.charAt(0) === '#') {
            card.addEventListener('click', function (e) {
                var target = document.getElementById(href.substring(1));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (target.classList.contains('faq-item')) {
                        faqItems.forEach(function (other) { other.classList.remove('open'); });
                        target.classList.add('open');
                        var btn = target.querySelector('.faq-btn');
                        if (btn) btn.setAttribute('aria-expanded', 'true');
                    }
                }
            });
        }
    });

});

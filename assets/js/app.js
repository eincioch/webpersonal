(function () {
  const GITHUB_USER = 'eincioch';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Año footer
    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Nav móvil
    setupNavToggle();

    // Tema
    setupTheme();

    // Pintar timeline desde JSON embebido
    renderExperience();

    // Cargar GitHub
    await loadGitHub();

    // Accesibilidad: quitar no-js
    document.documentElement.classList.remove('no-js');
  }

  function setupNavToggle() {
    const btn = $('.nav-toggle');
    const list = $('#nav-links');
    if (!btn || !list) return;
    btn.addEventListener('click', () => {
      const open = list.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  function setupTheme() {
    const toggle = $('#theme-toggle');
    const label = $('#theme-label');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const saved = localStorage.getItem('theme'); // 'dark' | 'light' | null
    const initial = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(initial);

    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('theme', next);
      });
    }

    function applyTheme(mode) {
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
        if (label) label.textContent = 'oscuro';
      } else {
        document.documentElement.classList.remove('dark');
        if (label) label.textContent = 'claro';
      }
    }
  }

  async function loadGitHub() {
    const userUrl = `https://api.github.com/users/${GITHUB_USER}`;
    const reposUrl = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`;

    try {
      const [userRes, reposRes] = await Promise.all([
        fetch(userUrl, { headers: { 'Accept': 'application/vnd.github+json' } }),
        fetch(reposUrl, { headers: { 'Accept': 'application/vnd.github+json' } })
      ]);

      if (!userRes.ok) throw new Error(`GitHub user error: ${userRes.status}`);
      if (!reposRes.ok) throw new Error(`GitHub repos error: ${reposRes.status}`);

      const user = await userRes.json();
      const repos = await reposRes.json();

      renderUser(user);
      renderRepos(repos);
      renderSkills(repos);
      renderContacts(user);
    } catch (err) {
      console.warn('GitHub fetch failed:', err);
      const empty = $('#repos-empty');
      if (empty) empty.hidden = false;
    }
  }

  function renderUser(user) {
    $('#user-name') && ($('#user-name').textContent = user.name || user.login || 'Perfil');
    $('#user-bio') && ($('#user-bio').textContent = user.bio || 'Creo software útil, simple y mantenible.');
    const avatar = $('#user-avatar');
    if (avatar && user.avatar_url) {
      avatar.src = `${user.avatar_url}&s=360`;
      avatar.alt = `Foto de ${user.name || user.login}`;
      avatar.referrerPolicy = 'no-referrer';
      avatar.loading = 'eager';
    }

    const loc = $('#user-location'); if (loc) loc.textContent = user.location ? `🌍 ${user.location}` : '🌍 —';
    const company = $('#user-company'); if (company) company.textContent = user.company ? `🏢 ${user.company}` : '🏢 —';
    const blog = $('#user-blog');
    if (blog) {
      if (user.blog) {
        blog.innerHTML = `🔗 <a href="${ensureHttp(user.blog)}" target="_blank" rel="noopener">Sitio</a>`;
      } else {
        blog.textContent = '🔗 —';
      }
    }
    const followers = $('#user-followers');
    if (followers) followers.textContent = typeof user.followers === 'number' ? `👥 ${user.followers} seguidores` : '👥 —';

    const ghBtn = $('#cta-github');
    if (ghBtn && user.html_url) ghBtn.href = user.html_url;

    // CV: si no existe el actual, usar el antiguo
    const cvBtn = $('#cta-cv');
    if (cvBtn) {
      // Intento optimista de usar el actual; si da 404 al navegar el usuario verá el antiguo:
      cvBtn.href = 'assets/files/cv_thony_actualizado.pdf';
    }
  }

  function renderRepos(repos) {
    const grid = $('#repos-grid');
    const empty = $('#repos-empty');
    if (!grid) return;

    // Filtrar forks y archivados
    const filtered = repos
      .filter(r => !r.fork && !r.archived)
      // ordenar por estrellas y luego por última actualización
      .sort((a, b) => {
        const starDiff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
        if (starDiff !== 0) return starDiff;
        return new Date(b.pushed_at) - new Date(a.pushed_at);
      })
      .slice(0, 6);

    grid.innerHTML = '';

    if (filtered.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }

    for (const r of filtered) {
      const card = document.createElement('a');
      card.className = 'card';
      card.href = r.homepage || r.html_url;
      card.target = '_blank';
      card.rel = 'noopener';

      const title = document.createElement('h3');
      title.textContent = r.name;

      const desc = document.createElement('p');
      desc.className = 'desc';
      desc.textContent = r.description || 'Repositorio de GitHub';

      const meta = document.createElement('div');
      meta.className = 'meta-row';
      meta.innerHTML = `
        <span>⭐ ${r.stargazers_count || 0}</span>
        <span>🍴 ${r.forks_count || 0}</span>
        ${r.language ? `<span>💡 ${r.language}</span>` : ''}
        <span>⏱️ ${timeAgo(r.pushed_at)}</span>
      `;

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(meta);
      grid.appendChild(card);
    }
  }

  function renderSkills(repos) {
    const holder = $('#skills-list');
    if (!holder) return;

    const counts = new Map();
    repos.forEach(r => {
      if (r.language) {
        counts.set(r.language, (counts.get(r.language) || 0) + 1);
      }
    });

    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    holder.innerHTML = '';
    if (top.length === 0) {
      holder.innerHTML = '<span class="muted">No hay datos de lenguajes aún.</span>';
      return;
    }

    for (const [lang, n] of top) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = `${lang} · ${n}`;
      holder.appendChild(chip);
    }
  }

  function renderContacts(user) {
    const siteLink = $('#contact-website');
    const blogLink = $('#contact-blog');

    const url = user.blog ? ensureHttp(user.blog) : null;

    if (url && siteLink) {
      siteLink.href = url;
      siteLink.hidden = false;
    }

    // Si el blog está en el perfil (a veces mismo que web), lo mostramos
    if (url && blogLink) {
      blogLink.href = url;
      blogLink.hidden = false;
    }
  }

  function renderExperience() {
    const el = $('#experience-data');
    const timeline = $('#timeline');
    if (!el || !timeline) return;

    try {
      const items = JSON.parse(el.textContent.trim());
      timeline.innerHTML = '';
      for (const it of items) {
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="role">${escapeHtml(it.role || '')}</div>
          <div class="company">${escapeHtml(it.company || '')} · ${escapeHtml(it.period || '')}</div>
          <p class="summary">${escapeHtml(it.summary || '')}</p>
        `;
        timeline.appendChild(li);
      }
    } catch (e) {
      console.warn('Experiencia inválida', e);
    }
  }

  // Utils
  function ensureHttp(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  }

  function timeAgo(iso) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000; // seconds
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

    const units = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
      ['second', 1]
    ];
    for (const [unit, sec] of units) {
      const val = Math.floor(diff / sec);
      if (Math.abs(val) >= 1) return rtf.format(-val, unit);
    }
    return 'ahora';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
})();
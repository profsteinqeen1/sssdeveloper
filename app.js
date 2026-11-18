(function () {
  'use strict';

  const PAGE_SIZE = 60;
  let currentCat = 'video';
  let searchQuery = '';
  let visibleCount = PAGE_SIZE;
  let filteredItems = [];
  let observer = null;

  const grid = document.getElementById('grid');
  const itemCount = document.getElementById('itemCount');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const catBtns = document.querySelectorAll('.cat-btn');
  const modal = document.getElementById('viewerModal');
  const modalContent = document.getElementById('modalContent');
  const modalTitle = document.getElementById('modalTitle');
  const modalClose = document.getElementById('modalClose');

  if (!grid || !itemCount || !modal || !modalContent || !modalTitle) {
    console.error('Sayfa elemanları eksik. index.html dosyasını kontrol et.');
    return;
  }

  const mediaList = (typeof MEDIA !== 'undefined' && Array.isArray(MEDIA))
    ? MEDIA.filter(item =>
        item &&
        ['video', 'gif', 'photo'].includes(item.type) &&
        typeof item.path === 'string' &&
        item.path.trim() !== ''
      )
    : [];

  function getFiltered() {
    const q = searchQuery.toLocaleLowerCase('tr-TR');
    return mediaList.filter(item => {
      if (item.type !== currentCat) return false;
      if (!q) return true;
      return `${item.title || ''} ${item.path || ''}`
        .toLocaleLowerCase('tr-TR')
        .includes(q);
    });
  }

  function makeBadge(item) {
    const badge = document.createElement('span');
    badge.className = `card-badge ${
      item.type === 'video' ? 'badge-video' :
      item.type === 'gif' ? 'badge-gif' : 'badge-photo'
    }`;
    badge.textContent = item.type === 'video' ? 'VIDEO' :
      item.type === 'gif' ? 'GIF' : 'FOTO';
    return badge;
  }

  function makeCard(item) {
    const card = document.createElement('article');
    card.className = 'card';

    const media = document.createElement('div');
    media.className = 'card-media';
    media.appendChild(makeBadge(item));

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.className = 'card-preview';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-label', item.title || 'Video önizlemesi');
      video.dataset.src = item.path;

      const play = document.createElement('div');
      play.className = 'card-play';
      play.setAttribute('aria-hidden', 'true');
      play.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>';

      video.addEventListener('error', () => {
        video.classList.add('media-error');
      });
      media.append(video, play);
    } else {
      const img = document.createElement('img');
      img.src = item.thumb || item.path;
      img.alt = item.title || 'Görsel';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => {
        img.classList.add('media-error');
        img.removeAttribute('src');
      }, { once: true });
      media.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'card-info';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = item.title || 'İsimsiz';

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = item.type.toUpperCase();

    info.append(title, meta);
    card.append(media, info);
    card.addEventListener('click', () => openItem(item));
    return card;
  }

  function setupLazyPreviews() {
    if (observer) observer.disconnect();

    const videos = grid.querySelectorAll('video[data-src]');
    if (!('IntersectionObserver' in window)) {
      videos.forEach(loadPreview);
      return;
    }

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadPreview(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '250px 0px' });

    videos.forEach(video => observer.observe(video));
  }

  function loadPreview(video) {
    if (!video.dataset.src || video.src) return;
    video.src = video.dataset.src;
    video.load();
  }

  function openItem(item) {
    modalTitle.textContent = item.title || 'İsimsiz';
    modalContent.replaceChildren();

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = item.path;
      video.style.width = '100%';
      video.style.maxWidth = '100%';
      video.style.maxHeight = 'calc(100vh - 120px)';
      video.style.borderRadius = '10px';
      video.addEventListener('error', () => {
        showMediaError('Bu video açılamadı. Dosya yolu veya video codec biçimi desteklenmiyor olabilir.');
      }, { once: true });

      modalContent.appendChild(video);
      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {
          // Tarayıcı otomatik oynatmayı engellerse kullanıcı oynat düğmesine basabilir.
        });
      }
    } else {
      const img = document.createElement('img');
      img.src = item.path;
      img.alt = item.title || 'Görsel';
      img.style.maxWidth = '100%';
      img.style.maxHeight = 'calc(100vh - 120px)';
      img.style.borderRadius = '10px';
      img.addEventListener('error', () => {
        showMediaError('Bu görsel açılamadı. Dosya yolunu ve dosya adını kontrol et.');
      }, { once: true });
      modalContent.appendChild(img);
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function showMediaError(message) {
    let error = modalContent.querySelector('.media-load-error');
    if (!error) {
      error = document.createElement('p');
      error.className = 'media-load-error';
      modalContent.appendChild(error);
    }
    error.textContent = message;
  }

  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    const video = modalContent.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    modalContent.replaceChildren();
  }

  function render() {
    filteredItems = getFiltered();
    visibleCount = PAGE_SIZE;
    grid.replaceChildren();

    const total = filteredItems.length;
    itemCount.textContent = `${total} içerik`;

    if (emptyState) {
      emptyState.classList.toggle('hidden', total !== 0);
    }

    if (total === 0) {
      removeLoadMore();
      return;
    }

    appendNextPage();
  }

  function appendNextPage() {
    const start = grid.children.length;
    const end = Math.min(visibleCount, filteredItems.length);
    const fragment = document.createDocumentFragment();

    for (let i = start; i < end; i++) {
      fragment.appendChild(makeCard(filteredItems[i]));
    }
    grid.appendChild(fragment);

    setupLazyPreviews();
    updateLoadMore();
  }

  function removeLoadMore() {
    const button = document.getElementById('loadMoreBtn');
    if (button) button.remove();
  }

  function updateLoadMore() {
    let button = document.getElementById('loadMoreBtn');
    if (grid.children.length >= filteredItems.length) {
      removeLoadMore();
      return;
    }

    if (!button) {
      button = document.createElement('button');
      button.id = 'loadMoreBtn';
      button.type = 'button';
      button.className = 'load-more-btn';
      button.textContent = 'Daha fazla yükle';
      button.addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        appendNextPage();
      });
      grid.insertAdjacentElement('afterend', button);
    }
  }

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      render();
    });
  });

  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim();
        render();
      }, 180);
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  if (mediaList.length === 0) {
    console.error('MEDIA listesi bulunamadı veya boş. js/media.js dosyasını kontrol et.');
  } else {
    console.info(`Medya listesi yüklendi: ${mediaList.length} dosya`);
  }

  render();
})();

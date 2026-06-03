const studentUser = JSON.parse(localStorage.getItem('lutaedanca_user'));
const currentUser = studentUser;
const initialSection = window.location.hash?.replace('#', '') ||
                       new URLSearchParams(window.location.search).get('section') ||
                       'inicio';

if (!studentUser) {
  window.location.href = 'login.html';
}

const rankProgress = {
  'faixa branca': 28,
  'faixa azul': 52,
  'faixa roxa': 74,
  'faixa marro': 86,
  'faixa preta': 96
};

const progressValue = rankProgress[studentUser?.rango?.toLowerCase()] || 40;
const displayName = studentUser?.nombre || 'Estudiante';
const rankLabel = studentUser?.rango || 'Sin rango';
const paymentLabel = studentUser?.metodo_pago ? studentUser.metodo_pago.charAt(0).toUpperCase() + studentUser.metodo_pago.slice(1) : 'Tarjeta';

const studentName = document.getElementById('student-name');
const studentMeta = document.getElementById('student-meta');
const dashboardTitle = document.getElementById('dashboard-title');
const studentRank = document.getElementById('student-rank');
const heroRankBadge = document.getElementById('hero-rank-badge');
const progressPercent = document.getElementById('progress-percent');
const progressBar = document.getElementById('progress-bar');
const paymentMethod = document.getElementById('payment-method');
const accountStatus = document.getElementById('account-status');
const lastSession = document.getElementById('last-session');
const logoutBtn = document.getElementById('logout-btn');
const forumMessage = document.getElementById('forum-message');
const forumImageInput = document.getElementById('forum-image-input');
const forumImagePreviewWrap = document.getElementById('forum-image-preview-wrap');
const forumImagePreview = document.getElementById('forum-image-preview');
const forumImageRemoveBtn = document.getElementById('forum-image-remove-btn');
const publishForumBtn = document.getElementById('publish-forum-btn');
const forumPostList = document.getElementById('forum-post-list');
const forumFilterChips = document.getElementById('forum-filter-chips');
const notificationToggle = document.getElementById('notification-toggle');
const notificationPanel = document.getElementById('notification-panel');
const notificationList = document.getElementById('notification-list');
const notificationBadge = document.getElementById('notification-badge');
const markAllReadBtn = document.getElementById('mark-all-read-btn');
const novedadesList = document.getElementById('novedades-list');

let activeHashtag = '';

if (studentName) studentName.textContent = displayName;
if (studentMeta) studentMeta.textContent = `${rankLabel} • ${paymentLabel}`;
if (dashboardTitle) dashboardTitle.textContent = `Hola, ${displayName.split(' ')[0]}`;
if (studentRank) studentRank.textContent = rankLabel;
if (heroRankBadge) heroRankBadge.textContent = rankLabel;
if (progressPercent) progressPercent.textContent = `${progressValue}%`;
if (progressBar) progressBar.style.width = `${progressValue}%`;
if (paymentMethod) paymentMethod.textContent = paymentLabel;
if (accountStatus) accountStatus.textContent = studentUser?.estado === 'pendiente' ? 'Pendiente' : 'Activo';
if (lastSession) lastSession.textContent = 'Hoy';

/* ══════════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════════ */
const SECTIONS = ['inicio','instruccionales','encyclopedia','puzzles','novedades','editar-perfil'];
function initNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      showSection(link.dataset.section);
    });
  });
  document.querySelectorAll('.quick-action-btn[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.goto));
  });
}

function showSection(name) {
  if (!SECTIONS.includes(name)) name = 'inicio';
  SECTIONS.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.nav-item[data-section]').forEach(link => {
    link.classList.toggle('active', link.dataset.section === name);
  });
  window.history.replaceState(null, '', `#${name}`);
  if (name === 'estadisticas') renderEstadisticas();
  if (name === 'novedades') loadNovedades();
}

async function loadNovedades() {
  if (!novedadesList) return;
  novedadesList.innerHTML = '<p class="empty-state-msg">Cargando novedades…</p>';

  try {
    const [videosRes, imagenesRes, diagramasRes] = await Promise.all([
      fetch('/api/mod/videos').then(res => res.json()),
      fetch('/api/mod/imagenes').then(res => res.json()),
      fetch('/api/mod/diagramas').then(res => res.json()),
    ]);

    const videos = videosRes.videos || [];
    const imagenes = imagenesRes.imagenes || [];
    const diagramas = diagramasRes.diagramas || [];

    const items = [
      ...videos.map(v => ({
        id: v.id,
        type: 'Video',
        icon: '🎬',
        title: v.titulo,
        meta: `${v.categoria || 'Sin categoría'} · ${v.dificultad || 'Sin nivel'}`,
        date: v.creado_en,
        extra: v.hashtags?.map(t => `#${t}`).join(' '),
      })),
      ...imagenes.map(i => ({
        id: i.id,
        type: 'Imagen',
        icon: '🖼️',
        title: i.titulo,
        meta: i.tipo || 'Sin tipo',
        date: i.creado_en,
        extra: i.hashtags?.map(t => `#${t}`).join(' '),
      })),
      ...diagramas.map(d => ({
        id: d.id,
        type: 'Diagrama',
        icon: '🗺️',
        title: d.titulo,
        meta: d.tipo || 'Sin tipo',
        date: d.creado_en,
        extra: d.descripcion || d.nodos || '',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    renderNovedades(items);
  } catch (error) {
    novedadesList.innerHTML = `<p class="error-state">No se pudieron cargar novedades. ${error.message}</p>`;
  }
}

function renderNovedades(items) {
  if (!novedadesList) return;
  if (!items.length) {
    novedadesList.innerHTML = '<p class="empty-state-msg">Aún no hay novedades recientes.</p>';
    return;
  }

  novedadesList.innerHTML = items.slice(0, 10).map(item => `
    <article class="novedad-card" data-id="${item.id}" data-type="${item.type}" data-profesor-id="${item.profesor_id || ''}">
      <div class="novedad-icon">${item.icon}</div>
      <div class="novedad-content">
        <p class="novedad-type">${item.type}</p>
        <h3 class="novedad-title">${item.title}</h3>
        ${item.profesor_nombre ? `<p class="novedad-subtitle">Por ${escapeHtml(item.profesor_nombre)}</p>` : ''}
        <p class="novedad-meta">${escapeHtml(item.meta)}</p>
        <p class="novedad-extra">${item.extra ? escapeHtml(item.extra) : ''}</p>
        <p class="novedad-date">${formatRelativeTime(item.date)}</p>
        <div class="novedad-actions">
          ${item.type === 'Video' ? `<button class="ghost-btn small-btn" data-action="view-video" data-id="${item.id}">Ver video</button>` : ''}
          ${item.profesor_id ? `<button class="ghost-btn small-btn" data-action="view-profile" data-id="${item.profesor_id}">Ver perfil</button>` : ''}
        </div>
      </div>
    </article>
  `).join('');
}

function escapeHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function openUserProfile(userId) {
  try {
    const response = await fetch(`/api/users/${userId}?viewer_id=${currentUser?.id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo cargar el perfil');

    const profile = data.profile;
    const followLabel = profile.is_following ? 'Dejar de seguir' : 'Seguir';
    const profileCard = `
      <div class="modal-card">
        <h2>${escapeHtml(profile.nombre)}</h2>
        <p>Rol: ${escapeHtml(profile.rol)}</p>
        <p>Rango: ${escapeHtml(profile.rango || 'N/A')}</p>
        <p>Seguidores: ${profile.followers_count}</p>
        <p>Siguiendo: ${profile.following_count}</p>
        <p>Videos: ${profile.video_count}</p>
        <p>Imágenes: ${profile.imagen_count}</p>
        <div class="modal-actions">
          <button class="ghost-btn" id="follow-user-btn" data-user-id="${profile.id}">${followLabel}</button>
          <button class="ghost-btn" id="close-modal-btn">Cerrar</button>
        </div>
      </div>
    `;
    showModal(profileCard);
  } catch (error) {
    alert(error.message || 'Error al cargar el perfil');
  }
}

async function toggleFollowUser(userId) {
  try {
    const response = await fetch(`/api/users/${userId}/follow`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({user_id: currentUser?.id})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo seguir al usuario');
    await openUserProfile(userId);
  } catch (error) {
    alert(error.message || 'Error al seguir/deseguir usuario');
  }
}

async function openVideoDetail(videoId) {
  try {
    const [videoResponse, commentsResponse] = await Promise.all([
      fetch(`/api/videos/${videoId}`),
      fetch(`/api/videos/${videoId}/comments`)
    ]);

    const videoData = await videoResponse.json();
    const commentsData = await commentsResponse.json();

    if (!videoResponse.ok) throw new Error(videoData.message || 'No se pudo cargar el video');
    if (!commentsResponse.ok) throw new Error(commentsData.message || 'No se pudieron cargar los comentarios');

    const video = videoData.video;
    const comments = commentsData.comments || [];
    const commentsHtml = comments.map(comment => `
      <div class="comment-item">
        <strong>${escapeHtml(comment.author_name)}</strong>
        <span>${formatRelativeTime(comment.created_at)}</span>
        <p>${escapeHtml(comment.message)}</p>
      </div>
    `).join('');

    const videoContent = `
      <div class="modal-card modal-video-card">
        <h2>${escapeHtml(video.titulo)}</h2>
        <p>Profesor: ${escapeHtml(video.profesor_nombre)}</p>
        <p>Categoría: ${escapeHtml(video.categoria)}</p>
        <p>Dificultad: ${escapeHtml(video.dificultad)}</p>
        <p>${escapeHtml(video.descripcion || '')}</p>
        <video controls src="${video.video_url}" class="novedad-video-preview"></video>
        <h3>Comentarios</h3>
        <div class="video-comments">${commentsHtml || '<p>No hay comentarios aún.</p>'}</div>
        <button class="ghost-btn" id="close-modal-btn">Cerrar</button>
      </div>
    `;
    showModal(videoContent);
  } catch (error) {
    alert(error.message || 'Error al cargar el video');
  }
}

function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;';
  overlay.innerHTML = `
    <div class="modal-body" style="background:#111;color:#fff;border:1px solid #444;border-radius:16px;max-width:720px;width:100%;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.5);">
      ${html}
    </div>
  `;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.id === 'close-modal-btn') {
      overlay.remove();
    }
  });
  document.body.appendChild(overlay);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'justo ahora';

  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'justo ahora';
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays}d`;
}

function sanitizeHandle(name) {
  return `@${(name || 'usuario')
    .trim()
    .replace(/\s+/g, ' ')}`;
}

function renderFilterChips(posts) {
  if (!forumFilterChips) return;

  const hashtags = [...new Set(posts.flatMap((post) => Array.isArray(post.hashtags) ? post.hashtags : []).map((tag) => tag.toLowerCase()))];
  forumFilterChips.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = `forum-filter-chip ${!activeHashtag ? 'active' : ''}`;
  allChip.textContent = 'Todos';
  allChip.dataset.hashtag = '';
  forumFilterChips.appendChild(allChip);

  hashtags.forEach((hashtag) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `forum-filter-chip ${activeHashtag === hashtag ? 'active' : ''}`;
    chip.textContent = `#${hashtag}`;
    chip.dataset.hashtag = hashtag;
    forumFilterChips.appendChild(chip);
  });
}

function renderForumPosts(posts) {
  if (!forumPostList) return;

  forumPostList.innerHTML = '';

  renderFilterChips(posts);

  if (!posts.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'forum-empty-state';
    emptyState.textContent = 'Aún no hay publicaciones. Sé el primero en compartir una duda.';
    forumPostList.appendChild(emptyState);
    return;
  }

  posts.forEach((post) => {
    const article = document.createElement('article');
    article.className = 'forum-post';
    article.dataset.postId = post.id;

    const meta = document.createElement('div');
    meta.className = 'forum-post-meta';

    const author = document.createElement('span');
    author.className = 'forum-author';
    author.textContent = sanitizeHandle(post.author_name);

    const time = document.createElement('span');
    time.className = 'forum-time';
    time.textContent = formatRelativeTime(post.created_at);

    meta.append(author, time);

    const title = document.createElement('h4');
    title.textContent = post.message.split('\n')[0].slice(0, 120) || 'Publicación del foro';

    const content = document.createElement('p');
    content.textContent = post.message;

    if (post.image_url) {
      const image = document.createElement('img');
      image.className = 'forum-post-image';
      image.src = post.image_url;
      image.alt = 'Imagen adjunta';
      image.loading = 'lazy';
      article.append(image);
    }

    const footer = document.createElement('div');
    footer.className = 'forum-post-footer';

    const tags = document.createElement('div');
    tags.className = 'forum-tag-list';

    const hashtagList = Array.isArray(post.hashtags) ? post.hashtags : [];
    hashtagList.forEach((hashtag) => {
      const tag = document.createElement('button');
      tag.type = 'button';
      tag.className = 'forum-tag';
      tag.textContent = `#${hashtag}`;
      tag.dataset.hashtag = hashtag.toLowerCase();
      tag.addEventListener('click', () => {
        activeHashtag = hashtag.toLowerCase();
        loadForumPosts();
      });
      tags.appendChild(tag);
    });

    if (!hashtagList.length) {
      const tag = document.createElement('span');
      tag.className = 'forum-tag';
      tag.textContent = '#comunidad';
      tags.appendChild(tag);
    }

    const stat = document.createElement('span');
    stat.className = 'forum-stat';
    stat.textContent = `${post.replies_count || 0} respuestas • ${post.likes_count || 0} likes`;

    footer.append(tags, stat);

    const actions = document.createElement('div');
    actions.className = 'forum-post-actions';

    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = `ghost-btn small-btn ${post.liked ? 'active' : ''}`;
    likeBtn.dataset.action = 'like';
    likeBtn.dataset.postId = post.id;
    likeBtn.textContent = `❤️ ${post.likes_count || 0}`;

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'ghost-btn small-btn';
    replyBtn.dataset.action = 'reply-toggle';
    replyBtn.dataset.postId = post.id;
    replyBtn.textContent = `💬 Responder (${post.replies_count || 0})`;

    actions.append(likeBtn, replyBtn);

    const replyBox = document.createElement('div');
    replyBox.className = 'forum-reply-box hidden';
    replyBox.id = `reply-box-${post.id}`;

    const replyInput = document.createElement('textarea');
    replyInput.className = 'forum-reply-input';
    replyInput.placeholder = 'Escribe una respuesta a esta publicación';

    const replyActions = document.createElement('div');
    replyActions.className = 'forum-post-actions';

    const submitReplyBtn = document.createElement('button');
    submitReplyBtn.type = 'button';
    submitReplyBtn.className = 'ghost-btn small-btn';
    submitReplyBtn.dataset.action = 'submit-reply';
    submitReplyBtn.dataset.postId = post.id;
    submitReplyBtn.textContent = 'Enviar respuesta';

    const cancelReplyBtn = document.createElement('button');
    cancelReplyBtn.type = 'button';
    cancelReplyBtn.className = 'ghost-btn small-btn';
    cancelReplyBtn.dataset.action = 'cancel-reply';
    cancelReplyBtn.dataset.postId = post.id;
    cancelReplyBtn.textContent = 'Cancelar';

    replyActions.append(submitReplyBtn, cancelReplyBtn);
    replyBox.append(replyInput, replyActions);

    const replyList = document.createElement('div');
    replyList.className = 'forum-reply-list';

    (post.replies || []).forEach((reply) => {
      const replyItem = document.createElement('div');
      replyItem.className = 'forum-reply-item';

      const replyMeta = document.createElement('div');
      replyMeta.className = 'forum-reply-meta';

      const replyAuthor = document.createElement('span');
      replyAuthor.textContent = sanitizeHandle(reply.author_name);

      const replyTime = document.createElement('span');
      replyTime.textContent = formatRelativeTime(reply.created_at);

      replyMeta.append(replyAuthor, replyTime);

      const replyContent = document.createElement('p');
      replyContent.className = 'forum-reply-content';
      replyContent.textContent = reply.message;

      replyItem.append(replyMeta, replyContent);
      replyList.appendChild(replyItem);
    });

    article.append(meta, title, content, footer, actions, replyBox, replyList);
    forumPostList.appendChild(article);
  });
}

async function loadForumPosts() {
  try {
    const params = new URLSearchParams();
    if (activeHashtag) params.set('hashtag', activeHashtag);
    params.set('user_id', currentUser?.id);

    const response = await fetch(`/api/forum/posts?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron cargar las publicaciones');
    }

    renderForumPosts(data.posts || []);
  } catch (error) {
    if (forumPostList) {
      forumPostList.innerHTML = `<div class="forum-empty-state">${error.message}</div>`;
    }
  }
}

async function publishForumPost() {
  if (!forumMessage || !publishForumBtn) return;

  const message = forumMessage.value.trim();
  if (!message) return;

  publishForumBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('user_id', currentUser?.id);
    formData.append('message', message);

    if (forumImageInput?.files?.[0]) {
      formData.append('image', forumImageInput.files[0]);
    }

    const response = await fetch('/api/forum/posts', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo publicar');
    }

    forumMessage.value = '';
    activeHashtag = '';
    if (forumImageInput) forumImageInput.value = '';
    if (forumImagePreviewWrap) forumImagePreviewWrap.classList.add('hidden');
    await loadForumPosts();
  } catch (error) {
    alert(error.message);
  } finally {
    publishForumBtn.disabled = false;
  }
}

async function toggleLike(postId) {
  try {
    const response = await fetch(`/api/forum/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: currentUser?.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo actualizar el like');
    }

    await loadForumPosts();
  } catch (error) {
    alert(error.message);
  }
}

async function addReply(postId, message) {
  const trimmed = message.trim();
  if (!trimmed) return;

  try {
    const response = await fetch(`/api/forum/posts/${postId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: currentUser?.id,
        message: trimmed
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo enviar la respuesta');
    }

    await loadForumPosts();
  } catch (error) {
    alert(error.message);
  }
}

function renderNotifications(notifications) {
  if (!notificationList) return;

  notificationList.innerHTML = '';

  if (!notifications.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'notification-empty-state';
    emptyState.textContent = 'No tienes notificaciones nuevas por el momento.';
    notificationList.appendChild(emptyState);
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement('article');
    item.className = `notification-item ${notification.read ? '' : 'unread'}`;

    const title = document.createElement('strong');
    title.textContent = notification.title;

    const message = document.createElement('p');
    message.textContent = notification.message;

    const meta = document.createElement('div');
    meta.className = 'notification-meta';

    const info = document.createElement('span');
    info.textContent = `${notification.type || 'info'} • ${notification.priority || 'normal'}`;

    const time = document.createElement('span');
    time.textContent = formatRelativeTime(notification.created_at);

    meta.append(info, time);

    item.append(title, message, meta);

    if (!notification.read) {
      const readBtn = document.createElement('button');
      readBtn.type = 'button';
      readBtn.className = 'ghost-btn small-btn';
      readBtn.textContent = 'Marcar leída';
      readBtn.addEventListener('click', async () => {
        await markNotificationRead(notification.id);
      });
      item.appendChild(readBtn);
    }

    notificationList.appendChild(item);
  });
}

async function loadNotifications() {
  try {
    const response = await fetch(`/api/notifications?user_id=${currentUser?.id}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron cargar las notificaciones');
    }

    const notifications = data.notifications || [];
    renderNotifications(notifications);

    const unreadCount = notifications.filter((item) => !item.read).length;
    if (notificationBadge) {
      notificationBadge.textContent = unreadCount;
      notificationBadge.style.display = unreadCount ? 'inline-grid' : 'none';
    }
  } catch (error) {
    if (notificationList) {
      notificationList.innerHTML = `<div class="notification-empty-state">${error.message}</div>`;
    }
  }
}

async function markNotificationRead(notificationId) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: currentUser?.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo marcar la notificación');
    }

    await loadNotifications();
  } catch (error) {
    alert(error.message);
  }
}

async function markAllNotificationsRead() {
  try {
    const response = await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: currentUser?.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo actualizar las notificaciones');
    }

    await loadNotifications();
  } catch (error) {
    alert(error.message);
  }
}

logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('lutaedanca_user');
  window.location.href = 'login.html';
});

publishForumBtn?.addEventListener('click', publishForumPost);
forumMessage?.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    publishForumPost();
  }
});

forumImageInput?.addEventListener('change', () => {
  const file = forumImageInput.files?.[0];
  if (!file) {
    forumImagePreviewWrap?.classList.add('hidden');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (forumImagePreview) {
      forumImagePreview.src = reader.result;
    }
    forumImagePreviewWrap?.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

forumImageRemoveBtn?.addEventListener('click', () => {
  if (forumImageInput) forumImageInput.value = '';
  if (forumImagePreviewWrap) forumImagePreviewWrap.classList.add('hidden');
  if (forumImagePreview) forumImagePreview.src = '';
});

forumPostList?.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const postId = Number(button.dataset.postId);

  if (button.dataset.action === 'like') {
    await toggleLike(postId);
    return;
  }

  if (button.dataset.action === 'reply-toggle') {
    const replyBox = document.getElementById(`reply-box-${postId}`);
    replyBox?.classList.toggle('hidden');
    return;
  }

  if (button.dataset.action === 'submit-reply') {
    const replyBox = document.getElementById(`reply-box-${postId}`);
    const textarea = replyBox?.querySelector('textarea');
    await addReply(postId, textarea?.value || '');
    replyBox?.classList.add('hidden');
    return;
  }

  if (button.dataset.action === 'cancel-reply') {
    const replyBox = document.getElementById(`reply-box-${postId}`);
    const textarea = replyBox?.querySelector('textarea');
    if (textarea) textarea.value = '';
    replyBox?.classList.add('hidden');
  }
});

forumFilterChips?.addEventListener('click', (event) => {
  const chip = event.target.closest('button[data-hashtag]');
  if (!chip) return;

  activeHashtag = chip.dataset.hashtag || '';
  loadForumPosts();
});

novedadesList?.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const id = Number(button.dataset.id);
  if (action === 'view-profile') {
    await openUserProfile(id);
  }
  if (action === 'view-video') {
    await openVideoDetail(id);
  }
});

document.addEventListener('click', async (event) => {
  const followBtn = event.target.closest('#follow-user-btn');
  if (followBtn) {
    const userId = Number(followBtn.dataset.userId);
    if (userId) {
      await toggleFollowUser(userId);
    }
  }
});

notificationToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  notificationPanel?.classList.toggle('hidden');
  notificationToggle?.setAttribute('aria-expanded', String(!notificationPanel?.classList.contains('hidden')));
});

markAllReadBtn?.addEventListener('click', markAllNotificationsRead);

document.addEventListener('click', (event) => {
  if (!notificationPanel || !notificationToggle) return;

  if (!notificationPanel.contains(event.target) && !notificationToggle.contains(event.target)) {
    notificationPanel.classList.add('hidden');
    notificationToggle.setAttribute('aria-expanded', 'false');
  }
});

initNav();
showSection(initialSection);

loadForumPosts();
loadNotifications();

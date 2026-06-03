const profesor = JSON.parse(localStorage.getItem('lutaedanca_user')) ||
                 JSON.parse(localStorage.getItem('currentUser'));
const currentUser = profesor;

if (!profesor) {
  window.location.href = 'login.html';
}

if (profesor && profesor.rol !== 'profesor') {
  window.location.href = profesor.rol === 'moderador'
    ? 'moderador-dashboard.html' : 'student-dashboard.html';
}

// ── API base (mismo origen que Flask) ──────────
const API = 'http://localhost:5001/api';

// ── Estado local ───────────────────────────────
const store = {
  videos:          [],
  imagenes:        [],
  instruccionales: [],
  diagramas:       [],
};
let nextId = 1;

/* ══════════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initNav();
  initUploadVideo();
  initUploadImagen();
  initInstruccionales();
  initDiagramas();
  initEstadisticas();
  initForum();
  initLogout();
  initPerfil();
  loadProfesorContent();
});

/* ══════════════════════════════════════════════
   UI BÁSICA
══════════════════════════════════════════════ */
function initUI() {
  const nombre = profesor.nombre || 'Instructor';
  const estado = profesor.estado || 'pendiente';

  setTextSafe('profesor-name', nombre);
  setTextSafe('profesor-meta', `@${(profesor.email || '').split('@')[0]}`);
  setTextSafe('dashboard-title', `Hola, ${nombre.split(' ')[0]}`);
  setTextSafe('hero-estado-badge', estado);
  setTextSafe('estado-cuenta', estado);
  setTextSafe('payment-method', estado);
  setTextSafe('account-status', fmtDate(profesor.creado_en));
  refreshSidebarCounters();
}

function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-BO', { year: 'numeric', month: 'short' });
}

function refreshSidebarCounters() {
  const total = store.videos.length + store.imagenes.length
    + store.instruccionales.length + store.diagramas.length;
  setTextSafe('total-contenido', `${total} elemento${total !== 1 ? 's' : ''}`);
  setTextSafe('footer-seguidores', '— alumnos te siguen');
  setTextSafe('total-videos', store.videos.length);
  setTextSafe('total-imagenes', store.imagenes.length);
  updateLastContentList();
}

function updateLastContentList() {
  const all = [
    ...store.videos.map(v        => ({ icon: '🎬', title: v.titulo,   meta: v.categoria })),
    ...store.imagenes.map(i      => ({ icon: '🖼️', title: i.titulo,   meta: i.tipo })),
    ...store.instruccionales.map(i => ({ icon: '📚', title: i.titulo, meta: i.nivel })),
    ...store.diagramas.map(d     => ({ icon: '🗺️', title: d.titulo,   meta: d.tipo })),
  ].slice(-5).reverse();

  const list = document.getElementById('ultimo-contenido-list');
  if (!list) return;

  if (all.length === 0) {
    list.innerHTML = '<p class="empty-state-msg">Aún no has subido contenido.</p>';
    return;
  }
  list.innerHTML = all.map(item => `
    <li class="session-item">
      <div>
        <p class="session-title">${item.icon} ${esc(item.title)}</p>
        <p class="session-time">${esc(item.meta || '')}</p>
      </div>
    </li>
  `).join('');
}
async function loadProfesorContent() {
  try {
    const [videosRes, imagenesRes, instruccionalesRes] = await Promise.all([
      fetch(`${API}/profesor/videos?profesor_id=${profesor.id}`).then(res => res.json()),
      fetch(`${API}/profesor/imagenes?profesor_id=${profesor.id}`).then(res => res.json()),
      fetch(`${API}/profesor/instruccionales?profesor_id=${profesor.id}`).then(res => res.json()),
    ]);

    store.videos = (videosRes.videos || []).map(v => ({
      ...v,
      fechaSubida: v.creado_en ? new Date(v.creado_en).toLocaleDateString('es-BO') : '—',
    }));
    store.imagenes = (imagenesRes.imagenes || []).map(i => ({
      ...i,
      fechaSubida: i.creado_en ? new Date(i.creado_en).toLocaleDateString('es-BO') : '—',
    }));
    store.instruccionales = (instruccionalesRes.instruccionales || []).map(i => ({
      ...i,
      fechaCreacion: i.creado_en ? new Date(i.creado_en).toLocaleDateString('es-BO') : '—',
    }));

    renderVideosList();
    renderImagenesGallery();
    renderInstList();
    refreshSidebarCounters();
  } catch (error) {
    console.warn('Error cargando contenido de profesor:', error);
  }
}

async function loadNovedadesProfesor() {
  const novedadesList = document.getElementById('novedades-list');
  if (!novedadesList) return;
  novedadesList.innerHTML = '<p class="empty-state-msg">Cargando novedades…</p>';

  try {
    const [videosRes, imagenesRes, diagramasRes] = await Promise.all([
      fetch(`${API}/mod/videos`).then(res => res.json()),
      fetch(`${API}/mod/imagenes`).then(res => res.json()),
      fetch(`${API}/mod/diagramas`).then(res => res.json()),
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

    if (!items.length) {
      novedadesList.innerHTML = '<p class="empty-state-msg">Aún no hay novedades recientes.</p>';
      return;
    }

    novedadesList.innerHTML = items.slice(0, 10).map(item => `
      <article class="novedad-card">
        <div class="novedad-icon">${item.icon}</div>
        <div class="novedad-content">
          <p class="novedad-type">${item.type}</p>
          <h3 class="novedad-title">${esc(item.title)}</h3>
          <p class="novedad-meta">${esc(item.meta)}</p>
          <p class="novedad-extra">${item.extra ? esc(item.extra) : ''}</p>
          <p class="novedad-date">${formatRelativeTime(item.date)}</p>
        </div>
      </article>
    `).join('');
  } catch (error) {
    novedadesList.innerHTML = `<p class="error-state">No se pudieron cargar novedades. ${error.message}</p>`;
  }
}

function initForum() {
  const forumImageInput = document.getElementById('forum-image-input');
  const forumImagePreviewWrap = document.getElementById('forum-image-preview-wrap');
  const forumImagePreview = document.getElementById('forum-image-preview');
  const removeBtn = document.getElementById('forum-image-remove-btn');

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

  removeBtn?.addEventListener('click', () => {
    if (forumImageInput) forumImageInput.value = '';
    forumImagePreviewWrap?.classList.add('hidden');
    if (forumImagePreview) forumImagePreview.src = '';
  });

  document.getElementById('publish-forum-btn')?.addEventListener('click', publishForumPostProfesor);
}

async function loadForumPostsProfesor() {
  const list = document.getElementById('forum-post-list');
  if (!list) return;
  list.innerHTML = '<p class="empty-state-msg">Cargando publicaciones del foro…</p>';

  try {
    const response = await fetch(`${API}/forum/posts?user_id=${profesor.id}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudieron cargar las publicaciones');
    const posts = data.posts || [];
    renderForumPostsProfesor(posts);
  } catch (error) {
    list.innerHTML = `<p class="error-state">${esc(error.message || 'Error al cargar foro')}</p>`;
  }
}

function renderForumPostsProfesor(posts) {
  const list = document.getElementById('forum-post-list');
  if (!list) return;
  if (!posts.length) {
    list.innerHTML = '<p class="empty-state-msg">Aún no hay publicaciones en el foro.</p>';
    return;
  }
  list.innerHTML = posts.map(post => `
    <article class="forum-post">
      <div class="forum-post-meta">
        <span class="forum-author">${esc(post.autor || 'Usuario')}</span>
        <span class="forum-time">${formatRelativeTime(post.creado_en)}</span>
      </div>
      <h4>${esc((post.mensaje || '').split('\n')[0].slice(0, 120))}</h4>
      <p>${esc(post.mensaje || '')}</p>
      ${post.image_url ? `<img class="forum-post-image" src="${esc(post.image_url)}" alt="Imagen adjunta" loading="lazy" />` : ''}
      ${post.hashtags?.length ? `<div class="forum-item-tags">${post.hashtags.map(tag => `<span class="forum-tag">#${esc(tag)}</span>`).join('')}</div>` : ''}
    </article>
  `).join('');
}

async function publishForumPostProfesor() {
  const forumMessage = document.getElementById('forum-message');
  const forumImageInput = document.getElementById('forum-image-input');
  if (!forumMessage) return;
  const message = (forumMessage.value || '').trim();
  if (!message) return;

  const formData = new FormData();
  formData.append('user_id', profesor.id);
  formData.append('message', message);
  if (forumImageInput?.files?.[0]) {
    formData.append('image', forumImageInput.files[0]);
  }

  try {
    const response = await fetch(`${API}/forum/posts`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo publicar en el foro');
    forumMessage.value = '';
    if (forumImageInput) forumImageInput.value = '';
    document.getElementById('forum-image-preview-wrap')?.classList.add('hidden');
    loadForumPostsProfesor();
  } catch (error) {
    alert(error.message || 'Error al publicar en el foro');
  }
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
/* ══════════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════════ */
const SECTIONS = ['inicio','subir-video','subir-imagen',
                  'instruccionales','diagramas','estadisticas','comunidad','perfil',
                  'encyclopedia','puzzles','novedades'];

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
  SECTIONS.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.nav-item[data-section]').forEach(link => {
    link.classList.toggle('active', link.dataset.section === name);
  });
  if (name === 'estadisticas') renderEstadisticas();
  if (name === 'perfil')       initPerfilSection();
  if (name === 'novedades')    loadNovedadesProfesor();
  if (name === 'comunidad')    loadForumPostsProfesor();
}

/* ══════════════════════════════════════════════
   SUBIR VIDEO
══════════════════════════════════════════════ */
function initUploadVideo() {
  const dropzone    = document.getElementById('video-dropzone');
  const fileInput   = document.getElementById('video-file-input');
  const preview     = document.getElementById('video-preview');
  const previewWrap = document.getElementById('video-preview-wrap');
  const fileNameEl  = document.getElementById('video-file-name');
  const submitBtn   = document.getElementById('video-submit-btn');
  const cancelBtn   = document.getElementById('video-cancel-btn');
  const feedback    = document.getElementById('video-feedback');

  if (!dropzone || !submitBtn) return;

  let selectedFile = null;

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleVideoFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleVideoFile(fileInput.files[0]);
  });

  function handleVideoFile(file) {
    const allowed = ['video/mp4','video/webm','video/quicktime'];
    if (!allowed.includes(file.type)) {
      showFeedback(feedback, 'error', 'Formato no permitido. Usa MP4, WebM o MOV.');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      showFeedback(feedback, 'error', 'El archivo supera los 500 MB.');
      return;
    }
    selectedFile = file;
    preview.src = URL.createObjectURL(file);
    fileNameEl.textContent = file.name;
    previewWrap.classList.remove('hidden');
    dropzone.style.display = 'none';
    hideFeedback(feedback);
  }

  function resetVideoForm() {
    selectedFile = null;
    if (preview.src) URL.revokeObjectURL(preview.src);
    preview.src = '';
    previewWrap.classList.add('hidden');
    dropzone.style.display = '';
    fileInput.value = '';
    ['video-titulo','video-descripcion','video-hashtags'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  cancelBtn.addEventListener('click', resetVideoForm);

  submitBtn.addEventListener('click', async () => {
    const titulo = document.getElementById('video-titulo').value.trim();
    if (!titulo)       { showFeedback(feedback, 'error', 'El título es obligatorio.'); return; }
    if (!selectedFile) { showFeedback(feedback, 'error', 'Selecciona un archivo de video.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Publicando…';

    const formData = new FormData();
    formData.append('profesor_id', profesor.id);
    formData.append('titulo', titulo);
    formData.append('categoria', document.getElementById('video-categoria').value);
    formData.append('dificultad', document.getElementById('video-dificultad').value);
    formData.append('descripcion', document.getElementById('video-descripcion').value.trim());
    formData.append('hashtags', document.getElementById('video-hashtags').value.trim());
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API}/profesor/videos`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al subir el video');

      store.videos.unshift({
        id:          data.video.id,
        titulo,
        categoria:   document.getElementById('video-categoria').value,
        dificultad:  document.getElementById('video-dificultad').value,
        descripcion: document.getElementById('video-descripcion').value.trim(),
        hashtags:    parseHashtags(document.getElementById('video-hashtags').value),
        fileName:    selectedFile.name,
        url:         URL.createObjectURL(selectedFile),
        fechaSubida: new Date().toLocaleDateString('es-BO'),
      });
      renderVideosList();
      refreshSidebarCounters();
      resetVideoForm();
      showFeedback(feedback, 'success', `✅ Video "${titulo}" publicado correctamente.`);
    } catch (error) {
      showFeedback(feedback, 'error', error.message || 'No se pudo subir el video.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '⬆️ Publicar video';
    }
  });
}

function renderVideosList() {
  const list  = document.getElementById('videos-list');
  const count = document.getElementById('videos-count');
  if (!list) return;

  if (count) count.textContent = `${store.videos.length} video${store.videos.length !== 1 ? 's' : ''}`;

  if (store.videos.length === 0) {
    list.innerHTML = '<p class="empty-state-msg">Aún no has subido videos.</p>';
    return;
  }
  list.innerHTML = store.videos.map(v => `
    <div class="media-item">
      <span class="media-item-icon">🎬</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(v.titulo)}</p>
        <p class="media-item-meta">${esc(v.categoria)} · ${esc(v.dificultad)} · ${esc(v.fechaSubida)}</p>
        <div class="media-item-tags">
          ${v.hashtags.map(t => `<span class="media-tag">#${esc(t)}</span>`).join('')}
        </div>
      </div>
      <div class="media-item-actions">
        <button class="icon-btn del" onclick="deleteVideo(${v.id})">🗑️</button>
      </div>
    </div>
  `).join('');
  refreshVideosSelector();
}

window.deleteVideo = id => {
  store.videos = store.videos.filter(v => v.id !== id);
  renderVideosList();
  refreshSidebarCounters();
};

/* ══════════════════════════════════════════════
   SUBIR IMAGEN
══════════════════════════════════════════════ */
function initUploadImagen() {
  const dropzone    = document.getElementById('imagen-dropzone');
  const fileInput   = document.getElementById('imagen-file-input');
  const preview     = document.getElementById('imagen-preview');
  const previewWrap = document.getElementById('imagen-preview-wrap');
  const fileNameEl  = document.getElementById('imagen-file-name');
  const submitBtn   = document.getElementById('imagen-submit-btn');
  const cancelBtn   = document.getElementById('imagen-cancel-btn');
  const feedback    = document.getElementById('imagen-feedback');

  if (!dropzone || !submitBtn) return;

  let selectedFile = null;
  let dataUrl      = null;

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleImagenFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleImagenFile(fileInput.files[0]);
  });

  function handleImagenFile(file) {
    const allowed = ['image/jpeg','image/png','image/webp'];
    if (!allowed.includes(file.type)) {
      showFeedback(feedback, 'error', 'Formato no permitido. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showFeedback(feedback, 'error', 'La imagen supera los 10 MB.');
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e2 => {
      dataUrl = e2.target.result;
      preview.src = dataUrl;
      fileNameEl.textContent = file.name;
      previewWrap.classList.remove('hidden');
      dropzone.style.display = 'none';
      hideFeedback(feedback);
    };
    reader.readAsDataURL(file);
  }

  function resetImagenForm() {
    selectedFile = null;
    dataUrl      = null;
    preview.src  = '';
    previewWrap.classList.add('hidden');
    dropzone.style.display = '';
    fileInput.value = '';
    ['imagen-titulo','imagen-descripcion','imagen-hashtags'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  cancelBtn.addEventListener('click', resetImagenForm);

  submitBtn.addEventListener('click', async () => {
    const titulo = document.getElementById('imagen-titulo').value.trim();
    if (!titulo)       { showFeedback(feedback, 'error', 'El título es obligatorio.'); return; }
    if (!selectedFile) { showFeedback(feedback, 'error', 'Selecciona un archivo de imagen.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Publicando…';

    const formData = new FormData();
    formData.append('profesor_id', profesor.id);
    formData.append('titulo', titulo);
    formData.append('tipo', document.getElementById('imagen-tipo').value);
    formData.append('descripcion', document.getElementById('imagen-descripcion').value.trim());
    formData.append('hashtags', document.getElementById('imagen-hashtags').value.trim());
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API}/profesor/imagenes`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al subir la imagen');

      store.imagenes.unshift({
        id:          data.imagen.id,
        titulo,
        tipo:        document.getElementById('imagen-tipo').value,
        descripcion: document.getElementById('imagen-descripcion').value.trim(),
        hashtags:    parseHashtags(document.getElementById('imagen-hashtags').value),
        fileName:    selectedFile.name,
        url:         data.imagen.url,
        fechaSubida: data.imagen.creado_en ? new Date(data.imagen.creado_en).toLocaleDateString('es-BO') : new Date().toLocaleDateString('es-BO'),
      });
      renderImagenesGallery();
      refreshSidebarCounters();
      resetImagenForm();
      showFeedback(feedback, 'success', `✅ Imagen "${titulo}" publicada correctamente.`);
    } catch (error) {
      showFeedback(feedback, 'error', error.message || 'No se pudo subir la imagen.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '⬆️ Publicar imagen';
    }
  });
}

function renderImagenesGallery() {
  const grid  = document.getElementById('imagenes-grid');
  const count = document.getElementById('imagenes-count');
  if (!grid) return;

  if (count) count.textContent = `${store.imagenes.length} imagen${store.imagenes.length !== 1 ? 'es' : ''}`;

  if (store.imagenes.length === 0) {
    grid.innerHTML = '<p class="empty-state-msg">Aún no has subido imágenes.</p>';
    return;
  }
  list.innerHTML = store.imagenes.map(img => {
    const src = img.dataUrl || img.url || '';
    return `
      <div class="gallery-img-wrap">
        <img class="gallery-img" src="${src}" alt="${esc(img.titulo)}" loading="lazy" />
        <div class="gallery-img-overlay">
          <p class="gallery-img-title">${esc(img.titulo)}</p>
          <button class="gallery-del-btn" onclick="deleteImagen(${img.id})">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

window.deleteImagen = id => {
  store.imagenes = store.imagenes.filter(i => i.id !== id);
  renderImagenesGallery();
  refreshSidebarCounters();
};

/* ══════════════════════════════════════════════
   INSTRUCCIONALES
══════════════════════════════════════════════ */
function initInstruccionales() {
  const submitBtn = document.getElementById('inst-submit-btn');
  const cancelBtn = document.getElementById('inst-cancel-btn');
  const feedback  = document.getElementById('inst-feedback');
  if (!submitBtn) return;

  cancelBtn.addEventListener('click', resetInstForm);

  submitBtn.addEventListener('click', async () => {
    const titulo = document.getElementById('inst-titulo').value.trim();
    if (!titulo) { showFeedback(feedback, 'error', 'El título es obligatorio.'); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando…';

    const body = {
      profesor_id: profesor.id,
      titulo,
      descripcion: document.getElementById('inst-descripcion').value.trim(),
      nivel:       document.getElementById('inst-nivel').value,
      categoria:   document.getElementById('inst-categoria').value,
      videos_ids:  getSelectedVideoIds(),
    };

    try {
      const res = await fetch(`${API}/profesor/instruccionales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al crear el instruccional');

      store.instruccionales.unshift({
        id:           data.instruccional.id,
        titulo,
        descripcion:  body.descripcion,
        nivel:        body.nivel,
        categoria:    body.categoria,
        videosIds:    body.videos_ids,
        fechaCreacion: data.instruccional.creado_en ? new Date(data.instruccional.creado_en).toLocaleDateString('es-BO') : new Date().toLocaleDateString('es-BO'),
      });
      renderInstList();
      refreshSidebarCounters();
      resetInstForm();
      showFeedback(feedback, 'success', `✅ Instruccional "${titulo}" creado.`);
    } catch (error) {
      showFeedback(feedback, 'error', error.message || 'No se pudo crear el instruccional.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar instruccional';
    }
  });
}

function getSelectedVideoIds() {
  return Array.from(
    document.querySelectorAll('#inst-videos-selector input[type="checkbox"]:checked')
  ).map(cb => parseInt(cb.value));
}

function refreshVideosSelector() {
  const selector = document.getElementById('inst-videos-selector');
  if (!selector) return;
  if (store.videos.length === 0) {
    selector.innerHTML = '<p class="empty-state-msg">Primero sube videos desde "Subir video".</p>';
    return;
  }
  selector.innerHTML = store.videos.map(v => `
    <label class="video-check-item">
      <input type="checkbox" value="${v.id}" />
      🎬 ${esc(v.titulo)}
      <span style="color:#888;font-size:0.75rem;margin-left:auto">${esc(v.dificultad)}</span>
    </label>
  `).join('');
}

function renderInstList() {
  const list  = document.getElementById('inst-list');
  const count = document.getElementById('inst-count');
  if (!list) return;
  if (count) count.textContent = `${store.instruccionales.length} curso${store.instruccionales.length !== 1 ? 's' : ''}`;

  if (store.instruccionales.length === 0) {
    list.innerHTML = '<p class="empty-state-msg">No has creado instruccionales aún.</p>';
    return;
  }
  list.innerHTML = store.instruccionales.map(inst => `
    <div class="media-item">
      <span class="media-item-icon">📚</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(inst.titulo)}</p>
        <p class="media-item-meta">${esc(inst.nivel)} · ${esc(inst.categoria)} · ${inst.videosIds.length} video${inst.videosIds.length !== 1 ? 's' : ''} · ${esc(inst.fechaCreacion)}</p>
      </div>
      <div class="media-item-actions">
        <button class="icon-btn del" onclick="deleteInst(${inst.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

function resetInstForm() {
  ['inst-titulo','inst-descripcion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

window.deleteInst = id => {
  store.instruccionales = store.instruccionales.filter(i => i.id !== id);
  renderInstList();
  refreshSidebarCounters();
};

/* ══════════════════════════════════════════════
   DIAGRAMAS
══════════════════════════════════════════════ */
function initDiagramas() {
  const submitBtn = document.getElementById('diag-submit-btn');
  const cancelBtn = document.getElementById('diag-cancel-btn');
  const feedback  = document.getElementById('diag-feedback');
  if (!submitBtn) return;

  const flowchartToggle = document.getElementById('open-flowchart-editor');
  const flowchartEditor = document.getElementById('flowchart-editor');
  const flowchartDataInput = document.getElementById('diag-flowchart-data');

  cancelBtn.addEventListener('click', resetDiagForm);

  flowchartToggle?.addEventListener('click', () => {
    flowchartEditor?.classList.toggle('hidden');
  });

  submitBtn.addEventListener('click', () => {
    const titulo = document.getElementById('diag-titulo').value.trim();
    const nodosRaw  = document.getElementById('diag-nodos').value.trim();
    const flowchartData = flowchartDataInput?.value.trim();
    const nodos = flowchartData || nodosRaw;
    if (!titulo) { showFeedback(feedback, 'error', 'El título es obligatorio.'); return; }
    if (!nodos)  { showFeedback(feedback, 'error', 'Agrega al menos un nodo o crea el diagrama visual.'); return; }

    store.diagramas.push({
      id:           nextId++,
      titulo,
      descripcion:  document.getElementById('diag-descripcion').value.trim(),
      nodos,
      tipo:         document.getElementById('diag-tipo').value,
      flujo:        flowchartData || null,
      fechaCreacion: new Date().toLocaleDateString('es-BO'),
    });
    renderDiagList();
    refreshSidebarCounters();
    resetDiagForm();
    showFeedback(feedback, 'success', `✅ Diagrama "${titulo}" guardado.`);
  });
}

function renderDiagList() {
  const list  = document.getElementById('diag-list');
  const count = document.getElementById('diag-count');
  if (!list) return;
  if (count) count.textContent = `${store.diagramas.length} diagrama${store.diagramas.length !== 1 ? 's' : ''}`;

  if (store.diagramas.length === 0) {
    list.innerHTML = '<p class="empty-state-msg">No has creado diagramas aún.</p>';
    return;
  }
  list.innerHTML = store.diagramas.map(d => `
    <div class="media-item">
      <span class="media-item-icon">🗺️</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(d.titulo)}</p>
        <p class="media-item-meta">${esc(d.tipo)} · ${esc(d.fechaCreacion)}</p>
        <p class="media-item-meta" style="font-size:0.72rem;margin-top:2px;white-space:pre-line">${esc(d.nodos.split('\n').slice(0,3).join('\n'))}${d.nodos.split('\n').length > 3 ? '\n…' : ''}</p>
      </div>
      <div class="media-item-actions">
        <button class="icon-btn del" onclick="deleteDiag(${d.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

function resetDiagForm() {
  ['diag-titulo','diag-descripcion','diag-nodos'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

window.deleteDiag = id => {
  store.diagramas = store.diagramas.filter(d => d.id !== id);
  renderDiagList();
  refreshSidebarCounters();
};

/* ══════════════════════════════════════════════
   ESTADÍSTICAS
══════════════════════════════════════════════ */
function initEstadisticas() {}

function renderEstadisticas() {
  setTextSafe('stat-seguidores', '—');
  setTextSafe('stat-videos', store.videos.length);
  setTextSafe('stat-inst', store.instruccionales.length);
  setTextSafe('hero-alumnos', '—');

  const list = document.getElementById('top-contenido-list');
  if (!list) return;

  const all = [
    ...store.videos.map(v          => ({ icon: '🎬', title: v.titulo, meta: `Video · ${v.categoria}` })),
    ...store.instruccionales.map(i => ({ icon: '📚', title: i.titulo, meta: `Instruccional · ${i.nivel}` })),
    ...store.diagramas.map(d       => ({ icon: '🗺️', title: d.titulo, meta: `Diagrama · ${d.tipo}` })),
  ];

  if (all.length === 0) {
    list.innerHTML = '<p class="empty-state-msg">Las estadísticas estarán disponibles una vez tengas contenido publicado.</p>';
    return;
  }
  list.innerHTML = all.map(item => `
    <div class="media-item">
      <span class="media-item-icon">${item.icon}</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(item.title)}</p>
        <p class="media-item-meta">${esc(item.meta)}</p>
      </div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════ */
function initLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    localStorage.removeItem('lutaedanca_user');
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('lutaedanca_user');
    window.location.href = 'login.html';
  });
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function showFeedback(el, type, msg) {
  if (!el) return;
  el.textContent = msg;
  el.className = `feedback-msg ${type}`;
  el.classList.remove('hidden');
  if (type === 'success') setTimeout(() => hideFeedback(el), 4000);
}

function hideFeedback(el) {
  if (!el) return;
  el.classList.add('hidden');
  el.textContent = '';
}

function parseHashtags(str) {
  return str.match(/#([A-Za-z0-9_áéíóúÁÉÍÓÚñÑ]+)/g)
    ?.map(t => t.slice(1).toLowerCase()) || [];
}

function simulateProgress(wrapperId, barId, onDone) {
  const wrap = document.getElementById(wrapperId);
  const bar  = document.getElementById(barId);
  if (!wrap || !bar) { onDone(); return; }
  wrap.classList.remove('hidden');
  let p = 0;
  const interval = setInterval(() => {
    p += Math.random() * 18 + 5;
    if (p >= 100) {
      p = 100;
      bar.style.width = '100%';
      clearInterval(interval);
      setTimeout(() => {
        wrap.classList.add('hidden');
        bar.style.width = '0%';
        onDone();
      }, 400);
    } else {
      bar.style.width = `${p}%`;
    }
  }, 120);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════
   PERFIL + MODERADOR
══════════════════════════════════════════════ */

// Se llama una vez en DOMContentLoaded para registrar los listeners
function initPerfil() {

  // ── Guardar cambios de perfil ───────────────
  document.getElementById('perfil-save-btn')?.addEventListener('click', async () => {
    const nombre           = document.getElementById('perfil-nombre').value.trim();
    const email            = document.getElementById('perfil-email').value.trim();
    const passwordActual   = document.getElementById('perfil-password-actual').value;
    const passwordNueva    = document.getElementById('perfil-password-nueva').value;
    const fb = document.getElementById('perfil-feedback');

    if (!nombre || !email || !passwordActual) {
      showFeedback(fb, 'error', 'Nombre, email y contraseña actual son obligatorios.');
      return;
    }

    try {
      const res = await fetch('/api/mod/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:         profesor.id,
          nombre,
          email,
          password_actual: passwordActual,
          password_nueva:  passwordNueva || null,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Actualizar sesión local con los nuevos datos
        const updated = { ...profesor, nombre: data.user.nombre, email: data.user.email };
        localStorage.setItem('lutaedanca_user', JSON.stringify(updated));
        localStorage.setItem('currentUser',     JSON.stringify(updated));
        // Reflejar en sidebar sin recargar
        setTextSafe('profesor-name',  updated.nombre);
        setTextSafe('profesor-meta',  `@${updated.email.split('@')[0]}`);
        setTextSafe('dashboard-title',`Hola, ${updated.nombre.split(' ')[0]}`);
        // Actualizar panel de info
        renderPerfilInfo(updated);
        showFeedback(fb, 'success', '✅ Perfil actualizado correctamente.');
        document.getElementById('perfil-password-actual').value = '';
        document.getElementById('perfil-password-nueva').value  = '';
      } else {
        showFeedback(fb, 'error', data.message || 'Error al guardar.');
      }
    } catch (e) {
      showFeedback(fb, 'error', 'Error de conexión con el servidor.');
    }
  });

  // ── Convertirse en moderador ────────────────
  document.getElementById('mod-register-btn')?.addEventListener('click', async () => {
    const codigo = document.getElementById('mod-codigo').value.trim();
    const fb     = document.getElementById('mod-register-feedback');

    if (!codigo) {
      showFeedback(fb, 'error', 'Ingresa el código de autorización.');
      return;
    }

    const btn = document.getElementById('mod-register-btn');
    btn.disabled = true;
    btn.textContent = 'Verificando…';

    try {
      const res = await fetch('/api/register-moderador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profesor.id, codigo }),
      });
      const data = await res.json();

      if (data.success) {
        // Actualizar sesión con el nuevo rol
        const updated = { ...profesor, rol: 'moderador' };
        localStorage.setItem('lutaedanca_user', JSON.stringify(updated));
        localStorage.setItem('currentUser',     JSON.stringify(updated));
        showFeedback(fb, 'success', '✅ Cuenta convertida a moderador. Redirigiendo…');
        setTimeout(() => { window.location.href = 'moderador-dashboard.html'; }, 1800);
      } else {
        showFeedback(fb, 'error', data.message || 'Código incorrecto.');
        btn.disabled = false;
        btn.textContent = '🛡️ Convertirme en moderador';
      }
    } catch (e) {
      showFeedback(fb, 'error', 'Error de conexión con el servidor.');
      btn.disabled = false;
      btn.textContent = '🛡️ Convertirme en moderador';
    }
  });
}

// Se llama cada vez que se navega a la sección perfil
function initPerfilSection() {
  const user = JSON.parse(
    localStorage.getItem('lutaedanca_user') ||
    localStorage.getItem('currentUser')
  ) || profesor;

  document.getElementById('perfil-nombre').value = user.nombre || '';
  document.getElementById('perfil-email').value  = user.email  || '';
  document.getElementById('perfil-password-actual').value = '';
  document.getElementById('perfil-password-nueva').value  = '';
  document.getElementById('mod-codigo').value             = '';

  renderPerfilInfo(user);
}

function renderPerfilInfo(user) {
  setTextSafe('perfil-info-nombre', user.nombre    || '—');
  setTextSafe('perfil-info-email',  user.email     || '—');
  setTextSafe('perfil-info-estado', user.estado    || '—');
  setTextSafe('perfil-info-desde',  fmtDate(user.creado_en));
}

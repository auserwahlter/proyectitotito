/* ═══════════════════════════════════════════════
   moderador-dashboard.js  —  versión completa
   ═══════════════════════════════════════════════ */

const currentUser = JSON.parse(
  localStorage.getItem('lutaedanca_user') ||
  localStorage.getItem('currentUser')
);
if (!currentUser) { window.location.href = 'login.html'; }
if (currentUser && currentUser.rol !== 'moderador') {
  window.location.href = currentUser.rol === 'profesor'
    ? 'profesor-dashboard.html' : 'student-dashboard.html';
}
const mod = currentUser;

/* ── Cache de datos ────────────────────────────── */
const cache = { usuarios: [], videos: [], imagenes: [], instruccionales: [], diagramas: [], posts: [] };
let reportBlob = null;
let reportFilename = '';

/* ════════════════════════════════════════════════
   BOOTSTRAP
════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setEl('mod-name', mod.nombre || 'Moderador');
  setEl('mod-meta', `@${(mod.email || '').split('@')[0]}`);
  initNav();
  initModals();
  initPerfil();
  initLogout();
  loadInicio();
});

/* ════════════════════════════════════════════════
   NAVEGACIÓN
════════════════════════════════════════════════ */
const SECTIONS = ['inicio','usuarios','videos','imagenes','instruccionales','diagramas','foro','reportes','perfil'];
const TITLES   = { inicio:'Panel de moderación', usuarios:'Gestión de usuarios', videos:'Videos de profesores',
                   imagenes:'Imágenes técnicas', instruccionales:'Instruccionales', diagramas:'Diagramas tácticos',
                   foro:'Moderación del foro', reportes:'Reportes y exportación', perfil:'Mi perfil' };

function initNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(l =>
    l.addEventListener('click', e => { e.preventDefault(); showSection(l.dataset.section); })
  );
  document.querySelectorAll('.quick-action-btn[data-goto]').forEach(b =>
    b.addEventListener('click', () => showSection(b.dataset.goto))
  );
}

function showSection(name) {
  SECTIONS.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  document.querySelectorAll('.nav-item[data-section]').forEach(l =>
    l.classList.toggle('active', l.dataset.section === name)
  );
  setEl('section-title', TITLES[name] || name);
  const loaders = { usuarios: loadUsuarios, videos: loadVideos, imagenes: loadImagenes,
                    instruccionales: loadInstruccionales, diagramas: loadDiagramas,
                    foro: loadForo, perfil: loadPerfil };
  if (loaders[name]) loaders[name]();
}

/* ════════════════════════════════════════════════
   INICIO — métricas y pendientes
════════════════════════════════════════════════ */
async function loadInicio() {
  try {
    const [uRes, vRes, iRes, instRes, pRes] = await Promise.all([
      api('/api/mod/usuarios'),
      api('/api/mod/videos'),
      api('/api/mod/imagenes'),
      api('/api/mod/instruccionales'),
      api('/api/forum/posts'),
    ]);
    cache.usuarios       = uRes.usuarios        || [];
    cache.videos         = vRes.videos          || [];
    cache.imagenes       = iRes.imagenes        || [];
    cache.instruccionales= instRes.instruccionales || [];
    cache.posts          = pRes.posts           || [];

    setEl('stat-total-usuarios', cache.usuarios.length);
    setEl('stat-alumnos',        cache.usuarios.filter(u=>u.rol==='alumno').length);
    setEl('stat-profesores',     cache.usuarios.filter(u=>u.rol==='profesor').length);
    setEl('stat-moderadores',    cache.usuarios.filter(u=>u.rol==='moderador').length);
    setEl('stat-videos',         cache.videos.length);
    setEl('stat-instruccionales',cache.instruccionales.length);
    setEl('stat-posts',          cache.posts.length);
    const pendientes = cache.usuarios.filter(u=>u.estado==='pendiente');
    setEl('stat-pendientes', pendientes.length);

    const pl = document.getElementById('pendientes-list');
    if (!pl) return;
    if (pendientes.length === 0) { pl.innerHTML = '<p class="empty-state-msg">Sin usuarios pendientes. ✅</p>'; return; }
    pl.innerHTML = pendientes.map(u => `
      <div class="media-item">
        <span class="media-item-icon">${u.rol==='profesor'?'🥋':'🧑'}</span>
        <div class="media-item-body">
          <p class="media-item-title">${esc(u.nombre)}</p>
          <p class="media-item-meta">${esc(u.email)} · <span class="badge badge-${u.rol}">${esc(u.rol)}</span></p>
        </div>
        <div class="media-item-actions">
          <button class="icon-btn" onclick="quickEstado(${u.id},'activo')">✅ Activar</button>
          <button class="icon-btn del" onclick="quickEstado(${u.id},'suspendido')">🚫</button>
        </div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

window.quickEstado = async (id, estado) => {
  await apiPut(`/api/mod/usuarios/${id}`, { mod_id: mod.id, estado });
  loadInicio();
};

/* ════════════════════════════════════════════════
   USUARIOS — CRUD completo
════════════════════════════════════════════════ */
async function loadUsuarios() {
  const wrap = document.getElementById('usuarios-table-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p class="empty-state-msg">Cargando…</p>';
  const data = await api('/api/mod/usuarios');
  cache.usuarios = data.usuarios || [];
  renderUsuariosTable(cache.usuarios);

  document.getElementById('filter-btn').onclick = () => {
    const q      = (document.getElementById('search-usuario').value || '').toLowerCase();
    const rol    = document.getElementById('filter-rol').value;
    const estado = document.getElementById('filter-estado').value;
    let lista = cache.usuarios;
    if (q)      lista = lista.filter(u => u.nombre?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    if (rol)    lista = lista.filter(u => u.rol    === rol);
    if (estado) lista = lista.filter(u => u.estado === estado);
    renderUsuariosTable(lista);
  };
  document.getElementById('nuevo-usuario-btn').onclick = () =>
    document.getElementById('new-user-modal').classList.remove('hidden');
}

function renderUsuariosTable(lista) {
  const wrap = document.getElementById('usuarios-table-wrap');
  if (!wrap) return;
  if (lista.length === 0) { wrap.innerHTML = '<p class="empty-state-msg">Sin resultados.</p>'; return; }
  wrap.innerHTML = `
    <table class="mod-table">
      <thead><tr>
        <th>ID</th><th>Nombre</th><th>Email</th><th>Rol</th>
        <th>Estado</th><th>Rango</th><th>Método pago</th><th>Registro</th><th>Acciones</th>
      </tr></thead>
      <tbody>${lista.map(u=>`
        <tr>
          <td>${u.id}</td>
          <td>${esc(u.nombre)}</td>
          <td>${esc(u.email)}</td>
          <td><span class="badge badge-${u.rol}">${esc(u.rol)}</span></td>
          <td><span class="badge badge-${u.estado||'pendiente'}">${esc(u.estado||'pendiente')}</span></td>
          <td>${esc(u.rango||'—')}</td>
          <td>${esc(u.metodo_pago||'—')}</td>
          <td>${fmtDate(u.creado_en)}</td>
          <td><div class="tbl-actions">
            <button class="icon-btn" onclick="openEditModal(${u.id})">✏️</button>
            <button class="icon-btn" onclick="quickEstadoTabla(${u.id},'activo')" title="Activar">✅</button>
            <button class="icon-btn" onclick="quickEstadoTabla(${u.id},'suspendido')" title="Suspender">🚫</button>
            <button class="icon-btn del" onclick="confirmDeleteUser(${u.id},'${esc(u.nombre)}')">🗑️</button>
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

window.quickEstadoTabla = async (id, estado) => {
  await apiPut(`/api/mod/usuarios/${id}`, { mod_id: mod.id, estado });
  loadUsuarios();
};

window.confirmDeleteUser = async (id, nombre) => {
  if (!confirm(`¿Eliminar a "${nombre}"? Esta acción no se puede deshacer.`)) return;
  await apiFetch(`/api/mod/usuarios/${id}`, 'DELETE', { mod_id: mod.id });
  loadUsuarios();
};

/* ════════════════════════════════════════════════
   VIDEOS
════════════════════════════════════════════════ */
async function loadVideos() {
  const list = document.getElementById('videos-mod-list');
  if (!list) return;
  list.innerHTML = '<p class="empty-state-msg">Cargando…</p>';
  const data = await api('/api/mod/videos');
  cache.videos = data.videos || [];
  renderVideosMod(cache.videos);

  document.getElementById('filter-video-btn').onclick = () => {
    const q    = (document.getElementById('search-video').value||'').toLowerCase();
    const dif  = document.getElementById('filter-video-dificultad').value;
    let lista = cache.videos;
    if (q)   lista = lista.filter(v=>v.titulo?.toLowerCase().includes(q));
    if (dif) lista = lista.filter(v=>v.dificultad===dif);
    renderVideosMod(lista);
  };
}

function renderVideosMod(lista) {
  const list = document.getElementById('videos-mod-list');
  if (!list) return;
  if (lista.length===0) { list.innerHTML='<p class="empty-state-msg">Sin videos.</p>'; return; }
  list.innerHTML = lista.map(v=>`
    <div class="media-item">
      <span class="media-item-icon">🎬</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(v.titulo)}</p>
        <p class="media-item-meta">Profesor ID: ${v.profesor_id} · <span class="badge badge-${v.dificultad||'basico'}">${esc(v.dificultad||'—')}</span> · ${esc(v.categoria||'—')} · ${fmtDate(v.creado_en)}</p>
        ${v.hashtags?.length?`<div class="media-item-tags">${v.hashtags.map(t=>`<span class="media-tag">#${esc(t)}</span>`).join('')}</div>`:''}
      </div>
      <div class="media-item-actions">
        <button class="icon-btn del" onclick="deleteVideo(${v.id})">🗑️ Eliminar</button>
      </div>
    </div>`).join('');
}

window.deleteVideo = async id => {
  if (!confirm('¿Eliminar este video?')) return;
  await apiFetch(`/api/mod/videos/${id}`,'DELETE',{mod_id:mod.id});
  loadVideos();
};

/* ════════════════════════════════════════════════
   IMÁGENES
════════════════════════════════════════════════ */
async function loadImagenes() {
  const grid = document.getElementById('imagenes-mod-grid');
  const pill = document.getElementById('imagenes-total-pill');
  if (!grid) return;
  grid.innerHTML = '<p class="empty-state-msg">Cargando…</p>';
  const data = await api('/api/mod/imagenes');
  cache.imagenes = data.imagenes || [];
  if (pill) pill.textContent = cache.imagenes.length;
  if (cache.imagenes.length===0) { grid.innerHTML='<p class="empty-state-msg">Sin imágenes.</p>'; return; }
  grid.innerHTML = cache.imagenes.map(img=>`
    <div class="gallery-img-wrap">
      <img class="gallery-img" src="/uploads/imagenes/${img.profesor_id}/${img.filename}" alt="${esc(img.titulo)}" loading="lazy" onerror="this.parentElement.style.background='#1e1e2e'" />
      <div class="gallery-img-overlay">
        <p class="gallery-img-title">${esc(img.titulo)}</p>
        <p style="font-size:.68rem;color:#aaa;margin:.1rem 0">${esc(img.tipo||'')}</p>
        <button class="gallery-del-btn" onclick="deleteImagen(${img.id})">🗑️ Eliminar</button>
      </div>
    </div>`).join('');
}

window.deleteImagen = async id => {
  if (!confirm('¿Eliminar esta imagen?')) return;
  await apiFetch(`/api/mod/imagenes/${id}`,'DELETE',{mod_id:mod.id});
  loadImagenes();
};

/* ════════════════════════════════════════════════
   INSTRUCCIONALES
════════════════════════════════════════════════ */
async function loadInstruccionales() {
  const list = document.getElementById('inst-mod-list');
  const pill = document.getElementById('inst-total-pill');
  if (!list) return;
  list.innerHTML = '<p class="empty-state-msg">Cargando…</p>';
  const data = await api('/api/mod/instruccionales');
  cache.instruccionales = data.instruccionales || [];
  if (pill) pill.textContent = cache.instruccionales.length;
  if (cache.instruccionales.length===0) { list.innerHTML='<p class="empty-state-msg">Sin instruccionales.</p>'; return; }
  list.innerHTML = cache.instruccionales.map(i=>`
    <div class="media-item">
      <span class="media-item-icon">📚</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(i.titulo)}</p>
        <p class="media-item-meta">Profesor ID: ${i.profesor_id} · ${esc(i.nivel)} · ${esc(i.categoria)} · ${(i.videos_ids||[]).length} videos · ${fmtDate(i.creado_en)}</p>
      </div>
      <div class="media-item-actions">
        <button class="icon-btn del" onclick="deleteInst(${i.id})">🗑️ Eliminar</button>
      </div>
    </div>`).join('');
}

window.deleteInst = async id => {
  if (!confirm('¿Eliminar este instruccional?')) return;
  await apiFetch(`/api/mod/instruccionales/${id}`,'DELETE',{mod_id:mod.id});
  loadInstruccionales();
};

/* ════════════════════════════════════════════════
   DIAGRAMAS
════════════════════════════════════════════════ */
async function loadDiagramas() {
  const list = document.getElementById('diag-mod-list');
  const pill = document.getElementById('diag-total-pill');
  if (!list) return;
  list.innerHTML = '<p class="empty-state-msg">Cargando…</p>';
  const data = await api('/api/mod/diagramas');
  cache.diagramas = data.diagramas || [];
  if (pill) pill.textContent = cache.diagramas.length;
  if (cache.diagramas.length===0) { list.innerHTML='<p class="empty-state-msg">Sin diagramas.</p>'; return; }
  list.innerHTML = cache.diagramas.map(d=>`
    <div class="media-item">
      <span class="media-item-icon">🗺️</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(d.titulo)}</p>
        <p class="media-item-meta">Profesor ID: ${d.profesor_id} · ${esc(d.tipo)} · ${fmtDate(d.creado_en)}</p>
        <p class="media-item-meta" style="font-size:.72rem;white-space:pre-line;margin-top:2px">${esc((d.nodos||'').split('\n').slice(0,3).join('\n'))}${(d.nodos||'').split('\n').length>3?'\n…':''}</p>
      </div>
      <div class="media-item-actions">
        <button class="icon-btn del" onclick="deleteDiag(${d.id})">🗑️ Eliminar</button>
      </div>
    </div>`).join('');
}

window.deleteDiag = async id => {
  if (!confirm('¿Eliminar este diagrama?')) return;
  await apiFetch(`/api/mod/diagramas/${id}`,'DELETE',{mod_id:mod.id});
  loadDiagramas();
};

/* ════════════════════════════════════════════════
   FORO
════════════════════════════════════════════════ */
async function loadForo() {
  const list = document.getElementById('foro-mod-list');
  if (!list) return;
  list.innerHTML = '<p class="empty-state-msg">Cargando…</p>';
  const data = await api('/api/forum/posts');
  cache.posts = data.posts || [];
  renderForo(cache.posts);

  document.getElementById('filter-post-btn').onclick = () => {
    const q = (document.getElementById('search-post').value||'').toLowerCase();
    renderForo(q ? cache.posts.filter(p=>(p.mensaje||'').toLowerCase().includes(q)||(p.autor||'').toLowerCase().includes(q)) : cache.posts);
  };
}

function renderForo(lista) {
  const list = document.getElementById('foro-mod-list');
  if (!list) return;
  if (lista.length===0) { list.innerHTML='<p class="empty-state-msg">Sin publicaciones.</p>'; return; }
  list.innerHTML = lista.map(p=>`
    <div class="media-item">
      <span class="media-item-icon">💬</span>
      <div class="media-item-body">
        <p class="media-item-title">${esc(p.autor||'Usuario')} <span style="font-weight:400;font-size:.75rem;color:#888">· ${fmtDate(p.creado_en)}</span></p>
        <p class="media-item-meta">${esc((p.mensaje||'').slice(0,140))}${(p.mensaje||'').length>140?'…':''}</p>
        ${p.image_url ? `<img class="forum-post-image" src="${esc(p.image_url)}" alt="Imagen adjunta" loading="lazy" style="margin-top:8px;max-width:100%;border-radius:8px" />` : ''}
        ${p.hashtags?.length?`<div class="media-item-tags">${p.hashtags.map(t=>`<span class="media-tag">#${esc(t)}</span>`).join('')}</div>`:''}
        <p class="media-item-meta" style="margin-top:4px">❤️ ${p.likes||0} · 💬 ${p.replies||0}</p>
      </div>
      <div class="media-item-actions">
        <button class="icon-btn del" onclick="deletePost(${p.id})">🗑️ Eliminar</button>
      </div>
    </div>`).join('');
}

window.deletePost = async id => {
  if (!confirm('¿Eliminar esta publicación del foro?')) return;
  await apiFetch(`/api/mod/foro/${id}`,'DELETE',{mod_id:mod.id});
  loadForo();
};

/* ════════════════════════════════════════════════
   REPORTES — generación y descarga
════════════════════════════════════════════════ */
window.exportReport = async function(tipo, formato) {
  const previewTitle = document.getElementById('report-preview-title');
  const previewWrap  = document.getElementById('report-preview-wrap');
  const dlBtn        = document.getElementById('report-download-btn');

  previewWrap.innerHTML = '<p class="empty-state-msg">Generando reporte…</p>';
  if (previewTitle) previewTitle.textContent = `${tipo} · ${formato.toUpperCase()}`;
  if (dlBtn) dlBtn.style.display = 'none';

  // Asegurar datos frescos
  const [uRes, vRes, iRes, instRes, pRes, dRes] = await Promise.all([
    api('/api/mod/usuarios'), api('/api/mod/videos'), api('/api/mod/imagenes'),
    api('/api/mod/instruccionales'), api('/api/forum/posts'), api('/api/mod/diagramas'),
  ]);
  const usuarios       = uRes.usuarios         || [];
  const videos         = vRes.videos           || [];
  const imagenes       = iRes.imagenes         || [];
  const instruccionales= instRes.instruccionales|| [];
  const posts          = pRes.posts            || [];
  const diagramas      = dRes.diagramas        || [];

  // Filtros para usuarios
  const filtroRol    = tipo==='usuarios' ? (document.getElementById('rep-usuarios-rol')?.value    || '') : '';
  const filtroEstado = tipo==='usuarios' ? (document.getElementById('rep-usuarios-estado')?.value || '') : '';

  let data, filename, previewHTML;

  if (tipo === 'usuarios') {
    let lista = usuarios;
    if (filtroRol)    lista = lista.filter(u=>u.rol===filtroRol);
    if (filtroEstado) lista = lista.filter(u=>u.estado===filtroEstado);
    data = lista.map(u=>({ id:u.id, nombre:u.nombre, email:u.email, rol:u.rol,
                            estado:u.estado||'—', rango:u.rango||'—',
                            metodo_pago:u.metodo_pago||'—', creado_en:u.creado_en||'—' }));
    filename = `reporte_usuarios_${dateTag()}`;
    previewHTML = renderTablePreview(['ID','Nombre','Email','Rol','Estado','Rango','Método pago','Registro'],
      data.map(r=>[r.id,r.nombre,r.email,r.rol,r.estado,r.rango,r.metodo_pago,r.creado_en]));
  }
  else if (tipo === 'contenido') {
    const vRows = videos.map(v=>({ tipo:'video', id:v.id, profesor_id:v.profesor_id,
                                   titulo:v.titulo, detalle1:v.categoria||'—', detalle2:v.dificultad||'—',
                                   hashtags:(v.hashtags||[]).join(' '), creado_en:v.creado_en||'—' }));
    const iRows = imagenes.map(i=>({ tipo:'imagen', id:i.id, profesor_id:i.profesor_id,
                                     titulo:i.titulo, detalle1:i.tipo||'—', detalle2:'—',
                                     hashtags:(i.hashtags||[]).join(' '), creado_en:i.creado_en||'—' }));
    const instRows = instruccionales.map(i=>({ tipo:'instruccional', id:i.id, profesor_id:i.profesor_id,
                                               titulo:i.titulo, detalle1:i.nivel||'—', detalle2:i.categoria||'—',
                                               hashtags:'—', creado_en:i.creado_en||'—' }));
    data = [...vRows,...iRows,...instRows];
    filename = `reporte_contenido_${dateTag()}`;
    previewHTML = renderTablePreview(['Tipo','ID','Profesor ID','Título','Detalle 1','Detalle 2','Hashtags','Creado'],
      data.map(r=>[r.tipo,r.id,r.profesor_id,r.titulo,r.detalle1,r.detalle2,r.hashtags,r.creado_en]));
  }
  else if (tipo === 'foro') {
    data = posts.map(p=>({ id:p.id, autor:p.autor||'—', mensaje:(p.mensaje||'').replace(/\n/g,' '),
                           hashtags:(p.hashtags||[]).join(' '), likes:p.likes||0,
                           respuestas:p.replies||0, creado_en:p.creado_en||'—' }));
    filename = `reporte_foro_${dateTag()}`;
    previewHTML = renderTablePreview(['ID','Autor','Mensaje (truncado)','Hashtags','Likes','Respuestas','Fecha'],
      data.map(r=>[r.id,r.autor,(r.mensaje||'').slice(0,60)+'…',r.hashtags,r.likes,r.respuestas,r.creado_en]));
  }
  else { // general
    data = {
      generado_en: new Date().toISOString(),
      resumen: {
        total_usuarios: usuarios.length,
        alumnos:        usuarios.filter(u=>u.rol==='alumno').length,
        profesores:     usuarios.filter(u=>u.rol==='profesor').length,
        moderadores:    usuarios.filter(u=>u.rol==='moderador').length,
        usuarios_activos:    usuarios.filter(u=>u.estado==='activo').length,
        usuarios_pendientes: usuarios.filter(u=>u.estado==='pendiente').length,
        usuarios_suspendidos:usuarios.filter(u=>u.estado==='suspendido').length,
        total_videos:         videos.length,
        total_imagenes:       imagenes.length,
        total_instruccionales:instruccionales.length,
        total_diagramas:      diagramas.length,
        total_posts_foro:     posts.length,
        total_likes_foro:     posts.reduce((a,p)=>a+(p.likes||0),0),
      }
    };
    filename = `reporte_general_${dateTag()}`;
    const r = data.resumen;
    previewHTML = renderTablePreview(['Métrica','Valor'],[
      ['Total usuarios',r.total_usuarios],['Alumnos',r.alumnos],['Profesores',r.profesores],
      ['Moderadores',r.moderadores],['Activos',r.usuarios_activos],['Pendientes',r.usuarios_pendientes],
      ['Suspendidos',r.usuarios_suspendidos],['Videos',r.total_videos],['Imágenes',r.total_imagenes],
      ['Instruccionales',r.total_instruccionales],['Diagramas',r.total_diagramas],
      ['Posts foro',r.total_posts_foro],['Likes foro',r.total_likes_foro],
    ]);
  }

  // Generar blob
  if (formato === 'csv') {
    const csvStr = tipo==='general'
      ? objToCSV(data.resumen)
      : arrayToCSV(data);
    reportBlob = new Blob([csvStr], { type:'text/csv;charset=utf-8;' });
    reportFilename = filename + '.csv';
  } else {
    reportBlob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
    reportFilename = filename + '.json';
  }

  previewWrap.innerHTML = previewHTML;
  if (dlBtn) {
    dlBtn.style.display = '';
    dlBtn.textContent = `⬇️ Descargar ${reportFilename}`;
    dlBtn.onclick = downloadReport;
  }
};

function downloadReport() {
  if (!reportBlob) return;
  const url = URL.createObjectURL(reportBlob);
  const a   = document.createElement('a');
  a.href = url; a.download = reportFilename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function arrayToCSV(arr) {
  if (!arr.length) return '';
  const headers = Object.keys(arr[0]);
  const rows    = arr.map(o=>headers.map(h=>JSON.stringify(o[h]??'')).join(','));
  return [headers.join(','), ...rows].join('\r\n');
}
function objToCSV(obj) {
  return ['Métrica,Valor',...Object.entries(obj).map(([k,v])=>`${k},${v}`)].join('\r\n');
}
function dateTag() { return new Date().toISOString().slice(0,10); }
function renderTablePreview(headers, rows) {
  return `<table class="mod-table">
    <thead><tr>${headers.map(h=>`<th>${esc(String(h))}</th>`).join('')}</tr></thead>
    <tbody>${rows.slice(0,50).map(row=>`<tr>${row.map(c=>`<td>${esc(String(c??''))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>${rows.length>50?`<p style="font-size:.78rem;color:#888;padding:.5rem">Mostrando 50 de ${rows.length} filas. Descarga el archivo para ver todos.</p>`:''}`;
}

/* ════════════════════════════════════════════════
   MODAL EDITAR USUARIO
════════════════════════════════════════════════ */
function initModals() {
  // Modal editar
  document.getElementById('modal-close').onclick  = () => document.getElementById('edit-modal').classList.add('hidden');
  document.getElementById('modal-cancel').onclick = () => document.getElementById('edit-modal').classList.add('hidden');
  document.getElementById('edit-modal').onclick = e => { if(e.target.id==='edit-modal') document.getElementById('edit-modal').classList.add('hidden'); };
  document.getElementById('modal-save').onclick = saveEditUser;

  // Modal nuevo usuario
  document.getElementById('new-modal-close').onclick  = () => document.getElementById('new-user-modal').classList.add('hidden');
  document.getElementById('new-modal-cancel').onclick = () => document.getElementById('new-user-modal').classList.add('hidden');
  document.getElementById('new-user-modal').onclick = e => { if(e.target.id==='new-user-modal') document.getElementById('new-user-modal').classList.add('hidden'); };
  document.getElementById('new-modal-save').onclick = createUser;
}

window.openEditModal = id => {
  const u = cache.usuarios.find(x=>x.id===id);
  if (!u) return;
  document.getElementById('edit-user-id').value = u.id;
  document.getElementById('edit-nombre').value  = u.nombre  || '';
  document.getElementById('edit-email').value   = u.email   || '';
  document.getElementById('edit-password').value= '';
  document.getElementById('edit-rol').value     = u.rol     || 'alumno';
  document.getElementById('edit-estado').value  = u.estado  || 'pendiente';
  document.getElementById('edit-rango').value   = u.rango   || '';
  document.getElementById('edit-feedback').classList.add('hidden');
  document.getElementById('edit-modal').classList.remove('hidden');
};

async function saveEditUser() {
  const id  = parseInt(document.getElementById('edit-user-id').value);
  const fb  = document.getElementById('edit-feedback');
  const payload = {
    mod_id:   mod.id,
    nombre:   document.getElementById('edit-nombre').value.trim(),
    email:    document.getElementById('edit-email').value.trim(),
    password: document.getElementById('edit-password').value || null,
    rol:      document.getElementById('edit-rol').value,
    estado:   document.getElementById('edit-estado').value,
    rango:    document.getElementById('edit-rango').value || null,
  };
  const data = await apiPut(`/api/mod/usuarios/${id}`, payload);
  if (data?.success) {
    showFeedback(fb,'success','✅ Usuario actualizado.');
    setTimeout(()=>{ document.getElementById('edit-modal').classList.add('hidden'); loadUsuarios(); },1000);
  } else {
    showFeedback(fb,'error', data?.message||'Error al guardar.');
  }
}

async function createUser() {
  const fb = document.getElementById('new-user-feedback');
  const nombre   = document.getElementById('new-nombre').value.trim();
  const email    = document.getElementById('new-email').value.trim();
  const password = document.getElementById('new-password').value;
  if (!nombre||!email||!password) { showFeedback(fb,'error','Nombre, email y contraseña son obligatorios.'); return; }

  const data = await apiFetch('/api/register','POST',{
    nombre, email, password,
    rol:         document.getElementById('new-rol').value,
    estado:      document.getElementById('new-estado').value,
    rango:       document.getElementById('new-rango').value||null,
    metodo_pago: 'manual',
  });
  if (data?.success||data?.user) {
    showFeedback(fb,'success','✅ Usuario creado correctamente.');
    setTimeout(()=>{ document.getElementById('new-user-modal').classList.add('hidden'); loadUsuarios(); },1000);
  } else {
    showFeedback(fb,'error',data?.message||'Error al crear usuario.');
  }
}

/* ════════════════════════════════════════════════
   PERFIL PROPIO
════════════════════════════════════════════════ */
function loadPerfil() {
  const u = JSON.parse(localStorage.getItem('lutaedanca_user')||localStorage.getItem('currentUser'))||mod;
  document.getElementById('perfil-nombre').value = u.nombre||'';
  document.getElementById('perfil-email').value  = u.email ||'';
  document.getElementById('perfil-password-actual').value='';
  document.getElementById('perfil-password-nueva').value='';
  setEl('perfil-info-nombre', u.nombre||'—');
  setEl('perfil-info-email',  u.email ||'—');
  setEl('perfil-info-estado', u.estado||'—');
  setEl('perfil-info-desde',  fmtDate(u.creado_en));
}

function initPerfil() {
  document.getElementById('perfil-save-btn').onclick = async () => {
    const fb = document.getElementById('perfil-feedback');
    const nombre          = document.getElementById('perfil-nombre').value.trim();
    const email           = document.getElementById('perfil-email').value.trim();
    const passwordActual  = document.getElementById('perfil-password-actual').value;
    const passwordNueva   = document.getElementById('perfil-password-nueva').value;
    if (!nombre||!email||!passwordActual) { showFeedback(fb,'error','Nombre, email y contraseña actual son obligatorios.'); return; }
    const data = await apiFetch('/api/mod/perfil','PUT',{
      user_id: mod.id, nombre, email,
      password_actual: passwordActual, password_nueva: passwordNueva||null,
    });
    if (data?.success) {
      const updated = {...mod, nombre:data.user.nombre, email:data.user.email};
      localStorage.setItem('lutaedanca_user', JSON.stringify(updated));
      localStorage.setItem('currentUser',     JSON.stringify(updated));
      setEl('mod-name', updated.nombre);
      setEl('mod-meta', `@${updated.email.split('@')[0]}`);
      showFeedback(fb,'success','✅ Perfil actualizado.');
      loadPerfil();
    } else {
      showFeedback(fb,'error',data?.message||'Error al guardar.');
    }
  };
}

/* ════════════════════════════════════════════════
   LOGOUT
════════════════════════════════════════════════ */
function initLogout() {
  document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('lutaedanca_user');
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  };
}

/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */
async function api(url) {
  try { const r = await fetch(url); return await r.json(); }
  catch(e) { console.error(e); return {}; }
}
async function apiFetch(url, method='GET', body=null) {
  try {
    const r = await fetch(url,{ method, headers:{'Content-Type':'application/json'},
                                body: body ? JSON.stringify(body) : undefined });
    return await r.json();
  } catch(e) { console.error(e); return {}; }
}
async function apiPut(url, body) { return apiFetch(url,'PUT',body); }

function setEl(id,text) { const el=document.getElementById(id); if(el) el.textContent=text; }

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-BO',{year:'numeric',month:'short',day:'numeric'});
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showFeedback(el, type, msg) {
  if (!el) return;
  el.textContent = msg;
  el.className = `feedback-msg ${type}`;
  el.classList.remove('hidden');
  if (type==='success') setTimeout(()=>el.classList.add('hidden'), 3500);
}

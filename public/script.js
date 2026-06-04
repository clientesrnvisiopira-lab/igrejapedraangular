
async function verificarAcessoCursos(){
  if(!window.location.pathname.includes("cursos.html")) return true;

  const usuarioLocal = localStorage.getItem("usuarioLogado");
  if(usuarioLocal) return true;

  try{
    const res = await fetch('/api/me?ts=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    if(data && data.logged){
      localStorage.setItem("usuarioLogado", data.user?.role || "logado");
      return true;
    }
  }catch(e){
    // Se o site estiver sem backend, mantém a proteção pelo localStorage.
  }

  window.location.href = "login.html";
  return false;
}

document.addEventListener('click', (e)=>{
  const link = e.target.closest('a[href="/logout"], a[href="logout"]');
  if(link){
    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("usuarioNome");
    localStorage.removeItem("usuarioEmail");
  }
});

function toggleMenu(){
  const menu=document.getElementById('menu');
  if(menu) menu.classList.toggle('open');
}

let gallery=[];
let currentIndex=0;
let lastSignature='';

function mediaUrl(file){
  if(!file) return '';
  if(String(file).startsWith('http://') || String(file).startsWith('https://')) return file;
  return `/midia/${file}`;
}
function escapeHtml(text=''){
  return String(text).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function escapeAttr(text=''){
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function speedControl(){
  return `<select class="speed-control" onchange="changePlaybackSpeed(this)">
    <option value="0.5">0.5x</option>
    <option value="1" selected>1x</option>
    <option value="1.25">1.25x</option>
    <option value="1.5">1.5x</option>
    <option value="2">2x</option>
  </select>`;
}

function changePlaybackSpeed(select){
  const media = select.parentElement.querySelector('audio, video');
  if(media) media.playbackRate = Number(select.value);
}

function renderMedia(post, index){
  const title=escapeHtml(post.title || 'Publicação');
  if(post.type === 'video') return `<div class="media-player">${speedControl()}<video controls preload="metadata" data-index="${index}" src="${mediaUrl(post.file)}"></video></div>`;
  if(post.type === 'audio') return `<div class="audio-card media-player" data-index="${index}"><strong>🎧 ${title}</strong>${speedControl()}<audio controls preload="metadata" src="${mediaUrl(post.file)}"></audio></div>`;
  return `<img data-index="${index}" src="${mediaUrl(post.file)}" alt="${title}">`;
}

async function buscarPosts(){
  const res=await fetch('/api/posts?ts=' + Date.now(), { cache:'no-store' });
  return await res.json();
}

function getFeedType(feed){
  return feed.dataset.feed || 'all';
}
function filtrarPosts(posts, feedType){
  if(feedType === 'media') return posts.filter(p => p.category === 'media' || p.author === 'Mídia');
  if(feedType === 'admin') return posts.filter(p => p.category === 'admin' || p.author === 'Pr. Daniel');
  if(feedType === 'secretaria') return posts.filter(p => p.category === 'secretaria' || p.author === 'Secretaria');
  return posts;
}

async function carregarPosts(){
  const feed=document.getElementById('feed');
  if(!feed) return;
  try{
    const allPosts=await buscarPosts();
    const feedType=getFeedType(feed);
    const posts=filtrarPosts(allPosts, feedType);
    const signature=JSON.stringify(posts.map(p=>[p.id,p.file,p.title,p.description,p.category]));
    if(signature === lastSignature) return;
    lastSignature=signature;
    gallery=posts.filter(p=>p.type==='foto'||p.type==='video'||p.type==='audio');
    if(!posts.length){
      let msg = 'Quando o Pr. Daniel publicar algo pelo login admin@igreja.com, aparecerá aqui automaticamente.';
      if(feedType === 'media') msg = 'Quando o login midia@igreja.com publicar uma imagem, vídeo e legenda, aparecerá aqui automaticamente.';
      if(feedType === 'secretaria') msg = 'Quando o login secretaria@igreja.com publicar uma imagem, vídeo e legenda, aparecerá aqui automaticamente.';
      feed.innerHTML=`<div class="panel center"><h2>Nenhuma publicação ainda</h2><p>${msg}</p></div>`;
      return;
    }
    feed.innerHTML=posts.map((post,index)=>`<article class="card">${renderMedia(post,index)}<div class="content"><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description||'')}</p><small>${escapeHtml(post.author || 'Pr. Daniel')}</small></div></article>`).join('');
    feed.querySelectorAll('img, video, .audio-card').forEach(el=>el.addEventListener('click',()=>openLightbox(Number(el.dataset.index))));
  }catch(e){
    feed.innerHTML='<div class="panel center"><h2>Não foi possível carregar as publicações.</h2><p>Verifique se o servidor está iniciado.</p></div>';
  }
}

function openLightbox(index){
  currentIndex=index;
  const lb=document.getElementById('lightbox');
  if(!lb) return;
  updateLightbox();
  lb.classList.add('open');
}
function updateLightbox(){
  const box=document.getElementById('lightboxContent');
  if(!box || !gallery[currentIndex]) return;
  const p=gallery[currentIndex];
  if(p.type === 'video') box.innerHTML = `<div class="media-player">${speedControl()}<video controls autoplay src="${mediaUrl(p.file)}"></video></div>`;
  else if(p.type === 'audio') box.innerHTML = `<div class="audio-lightbox media-player"><h3>${escapeHtml(p.title||'Áudio')}</h3>${speedControl()}<audio controls autoplay src="${mediaUrl(p.file)}"></audio></div>`;
  else box.innerHTML = `<img src="${mediaUrl(p.file)}" alt="${escapeHtml(p.title||'Publicação')}">`;
}
function closeLightbox(){
  const lb=document.getElementById('lightbox');
  const box=document.getElementById('lightboxContent');
  if(lb) lb.classList.remove('open');
  if(box) box.innerHTML='';
}
function nextMedia(){ if(!gallery.length) return; currentIndex=(currentIndex+1)%gallery.length; updateLightbox(); }
function prevMedia(){ if(!gallery.length) return; currentIndex=(currentIndex-1+gallery.length)%gallery.length; updateLightbox(); }

document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeLightbox();
  if(e.key==='ArrowRight') nextMedia();
  if(e.key==='ArrowLeft') prevMedia();
});

async function carregarPostsAdmin(){
  const area=document.getElementById('admin-posts');
  if(!area) return;
  try{
    const posts=await buscarPosts();
    if(!posts.length){ area.innerHTML='<div class="panel center"><p>Nenhuma publicação cadastrada.</p></div>'; return; }
    area.innerHTML=posts.map((post,index)=>`<article class="card">${renderMedia(post,index)}<div class="content"><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description||'')}</p><small>${escapeHtml(post.author || 'Pr. Daniel')} • ${post.category === 'media' ? 'Página Mídia' : post.category === 'secretaria' ? 'Página Publicações' : 'Página Estudos Pr. Daniel'}</small><form action="/delete-post/${post.id}" method="POST" onsubmit="return confirm('Tem certeza que deseja excluir esta publicação?')"><button type="submit" class="danger">Excluir publicação</button></form></div></article>`).join('');
  }catch(e){
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar as publicações.</p></div>';
  }
}

async function carregarPostsMidia(){
  const area=document.getElementById('media-posts');
  if(!area) return;
  try{
    const posts=(await buscarPosts()).filter(p => p.category === 'media' || p.author === 'Mídia');
    if(!posts.length){ area.innerHTML='<div class="panel center"><p>Nenhuma publicação da mídia cadastrada.</p></div>'; return; }
    area.innerHTML=posts.map((post,index)=>`
      <article class="card">
        ${renderMedia(post,index)}
        <div class="content">
          <small>Página Mídia</small>
          <form action="/edit-post/${post.id}" method="POST" class="edit-post-form">
            <label>Título ou legenda</label>
            <input type="text" name="title" value="${escapeHtml(post.title || '')}" required>
            <label>Descrição</label>
            <textarea name="description">${escapeHtml(post.description || '')}</textarea>
            <button type="submit">Salvar alterações</button>
          </form>
          <form action="/delete-post/${post.id}" method="POST" onsubmit="return confirm('Tem certeza que deseja excluir esta publicação da mídia?')">
            <button type="submit" class="danger">Excluir publicação</button>
          </form>
        </div>
      </article>`).join('');
  }catch(e){
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar as publicações da mídia.</p></div>';
  }
}

async function carregarPostsSecretaria(){
  const area=document.getElementById('secretaria-posts');
  if(!area) return;
  try{
    const posts=(await buscarPosts()).filter(p => p.category === 'secretaria' || p.author === 'Secretaria');
    if(!posts.length){ area.innerHTML='<div class="panel center"><p>Nenhuma publicação da secretaria cadastrada.</p></div>'; return; }
    area.innerHTML=posts.map((post,index)=>`
      <article class="card">
        ${renderMedia(post,index)}
        <div class="content">
          <small>Página Publicações</small>
          <form action="/edit-post/${post.id}" method="POST" class="edit-post-form">
            <label>Título ou legenda</label>
            <input type="text" name="title" value="${escapeHtml(post.title || '')}" required>
            <label>Descrição</label>
            <textarea name="description">${escapeHtml(post.description || '')}</textarea>
            <button type="submit">Salvar alterações</button>
          </form>
          <form action="/delete-post/${post.id}" method="POST" onsubmit="return confirm('Tem certeza que deseja excluir esta publicação da secretaria?')">
            <button type="submit" class="danger">Excluir publicação</button>
          </form>
        </div>
      </article>`).join('');
  }catch(e){
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar as publicações da secretaria.</p></div>';
  }
}

function formatPhone(value){
  const nums=String(value).replace(/\D/g,'').slice(0,11);
  if(nums.length <= 2) return nums;
  if(nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
}
const celularInput=document.getElementById('celular');
if(celularInput){
  celularInput.addEventListener('input', e => { e.target.value = formatPhone(e.target.value); });
}
const whatsappForm=document.getElementById('whatsappForm');
if(whatsappForm){
  whatsappForm.addEventListener('submit', e => {
    e.preventDefault();
    const nome=document.getElementById('nome').value.trim();
    const sobrenome=document.getElementById('sobrenome').value.trim();
    const membro=document.getElementById('membro').value;
    const celular=document.getElementById('celular').value.trim();
    const assunto=document.getElementById('assunto').value;
    const mensagem=document.getElementById('mensagem').value.trim();
    const texto=`Olá, Igreja Pedra Angular!%0A%0A*Nome:* ${encodeURIComponent(nome)} ${encodeURIComponent(sobrenome)}%0A*Situação:* ${encodeURIComponent(membro)}%0A*Celular:* ${encodeURIComponent(celular)}%0A*Assunto:* ${encodeURIComponent(assunto)}%0A*Mensagem:* ${encodeURIComponent(mensagem)}`;
    window.open(`https://wa.me/5519993028571?text=${texto}`, '_blank');
  });
}


function youtubeEmbed(url){
  const value=String(url||'').trim();
  if(!value) return '';
  let id='';
  const watch=value.match(/[?&]v=([^&]+)/);
  const short=value.match(/youtu\.be\/([^?&]+)/);
  const embed=value.match(/youtube\.com\/embed\/([^?&/]+)/);
  if(watch) id=watch[1];
  else if(short) id=short[1];
  else if(embed) id=embed[1];
  return id ? `https://www.youtube.com/embed/${id}` : '';
}


function dbReady(){
  return typeof supabaseClient !== 'undefined' && supabaseClient;
}
function dbErrorMsg(){
  return '<div class="panel center"><h2>Supabase não configurado</h2><p>Abra o arquivo <strong>supabase-config.js</strong> e cole a sua chave <strong>Publishable key</strong>.</p></div>';
}

async function buscarCursosComAulas(){
  // Primeiro usa a API do próprio servidor. Assim funciona para admin/membro logado
  // mesmo quando o Supabase tem RLS/permissões diferentes para a chave pública.
  try{
    const res = await fetch('/api/courses', { credentials:'same-origin', cache:'no-store' });
    if(res.ok){
      const apiCourses = await res.json();
      if(Array.isArray(apiCourses)){
        return apiCourses.map(c => ({
          id: c.id,
          title: c.title,
          description: c.description || '',
          createdAt: c.createdAt || c.created_at,
          lessons: (c.lessons || []).map(a => ({
            id: a.id,
            courseId: a.courseId || a.course_id || c.id,
            title: a.title,
            description: a.description || '',
            videoUrl: a.videoUrl || a.video_url || '',
            materialUrl: a.materialUrl || a.material_url || '',
            createdAt: a.createdAt || a.created_at
          }))
        }));
      }
    }
  }catch(e){ console.warn('API /api/courses indisponível, tentando Supabase direto.', e); }

  if(!dbReady()) throw new Error('Supabase não configurado');
  const { data: courses, error: cErr } = await supabaseClient
    .from('courses')
    .select('*')
    .order('created_at', { ascending:false });
  if(cErr) throw cErr;

  const { data: lessons, error: lErr } = await supabaseClient
    .from('lessons')
    .select('*')
    .order('created_at', { ascending:true });
  if(lErr) throw lErr;

  return (courses || []).map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    createdAt: c.created_at,
    lessons: (lessons || [])
      .filter(a => String(a.course_id) === String(c.id))
      .map(a => ({
        id: a.id,
        courseId: a.course_id,
        title: a.title,
        description: a.description || '',
        videoUrl: a.video_url || '',
        materialUrl: a.material_url || '',
        createdAt: a.created_at
      }))
  }));
}

async function buscarPresencas(){
  // Usa a API protegida do servidor para evitar erro de coluna student_phone/phone
  // e para garantir que o painel admin enxergue o que foi salvo no banco.
  try{
    const res = await fetch('/api/attendance', { credentials:'same-origin', cache:'no-store' });
    if(res.ok){
      const records = await res.json();
      if(Array.isArray(records)) return records.map(r => ({
        id: r.id,
        studentName: r.studentName || r.student_name || '',
        studentPhone: onlyDigits(r.studentPhone || r.student_phone || r.phone || ''),
        certificateCode: r.certificateCode || r.certificate_code || '',
        createdAt: r.createdAt || r.created_at,
        courseId: r.courseId || r.course_id,
        lessonId: r.lessonId || r.lesson_id,
        courseTitle: r.courseTitle || r.course_title || 'Curso sem nome',
        lessonTitle: r.lessonTitle || r.lesson_title || 'Aula sem nome'
      }));
    }
  }catch(e){ console.warn('API /api/attendance indisponível, tentando Supabase direto.', e); }

  if(!dbReady()) throw new Error('Supabase não configurado');
  const { data, error } = await supabaseClient
    .from('attendance')
    .select('*')
    .order('created_at', { ascending:false });
  if(error) throw error;

  const courses = await buscarCursosComAulas().catch(()=>[]);
  const courseMap = new Map(courses.map(c => [String(c.id), c]));
  const lessonMap = new Map();
  courses.forEach(c => (c.lessons || []).forEach(a => lessonMap.set(String(a.id), a)));

  return (data || []).map(r => ({
    id: r.id,
    studentName: r.student_name,
    studentPhone: telefoneDaPresenca(r),
    certificateCode: r.certificate_code || '',
    createdAt: r.created_at,
    courseId: r.course_id,
    lessonId: r.lesson_id,
    courseTitle: courseMap.get(String(r.course_id))?.title || r.course_title || 'Curso sem nome',
    lessonTitle: lessonMap.get(String(r.lesson_id))?.title || r.lesson_title || 'Aula sem nome'
  }));
}

async function carregarCursos(){
  const area=document.getElementById('courses');
  if(!area) return;
  const acessoOk = await verificarAcessoCursos();
  if(!acessoOk) return;
  if(!dbReady()){ area.innerHTML=dbErrorMsg(); return; }
  try{
    const courses=await buscarCursosComAulas();
    if(!courses.length){
      area.innerHTML='<div class="panel center"><h2>Nenhum curso cadastrado ainda</h2><p>Quando o pastor publicar um curso pelo Painel Administrativo, ele aparecerá aqui para os membros logados.</p></div>';
      return;
    }
    const msg=document.getElementById('attendance-message');
    if(msg && new URLSearchParams(location.search).get('presenca') === 'ok'){
      msg.innerHTML='<div class="panel center presence-ok"><strong>Presença registrada com sucesso!</strong></div>';
      history.replaceState(null, '', location.pathname);
    }
    area.innerHTML=courses.map((c, courseIndex)=>{
      const lessons=Array.isArray(c.lessons) ? c.lessons : [];
      const lessonsHtml = lessons.length ? lessons.map((a, lessonIndex)=>{
        const embed=youtubeEmbed(a.videoUrl);
        const video=embed ? `<div class="course-video"><iframe src="${embed}" title="${escapeHtml(a.title)}" allowfullscreen></iframe></div>` : '';
        const videoBtn=a.videoUrl ? `<a class="btn" href="${escapeHtml(a.videoUrl)}" target="_blank" rel="noopener">Abrir vídeo</a>` : '';
        const materialBtn=a.materialUrl ? `<a class="btn secondary" href="${escapeHtml(a.materialUrl)}" target="_blank" rel="noopener">Material/PDF</a>` : '';
        return `<div class="lesson-card collapsed">
          <button type="button" class="lesson-toggle" onclick="toggleLesson(this)"><span>Aula ${lessonIndex+1}</span><strong>${escapeHtml(a.title)}</strong><em>+</em></button>
          <div class="lesson-content">
            ${video}
            <p>${escapeHtml(a.description||'')}</p>
            <div class="course-actions">${videoBtn}${materialBtn}</div>
            <form class="attendance-form" data-course-id="${c.id}" data-lesson-id="${a.id}">
              <label>Registrar presença nesta aula</label>
              <div class="attendance-row attendance-row-vertical">
                <input type="text" name="studentName" placeholder="Digite seu nome completo" required>
                <input type="tel" name="studentPhone" class="phone-mask" placeholder="Telefone: (19) 99991-3539" required>
                <button type="submit">Confirmar presença</button>
              </div>
            </form>
          </div>
        </div>`;
      }).join('') : '<p class="helper">Este curso ainda não possui aulas cadastradas.</p>';
      const certHtml = lessons.length ? `<div class="certificate-request"><h3>Solicitar certificado</h3><p>Após registrar presença em todas as aulas, digite o mesmo telefone usado nas presenças para liberar o certificado.</p><div class="attendance-row"><input id="cert-phone-${c.id}" class="phone-mask" type="tel" placeholder="Telefone: (19) 99991-3539"><button type="button" onclick="solicitarCertificado('${c.id}')">Gerar certificado</button></div><div id="cert-msg-${c.id}" class="certificate-message"></div></div>` : '';
      return `<article class="course-box collapsed"><button type="button" class="course-toggle" onclick="toggleCourse(this)"><div><small>Curso ${courseIndex+1}</small><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description||'')}</p></div><span>Ver aulas</span></button><div class="lessons-list">${lessonsHtml}${certHtml}</div></article>`;
    }).join('');
    configurarFormsPresenca();
    aplicarMascaraTelefones();
  }catch(e){
    console.error(e);
    area.innerHTML='<div class="panel center"><h2>Não foi possível carregar os cursos.</h2><p>Verifique a chave do Supabase e as permissões das tabelas.</p></div>';
  }
}

function toggleCourse(btn){
  const box=btn.closest('.course-box');
  if(!box) return;
  box.classList.toggle('collapsed');
  const label=btn.querySelector('span:last-child');
  if(label) label.textContent = box.classList.contains('collapsed') ? 'Ver aulas' : 'Ocultar aulas';
}

function toggleLesson(btn){
  const card=btn.closest('.lesson-card');
  if(!card) return;
  card.classList.toggle('collapsed');
  const icon=btn.querySelector('em');
  if(icon) icon.textContent = card.classList.contains('collapsed') ? '+' : '−';
}


function onlyDigits(value){ return String(value || '').replace(/\D/g,''); }
function normalizarNome(value){ return String(value || '').trim().replace(/\s+/g,' '); }
function aplicarMascaraTelefones(){
  document.querySelectorAll('.phone-mask, input[name="studentPhone"], #certificate-phone').forEach(input=>{
    if(input.dataset.phoneReady) return;
    input.dataset.phoneReady='1';
    input.addEventListener('input', e => { e.target.value = formatPhone(e.target.value); });
  });
}
function certificateCode(courseId, phone){
  const base = `${courseId}-${onlyDigits(phone)}`;
  let hash = 0;
  for(let i=0;i<base.length;i++){ hash = ((hash << 5) - hash) + base.charCodeAt(i); hash |= 0; }
  return 'IPA-' + new Date().getFullYear() + '-' + Math.abs(hash).toString().padStart(6,'0').slice(0,6);
}
function telefoneDaPresenca(row){
  return onlyDigits(row?.student_phone || row?.phone || String(row?.user_email || '').replace(/^TEL:/i, '') || '');
}

async function buscarPresencasCursoTelefone(courseId, phone){
  const digits = onlyDigits(phone);

  // 1) Tenta o banco atualizado, com student_phone.
  let resp = await supabaseClient
    .from('attendance')
    .select('id, student_name, student_phone, lesson_id, course_id, created_at')
    .eq('course_id', courseId)
    .eq('student_phone', digits);
  if(!resp.error) return resp.data || [];

  // 2) Tenta a coluna phone, caso ela exista no banco do cliente.
  resp = await supabaseClient
    .from('attendance')
    .select('id, student_name, phone, lesson_id, course_id, created_at')
    .eq('course_id', courseId)
    .eq('phone', digits);
  if(!resp.error) return (resp.data || []).map(r => ({...r, student_phone: r.phone}));

  // 3) Funciona mesmo sem criar coluna nova: usa user_email para guardar TEL:telefone.
  resp = await supabaseClient
    .from('attendance')
    .select('id, student_name, user_email, lesson_id, course_id, created_at')
    .eq('course_id', courseId);
  if(resp.error) throw resp.error;
  return (resp.data || [])
    .filter(r => telefoneDaPresenca(r) === digits)
    .map(r => ({...r, student_phone: telefoneDaPresenca(r)}));
}
async function salvarCertificadoSupabase(payload){
  // Salva pelo servidor primeiro. Assim o admin consegue buscar mesmo quando
  // o navegador não tem permissão direta ou o cache do Supabase está atrasado.
  try{
    const res = await fetch('/api/certificates', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin',
      body:JSON.stringify(payload)
    });
    if(res.ok) return await res.json();
  }catch(e){ console.warn('Falha ao salvar certificado pela API:', e.message); }
  try{
    const { error } = await supabaseClient.from('certificates').upsert(payload, { onConflict:'course_id,student_phone' });
    if(error) console.warn('Certificado não salvo na tabela certificates:', error.message);
  }catch(e){ console.warn('Tabela certificates ainda não criada.', e.message); }
}
function abrirCertificadoPrint({nome, curso, codigo, data}){
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Certificado - ${escapeHtml(nome)}</title><style>
    @page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Georgia,'Times New Roman',serif;background:#f7f0df;color:#211306}.cert{width:297mm;height:210mm;padding:18mm;background:radial-gradient(circle at top,#fff7e5 0,#f5ead1 42%,#efe0bd 100%);position:relative;overflow:hidden}.cert:before{content:"";position:absolute;inset:10mm;border:3px solid #b98935}.cert:after{content:"";position:absolute;inset:15mm;border:1px solid rgba(55,31,8,.35)}.inner{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10mm 20mm}.logo{width:96px;height:96px;object-fit:contain;margin-bottom:12px}.church{font:700 18px Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#6a4015}.title{font-size:58px;letter-spacing:.08em;text-transform:uppercase;margin:18px 0 8px;color:#2a1707}.line{width:150mm;height:2px;background:#b98935;margin:10px auto 22px}.txt{font-size:23px;line-height:1.55;max-width:220mm}.name{font-size:42px;font-weight:700;margin:16px 0 8px;border-bottom:2px solid #2a1707;min-width:180mm;padding-bottom:8px}.course{font-weight:700;color:#5b3515}.footer{position:absolute;left:28mm;right:28mm;bottom:24mm;display:flex;justify-content:space-between;align-items:flex-end;font:14px Arial,sans-serif;color:#3b2411}.signature{width:78mm;border-top:1px solid #2a1707;padding-top:8px;text-align:center}.code{text-align:left}.print{position:fixed;right:18px;top:18px;border:0;background:#181008;color:#fff;padding:12px 18px;border-radius:999px;font:700 14px Arial;cursor:pointer}@media print{.print{display:none}}</style></head><body><button class="print" onclick="window.print()">Salvar / Imprimir PDF</button><section class="cert"><div class="inner"><img class="logo" src="/assets/logo-pedra-angular.png"><div class="church">Igreja do Evangelho Pedra Angular</div><h1 class="title">Certificado</h1><div class="line"></div><div class="txt">Certificamos que</div><div class="name">${escapeHtml(nome)}</div><div class="txt">concluiu com êxito todas as aulas do curso <span class="course">${escapeHtml(curso)}</span>.</div><div class="footer"><div class="code"><strong>Código:</strong> ${escapeHtml(codigo)}<br><strong>Data:</strong> ${escapeHtml(data)}</div><div class="signature">Igreja do Evangelho Pedra Angular</div></div></div></section></body></html>`;
  const win = window.open('', '_blank');
  win.document.write(html); win.document.close();
}
async function solicitarCertificado(courseId){
  if(!dbReady()) return alert('Supabase não configurado.');
  const phoneInput=document.getElementById(`cert-phone-${courseId}`);
  const msg=document.getElementById(`cert-msg-${courseId}`);
  const phone=phoneInput ? phoneInput.value : '';
  const digits=onlyDigits(phone);
  if(digits.length < 10){ if(msg) msg.innerHTML='<div class="presence-error">Digite o telefone completo.</div>'; return; }
  try{
    const courses=await buscarCursosComAulas();
    const course=courses.find(c=>String(c.id)===String(courseId));
    if(!course) throw new Error('Curso não encontrado.');
    const lessons=course.lessons || [];
    if(!lessons.length) throw new Error('Este curso ainda não possui aulas cadastradas.');
    const presencas=await buscarPresencasCursoTelefone(courseId, digits);
    const concluidas=new Set(presencas.map(p=>String(p.lesson_id)));
    const faltando=lessons.filter(a=>!concluidas.has(String(a.id)));
    if(faltando.length){
      if(msg) msg.innerHTML=`<div class="presence-error"><strong>Certificado ainda não liberado.</strong><br>Presenças encontradas: ${concluidas.size} de ${lessons.length}. Falta concluir: ${faltando.map(a=>escapeHtml(a.title)).join(', ')}.</div>`;
      return;
    }
    const nome=normalizarNome(presencas[0]?.student_name || 'Aluno concluinte');
    const codigo=certificateCode(courseId, digits);
    const data=new Date().toLocaleDateString('pt-BR');
    await salvarCertificadoSupabase({ course_id:courseId, course_title:course.title, student_name:nome, student_phone:digits, code:codigo, status:'issued', issued_at:new Date().toISOString() });
    if(msg) msg.innerHTML=`<div class="presence-ok"><strong>Certificado liberado!</strong> Código: ${codigo}</div>`;
    abrirCertificadoPrint({ nome, curso:course.title, codigo, data });
  }catch(err){ console.error(err); if(msg) msg.innerHTML='<div class="presence-error">Não foi possível verificar o certificado. Confira o telefone e tente novamente.</div>'; }
}

function configurarFormsPresenca(){
  document.querySelectorAll('.attendance-form').forEach(form => {
    if(form.dataset.ready) return;
    form.dataset.ready='1';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if(!dbReady()) return alert('Supabase não configurado.');
      const btn=form.querySelector('button');
      const original=btn.textContent;
      btn.disabled=true; btn.textContent='Salvando...';
      try{
        const studentName=normalizarNome(form.querySelector('[name="studentName"]').value);
        const phoneInput=form.querySelector('[name="studentPhone"]');
        const studentPhone=onlyDigits(phoneInput ? phoneInput.value : '');
        if(studentName.split(' ').length < 2) throw new Error('Digite nome e sobrenome.');
        if(studentPhone.length < 10) throw new Error('Digite o telefone completo.');
        const basePayload = {
          course_id: form.dataset.courseId,
          lesson_id: form.datasetLessonId || form.dataset.lessonId,
          student_name: studentName
        };

        // Tenta salvar com a coluna nova. Se o Supabase ainda não tiver essa coluna,
        // salva de forma compatível usando user_email = TEL:telefone.
        let resp = await supabaseClient.from('attendance').insert({ ...basePayload, student_phone: studentPhone });
        if(resp.error && /student_phone|schema cache|column/i.test(resp.error.message || '')){
          resp = await supabaseClient.from('attendance').insert({ ...basePayload, phone: studentPhone });
        }
        if(resp.error && /phone|schema cache|column/i.test(resp.error.message || '')){
          resp = await supabaseClient.from('attendance').insert({ ...basePayload, user_email: 'TEL:' + studentPhone });
        }
        if(resp.error) throw resp.error;
        form.reset();
        const msg=document.getElementById('attendance-message');
        if(msg) msg.innerHTML='<div class="panel center presence-ok"><strong>Presença registrada com sucesso!</strong></div>';
        alert('Presença registrada com sucesso!');
      }catch(err){
        console.error(err);
        alert(err.message || 'Erro ao registrar presença. Verifique a conexão com o Supabase.');
      }finally{
        btn.disabled=false; btn.textContent=original;
      }
    });
  });
}

async function carregarCursosAdmin(){
  const area=document.getElementById('admin-courses');
  const select=document.getElementById('lesson-course-select');
  if(!area && !select) return;
  if(!dbReady()){ if(area) area.innerHTML=dbErrorMsg(); return; }
  try{
    const courses=await buscarCursosComAulas();
    if(select){
      select.innerHTML = '<option value="">Selecione o curso</option>' + courses.map(c=>`<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
    }
    if(!area) return;
    if(!courses.length){ area.innerHTML='<div class="panel center"><p>Nenhum curso cadastrado.</p></div>'; return; }
    area.innerHTML=courses.map(c=>{
      const lessons=Array.isArray(c.lessons) ? c.lessons : [];
      const lessonList = lessons.length ? lessons.map((a,i)=>`<div class="admin-lesson" id="lesson-${escapeHtml(a.id)}">
        <div class="lesson-view">
          <strong>Aula ${i+1}: ${escapeHtml(a.title)}</strong>
          <p>${escapeHtml(a.description||'')}</p>
          <div class="course-actions">${a.videoUrl ? `<a class="btn" href="${escapeHtml(a.videoUrl)}" target="_blank">Ver vídeo</a>` : ''}${a.materialUrl ? `<a class="btn secondary" href="${escapeHtml(a.materialUrl)}" target="_blank">Ver material</a>` : ''}</div>
          <div class="admin-actions"><button type="button" onclick="abrirEdicaoAula('${a.id}')">Editar aula</button><button type="button" class="danger" onclick="excluirAulaSupabase('${a.id}')">Excluir aula</button></div>
        </div>
        <form class="lesson-edit-form" id="edit-lesson-${escapeHtml(a.id)}" style="display:none" onsubmit="salvarAulaSupabase(event, '${a.id}')">
          <h4>Editar aula</h4>
          <label>Título da aula</label>
          <input type="text" name="lessonTitle" value="${escapeHtml(a.title || '')}" required>
          <label>Descrição</label>
          <textarea name="lessonDescription">${escapeHtml(a.description || '')}</textarea>
          <label>Link do vídeo</label>
          <input type="url" name="videoUrl" value="${escapeHtml(a.videoUrl || '')}" placeholder="https://...">
          <label>Link do PDF ou material</label>
          <input type="url" name="materialUrl" value="${escapeHtml(a.materialUrl || '')}" placeholder="https://...">
          <div class="admin-actions"><button type="submit">Salvar alterações</button><button type="button" class="secondary" onclick="fecharEdicaoAula('${a.id}')">Cancelar</button></div>
        </form>
      </div>`).join('') : '<p class="helper">Nenhuma aula cadastrada neste curso.</p>';
      return `<article class="panel course-admin-card"><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description||'')}</p><div class="lessons-admin"><h4>Aulas cadastradas</h4>${lessonList}</div><button type="button" class="danger" onclick="excluirCursoSupabase('${c.id}')">Excluir curso inteiro</button></article>`;
    }).join('');
  }catch(e){
    console.error(e);
    if(area) area.innerHTML='<div class="panel center"><p>Não foi possível carregar os cursos.</p></div>';
  }
}


function abrirEdicaoAula(id){
  const form=document.getElementById(`edit-lesson-${id}`);
  if(form) form.style.display='block';
}
function fecharEdicaoAula(id){
  const form=document.getElementById(`edit-lesson-${id}`);
  if(form) form.style.display='none';
}
async function salvarAulaSupabase(event, id){
  event.preventDefault();
  const form=event.target;
  const btn=form.querySelector('button[type="submit"]');
  const original=btn.textContent;
  btn.disabled=true; btn.textContent='Salvando...';
  try{
    const params = new URLSearchParams(new FormData(form));
    const res = await fetch('/edit-lesson/' + encodeURIComponent(id), {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: params.toString(),
      credentials:'same-origin'
    });
    if(!res.ok) throw new Error('Erro ao editar aula.');
    await carregarCursosAdmin();
    alert('Aula atualizada com sucesso!');
  }catch(err){
    console.error(err);
    alert(err.message || 'Erro ao editar aula.');
  }finally{
    btn.disabled=false; btn.textContent=original;
  }
}
async function buscarCertificados(){
  // Usa a rota do servidor porque ela também mostra certificados gerados
  // automaticamente a partir de presença 100%, mesmo se ainda não foram salvos.
  try{
    const res = await fetch('/api/certificates', { credentials:'same-origin', cache:'no-store' });
    if(res.ok) return await res.json();
  }catch(e){ console.warn('Falha ao buscar certificados pela API:', e.message); }
  if(!dbReady()) throw new Error('Supabase não configurado');
  const { data, error } = await supabaseClient
    .from('certificates')
    .select('*')
    .order('issued_at', { ascending:false });
  if(error) throw error;
  return data || [];
}
async function carregarCertificadosAdmin(){
  const area=document.getElementById('admin-certificates');
  if(!area) return;
  if(!dbReady()){ area.innerHTML=dbErrorMsg(); return; }
  try{
    const termo=onlyDigits(document.getElementById('certificate-search')?.value || '') || String(document.getElementById('certificate-search')?.value || '').toLowerCase().trim();
    let certs=await buscarCertificados();
    if(termo){
      certs=certs.filter(c=>{
        const nome=c.student_name || c.studentName || c.name || '';
        const telefone=c.student_phone || c.phone || c.telefone || '';
        const curso=c.course_title || c.courseTitle || c.course || '';
        const codigo=c.code || c.certificate_code || c.codigo || '';
        const texto=[nome,telefone,curso,codigo,c.status].join(' ').toLowerCase();
        return texto.includes(String(termo).toLowerCase()) || onlyDigits(telefone).includes(onlyDigits(termo));
      });
    }
    if(!certs.length){ area.innerHTML='<div class="panel center"><p>Nenhum certificado encontrado.</p></div>'; return; }
    area.innerHTML=certs.map(c=>{
      const data=c.issued_at ? new Date(c.issued_at).toLocaleDateString('pt-BR') : new Date(c.created_at || Date.now()).toLocaleDateString('pt-BR');
      const nome=c.student_name || c.studentName || c.name || 'Aluno';
      const telefone=c.student_phone || c.phone || c.telefone || '';
      const curso=c.course_title || c.courseTitle || c.course || 'Curso';
      const codigo=c.code || c.certificate_code || c.codigo || '';
      const tagAuto=c.generated_from_attendance ? '<p><em>Gerado automaticamente pelas presenças concluídas.</em></p>' : '';
      const deleteBtn=c.generated_from_attendance ? '' : `<button type="button" class="danger" onclick="excluirCertificadoSupabase('${c.id}')">Excluir certificado</button>`;
      return `<article class="panel certificate-admin-card"><h3>${escapeHtml(nome)}</h3><p><strong>Curso:</strong> ${escapeHtml(curso)}</p><p><strong>Telefone:</strong> ${escapeHtml(formatPhone(telefone))}</p><p><strong>Código:</strong> ${escapeHtml(codigo)}</p><p><strong>Emissão:</strong> ${escapeHtml(data)}</p>${tagAuto}<div class="admin-actions"><button type="button" onclick="abrirCertificadoPrint({nome:'${escapeAttr(nome)}', curso:'${escapeAttr(curso)}', codigo:'${escapeAttr(codigo)}', data:'${escapeAttr(data)}'})">Reemitir PDF</button>${deleteBtn}</div></article>`;
    }).join('');
  }catch(e){
    console.error(e);
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar os certificados. Confira se a tabela certificates foi criada no Supabase.</p></div>';
  }
}
async function excluirCertificadoSupabase(id){
  if(String(id || '').startsWith('auto-')){
    alert('Este certificado foi montado automaticamente pelas presenças. Para remover, exclua/ajuste as presenças do aluno.');
    return;
  }
  if(!confirm('Excluir este certificado emitido?')) return;
  try{
    const res = await fetch('/delete-certificate/' + encodeURIComponent(id), { method:'POST', credentials:'same-origin' });
    if(!res.ok) throw new Error('Erro ao excluir certificado.');
  }catch(e){
    const { error } = await supabaseClient.from('certificates').delete().eq('id', id);
    if(error) return alert('Erro ao excluir certificado.');
  }
  await carregarCertificadosAdmin();
}

async function excluirCursoSupabase(id){
  if(!confirm('Tem certeza que deseja excluir este curso e suas aulas?')) return;
  try{
    const res = await fetch('/delete-course/' + encodeURIComponent(id), { method:'POST', credentials:'same-origin' });
    if(!res.ok) throw new Error('Erro ao excluir curso.');
    await carregarCursosAdmin();
    await carregarCursos();
  }catch(e){ alert(e.message || 'Erro ao excluir curso.'); }
}

async function excluirAulaSupabase(id){
  if(!confirm('Excluir esta aula?')) return;
  try{
    const res = await fetch('/delete-lesson/0/' + encodeURIComponent(id), { method:'POST', credentials:'same-origin' });
    if(!res.ok) throw new Error('Erro ao excluir aula.');
    await carregarCursosAdmin();
    await carregarCursos();
  }catch(e){ alert(e.message || 'Erro ao excluir aula.'); }
}

function configurarFormsCursosAdmin(){
  // Deixa os formulários de criar curso/aula enviarem para as rotas do servidor.
  // Isso evita problema de permissão/RLS no Supabase pelo navegador.
  return;
}

async function carregarPresencasAdmin(){
  const area=document.getElementById('admin-attendance');
  if(!area) return;
  if(!dbReady()){ area.innerHTML=dbErrorMsg(); return; }
  try{
    const records=await buscarPresencas();
    if(!records.length){ area.innerHTML='<div class="panel center"><p>Nenhuma presença registrada ainda.</p></div>'; return; }
    area.innerHTML=`<div class="attendance-table"><table><thead><tr><th>Aluno</th><th>Telefone</th><th>Curso</th><th>Aula</th><th>Data/Hora</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(formatPhone(r.studentPhone || ''))}</td><td>${escapeHtml(r.courseTitle)}</td><td>${escapeHtml(r.lessonTitle)}</td><td>${new Date(r.createdAt).toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar a lista de presença.</p></div>';
  }
}

async function ajustarMenuLogado(){
  const menu=document.getElementById('menu');
  if(!menu) return;
  try{
    const res=await fetch('/api/me?ts=' + Date.now(), { cache:'no-store' });
    const data=await res.json();
    if(!data.logged) return;
    const painel = data.user.role === 'admin' ? '/admin.html' : data.user.role === 'secretaria' ? '/area-secretaria.html' : data.user.role === 'media' ? '/area-midia.html' : '/cursos.html';
    const nomePainel = data.user.role === 'admin' ? 'Painel Admin' : data.user.role === 'secretaria' ? 'Painel Secretaria' : data.user.role === 'media' ? 'Painel Mídia' : 'Meus Cursos';
    const loginLink=[...menu.querySelectorAll('a')].find(a => a.getAttribute('href') === 'login.html' || a.getAttribute('href') === '/login.html');
    if(loginLink){
      loginLink.textContent = nomePainel;
      loginLink.setAttribute('href', painel);
    } else if(![...menu.querySelectorAll('a')].some(a => a.getAttribute('href') === painel)){
      const a=document.createElement('a');
      a.href=painel;
      a.textContent=nomePainel;
      menu.appendChild(a);
    }
    if(![...menu.querySelectorAll('a')].some(a => a.getAttribute('href') === '/logout')){
      const sair=document.createElement('a');
      sair.href='/logout';
      sair.textContent='Sair';
      menu.appendChild(sair);
    }
  }catch(e){}
}

async function carregarPresencasPorCurso(){
  const area=document.getElementById('admin-attendance-by-course');
  const filter=document.getElementById('attendance-course-filter');
  if(!area) return;
  if(!dbReady()){ area.innerHTML=dbErrorMsg(); return; }
  try{
    const [records, courses]=await Promise.all([buscarPresencas(), buscarCursosComAulas()]);

    if(filter && !filter.dataset.loaded){
      filter.innerHTML = '<option value="">Todos os cursos</option>' + courses.map(c=>`<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
      filter.dataset.loaded='1';
      filter.addEventListener('change', carregarPresencasPorCurso);
    }

    const selected = filter ? String(filter.value || '') : '';
    const filtered = selected ? records.filter(r => String(r.courseId) === selected) : records;

    if(!filtered.length){
      area.innerHTML='<div class="panel center"><p>Nenhuma presença registrada para este curso ainda.</p></div>';
      return;
    }

    const grouped = {};
    filtered.forEach(r=>{
      const courseKey = String(r.courseId || r.courseTitle || 'sem-curso');
      if(!grouped[courseKey]) grouped[courseKey] = { title: r.courseTitle || 'Curso sem nome', lessons: {} };
      const lessonKey = String(r.lessonId || r.lessonTitle || 'sem-aula');
      if(!grouped[courseKey].lessons[lessonKey]) grouped[courseKey].lessons[lessonKey] = { title: r.lessonTitle || 'Aula sem nome', students: [] };
      grouped[courseKey].lessons[lessonKey].students.push(r);
    });

    area.innerHTML = Object.values(grouped).map(course=>{
      const totalCurso = Object.values(course.lessons).reduce((sum, lesson)=>sum + lesson.students.length, 0);
      const lessonsHtml = Object.values(course.lessons).map(lesson=>{
        const rows = lesson.students.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(formatPhone(r.studentPhone || ''))}</td><td>${new Date(r.createdAt).toLocaleString('pt-BR')}</td></tr>`).join('');
        return `<div class="attendance-lesson-block"><h4>${escapeHtml(lesson.title)} <span>${lesson.students.length} presença(s)</span></h4><div class="attendance-table"><table><thead><tr><th>Nº</th><th>Aluno</th><th>Telefone</th><th>Data/Hora</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
      }).join('');
      return `<article class="panel attendance-course-block"><h3>${escapeHtml(course.title)}</h3><p class="helper">Total registrado neste curso: <strong>${totalCurso}</strong> presença(s).</p>${lessonsHtml}</article>`;
    }).join('');
  }catch(e){
    console.error(e);
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar as presenças por curso.</p></div>';
  }
}

carregarPosts();
carregarPostsAdmin();
carregarPostsMidia();
carregarPostsSecretaria();
carregarCursos();
carregarCursosAdmin();
configurarFormsCursosAdmin();
carregarPresencasAdmin();
ajustarMenuLogado();
carregarPresencasPorCurso();
carregarCertificadosAdmin();
aplicarMascaraTelefones();
if(document.getElementById('feed')) setInterval(carregarPosts, 10000);

/* Efeitos visuais premium seguros: não altera login, posts, formulários ou rotas. */
document.addEventListener('DOMContentLoaded', function(){
  const items = document.querySelectorAll('.section, .feature, .card, .panel, .highlight-card, .cta, form, .course-box, .lesson-card');
  items.forEach(el => el.classList.add('reveal-premium'));
  if('IntersectionObserver' in window){
    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:0.12});
    items.forEach(el => observer.observe(el));
  }else{
    items.forEach(el => el.classList.add('is-visible'));
  }
});

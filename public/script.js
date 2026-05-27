const usuarioLogado = localStorage.getItem("usuarioLogado");
if (window.location.pathname.includes("cursos.html") && !usuarioLogado) {
  window.location.href = "login.html";
}

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
  if(!dbReady()) throw new Error('Supabase não configurado');
  const { data, error } = await supabaseClient
    .from('attendance')
    .select('id, student_name, created_at, course_id, lesson_id, courses(title), lessons(title)')
    .order('created_at', { ascending:false });
  if(error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    studentName: r.student_name,
    createdAt: r.created_at,
    courseId: r.course_id,
    lessonId: r.lesson_id,
    courseTitle: r.courses?.title || 'Curso sem nome',
    lessonTitle: r.lessons?.title || 'Aula sem nome'
  }));
}

async function carregarCursos(){
  const area=document.getElementById('courses');
  if(!area) return;
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
              <div class="attendance-row">
                <input type="text" name="studentName" placeholder="Digite seu nome completo" required>
                <button type="submit">Confirmar presença</button>
              </div>
            </form>
          </div>
        </div>`;
      }).join('') : '<p class="helper">Este curso ainda não possui aulas cadastradas.</p>';
      return `<article class="course-box collapsed"><button type="button" class="course-toggle" onclick="toggleCourse(this)"><div><small>Curso ${courseIndex+1}</small><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description||'')}</p></div><span>Ver aulas</span></button><div class="lessons-list">${lessonsHtml}</div></article>`;
    }).join('');
    configurarFormsPresenca();
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
        const studentName=form.querySelector('[name="studentName"]').value.trim();
        const { error } = await supabaseClient.from('attendance').insert({
          course_id: form.dataset.courseId,
          lesson_id: form.dataset.lessonId,
          student_name: studentName
        });
        if(error) throw error;
        form.reset();
        const msg=document.getElementById('attendance-message');
        if(msg) msg.innerHTML='<div class="panel center presence-ok"><strong>Presença registrada com sucesso!</strong></div>';
        alert('Presença registrada com sucesso!');
      }catch(err){
        console.error(err);
        alert('Erro ao registrar presença. Verifique a conexão com o Supabase.');
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
      const lessonList = lessons.length ? lessons.map((a,i)=>`<div class="admin-lesson"><strong>Aula ${i+1}: ${escapeHtml(a.title)}</strong><p>${escapeHtml(a.description||'')}</p><div class="course-actions">${a.videoUrl ? `<a class="btn" href="${escapeHtml(a.videoUrl)}" target="_blank">Ver vídeo</a>` : ''}${a.materialUrl ? `<a class="btn secondary" href="${escapeHtml(a.materialUrl)}" target="_blank">Ver material</a>` : ''}</div><button type="button" class="danger" onclick="excluirAulaSupabase('${a.id}')">Excluir aula</button></div>`).join('') : '<p class="helper">Nenhuma aula cadastrada neste curso.</p>';
      return `<article class="panel course-admin-card"><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description||'')}</p><div class="lessons-admin"><h4>Aulas cadastradas</h4>${lessonList}</div><button type="button" class="danger" onclick="excluirCursoSupabase('${c.id}')">Excluir curso inteiro</button></article>`;
    }).join('');
  }catch(e){
    console.error(e);
    if(area) area.innerHTML='<div class="panel center"><p>Não foi possível carregar os cursos.</p></div>';
  }
}

async function excluirCursoSupabase(id){
  if(!confirm('Tem certeza que deseja excluir este curso e suas aulas?')) return;
  const { error } = await supabaseClient.from('courses').delete().eq('id', id);
  if(error) return alert('Erro ao excluir curso.');
  await carregarCursosAdmin();
  await carregarCursos();
}

async function excluirAulaSupabase(id){
  if(!confirm('Excluir esta aula?')) return;
  const { error } = await supabaseClient.from('lessons').delete().eq('id', id);
  if(error) return alert('Erro ao excluir aula.');
  await carregarCursosAdmin();
  await carregarCursos();
}

function configurarFormsCursosAdmin(){
  const courseForm=document.querySelector('form[action="/course"]');
  if(courseForm){
    courseForm.addEventListener('submit', async e => {
      e.preventDefault();
      if(!dbReady()) return alert('Supabase não configurado.');
      const btn=courseForm.querySelector('button');
      const original=btn.textContent;
      btn.disabled=true; btn.textContent='Criando...';
      try{
        const title=courseForm.querySelector('[name="title"]').value.trim();
        const description=courseForm.querySelector('[name="description"]').value.trim();
        const { error } = await supabaseClient.from('courses').insert({ title, description });
        if(error) throw error;
        courseForm.reset();
        await carregarCursosAdmin();
        alert('Curso criado com sucesso!');
      }catch(err){ console.error(err); alert('Erro ao criar curso. Verifique o Supabase.'); }
      finally{ btn.disabled=false; btn.textContent=original; }
    });
  }

  const lessonForm=document.querySelector('form[action="/lesson"]');
  if(lessonForm){
    lessonForm.addEventListener('submit', async e => {
      e.preventDefault();
      if(!dbReady()) return alert('Supabase não configurado.');
      const btn=lessonForm.querySelector('button');
      const original=btn.textContent;
      btn.disabled=true; btn.textContent='Adicionando...';
      try{
        const course_id=lessonForm.querySelector('[name="courseId"]').value;
        const title=lessonForm.querySelector('[name="lessonTitle"]').value.trim();
        const description=lessonForm.querySelector('[name="lessonDescription"]').value.trim();
        const video_url=lessonForm.querySelector('[name="videoUrl"]').value.trim();
        const material_url=lessonForm.querySelector('[name="materialUrl"]').value.trim();
        if(!course_id) throw new Error('Selecione um curso.');
        const payload={ course_id, title, video_url, material_url };
        if(description) payload.description = description;
        const { error } = await supabaseClient.from('lessons').insert(payload);
        if(error) throw error;
        lessonForm.reset();
        await carregarCursosAdmin();
        alert('Aula adicionada com sucesso!');
      }catch(err){ console.error(err); alert(err.message || 'Erro ao adicionar aula.'); }
      finally{ btn.disabled=false; btn.textContent=original; }
    });
  }
}

async function carregarPresencasAdmin(){
  const area=document.getElementById('admin-attendance');
  if(!area) return;
  if(!dbReady()){ area.innerHTML=dbErrorMsg(); return; }
  try{
    const records=await buscarPresencas();
    if(!records.length){ area.innerHTML='<div class="panel center"><p>Nenhuma presença registrada ainda.</p></div>'; return; }
    area.innerHTML=`<div class="attendance-table"><table><thead><tr><th>Aluno</th><th>Curso</th><th>Aula</th><th>Data/Hora</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(r.courseTitle)}</td><td>${escapeHtml(r.lessonTitle)}</td><td>${new Date(r.createdAt).toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></div>`;
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
        const rows = lesson.students.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.studentName)}</td><td>${new Date(r.createdAt).toLocaleString('pt-BR')}</td></tr>`).join('');
        return `<div class="attendance-lesson-block"><h4>${escapeHtml(lesson.title)} <span>${lesson.students.length} presença(s)</span></h4><div class="attendance-table"><table><thead><tr><th>Nº</th><th>Aluno</th><th>Data/Hora</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
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
if(document.getElementById('feed')) setInterval(carregarPosts, 10000);

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

async function carregarCursos(){
  const area=document.getElementById('courses');
  if(!area) return;
  try{
    const res=await fetch('/api/courses?ts=' + Date.now(), { cache:'no-store' });
    if(res.status === 401 || res.redirected) { location.href='/login.html'; return; }
    const courses=await res.json();
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
            <form action="/attendance" method="POST" class="attendance-form">
              <input type="hidden" name="courseId" value="${c.id}">
              <input type="hidden" name="lessonId" value="${a.id}">
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
  }catch(e){
    area.innerHTML='<div class="panel center"><h2>Não foi possível carregar os cursos.</h2><p>Verifique se o servidor está iniciado.</p></div>';
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

async function carregarCursosAdmin(){
  const area=document.getElementById('admin-courses');
  const select=document.getElementById('lesson-course-select');
  if(!area && !select) return;
  try{
    const res=await fetch('/api/courses?ts=' + Date.now(), { cache:'no-store' });
    const courses=await res.json();
    if(select){
      select.innerHTML = '<option value="">Selecione o curso</option>' + courses.map(c=>`<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
    }
    if(!area) return;
    if(!courses.length){ area.innerHTML='<div class="panel center"><p>Nenhum curso cadastrado.</p></div>'; return; }
    area.innerHTML=courses.map(c=>{
      const lessons=Array.isArray(c.lessons) ? c.lessons : [];
      const lessonList = lessons.length ? lessons.map((a,i)=>`<div class="admin-lesson"><strong>Aula ${i+1}: ${escapeHtml(a.title)}</strong><p>${escapeHtml(a.description||'')}</p><div class="course-actions">${a.videoUrl ? `<a class="btn" href="${escapeHtml(a.videoUrl)}" target="_blank">Ver vídeo</a>` : ''}${a.materialUrl ? `<a class="btn secondary" href="${escapeHtml(a.materialUrl)}" target="_blank">Ver material</a>` : ''}</div><form action="/delete-lesson/${c.id}/${a.id}" method="POST" onsubmit="return confirm('Excluir esta aula?')"><button type="submit" class="danger">Excluir aula</button></form></div>`).join('') : '<p class="helper">Nenhuma aula cadastrada neste curso.</p>';
      return `<article class="panel course-admin-card"><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description||'')}</p><div class="lessons-admin"><h4>Aulas cadastradas</h4>${lessonList}</div><form action="/delete-course/${c.id}" method="POST" onsubmit="return confirm('Tem certeza que deseja excluir este curso e suas aulas?')"><button type="submit" class="danger">Excluir curso inteiro</button></form></article>`;
    }).join('');
  }catch(e){
    if(area) area.innerHTML='<div class="panel center"><p>Não foi possível carregar os cursos.</p></div>';
  }
}

carregarPosts();
carregarCursos();
carregarCursosAdmin();
carregarPostsAdmin();
carregarPostsMidia();

async function carregarPresencasAdmin(){
  const area=document.getElementById('admin-attendance');
  if(!area) return;
  try{
    const res=await fetch('/api/attendance?ts=' + Date.now(), { cache:'no-store' });
    const records=await res.json();
    if(!records.length){ area.innerHTML='<div class="panel center"><p>Nenhuma presença registrada ainda.</p></div>'; return; }
    area.innerHTML=`<div class="attendance-table"><table><thead><tr><th>Aluno</th><th>Curso</th><th>Aula</th><th>Data/Hora</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(r.courseTitle)}</td><td>${escapeHtml(r.lessonTitle)}</td><td>${new Date(r.createdAt).toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar a lista de presença.</p></div>';
  }
}

carregarPostsSecretaria();
carregarPresencasAdmin();
if(document.getElementById('feed')) setInterval(carregarPosts, 10000);

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

ajustarMenuLogado();

async function carregarPresencasPorCurso(){
  const area=document.getElementById('admin-attendance-by-course');
  const filter=document.getElementById('attendance-course-filter');
  if(!area) return;
  try{
    const [attendanceRes, coursesRes]=await Promise.all([
      fetch('/api/attendance?ts=' + Date.now(), { cache:'no-store' }),
      fetch('/api/courses?ts=' + Date.now(), { cache:'no-store' })
    ]);
    const records=await attendanceRes.json();
    const courses=await coursesRes.json();

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
    area.innerHTML='<div class="panel center"><p>Não foi possível carregar as presenças por curso.</p></div>';
  }
}

carregarPresencasPorCurso();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const https = require("https");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

// SUPABASE - tudo permanente no banco de dados
const SUPABASE_URL = process.env.SUPABASE_URL || "https://lijbjnnprayepmvkhcjr.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_7NkHRzXPB9Wd8oLujGnHvw_chSIs2p6";

async function sb(pathname, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.message || data?.hint || text || `Erro Supabase ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
function enc(v){ return encodeURIComponent(String(v)); }
function normalizeRole(role){ return role === "secretary" ? "secretaria" : role; }
function userFromDb(u){ return u ? { id:u.id, name:u.name, email:u.email, role:normalizeRole(u.role || "member"), password:u.password } : null; }

async function ensureDefaultUsers(){
  const defaults = [
    { name:"Pr. Daniel", email:"admin@igreja.com", password:"123456", role:"admin" },
    { name:"Mídia", email:"midia@igreja.com", password:"123456", role:"media" },
    { name:"Secretaria", email:"secretaria@igreja.com", password:"123456", role:"secretaria" },
    { name:"Membro da Igreja", email:"membro@igreja.com", password:"123456", role:"member" }
  ];
  for(const u of defaults){
    const found = await sb(`users_app?email=eq.${enc(u.email)}&select=id`).catch(()=>[]);
    if(!found || !found.length){
      await sb("users_app", { method:"POST", body:JSON.stringify(u) });
    }
  }
}

async function getUserByEmail(email){
  const data = await sb(`users_app?email=eq.${enc(String(email).toLowerCase())}&select=*`);
  return userFromDb(Array.isArray(data) ? data[0] : null);
}
async function getUserById(id){
  const data = await sb(`users_app?id=eq.${enc(id)}&select=*`);
  return userFromDb(Array.isArray(data) ? data[0] : null);
}
async function updateUserPassword(email, password){
  return sb(`users_app?email=eq.${enc(String(email).toLowerCase())}`, { method:"PATCH", body:JSON.stringify({ password }) });
}
async function passwordMatches(input, stored){
  if(!stored) return false;
  if(String(stored).startsWith("$2")) return bcrypt.compare(input, stored);
  return String(input) === String(stored);
}

function postTableByCategory(category){
  if(category === "media") return "media_posts";
  if(category === "secretaria") return "secretary_posts";
  return "pastor_studies";
}
function mapPost(row, category){
  const author = category === "media" ? "Mídia" : category === "secretaria" ? "Secretaria" : "Pr. Daniel";
  return {
    id: row.id,
    title: row.title,
    description: row.description || row.content || "",
    type: row.type || "foto",
    mime: row.mime || "",
    file: row.file || row.url || row.image_url || row.video_url || "",
    url: row.url || row.file || row.image_url || row.video_url || "",
    cloudinaryPublicId: row.cloudinary_public_id,
    cloudinaryResourceType: row.cloudinary_resource_type,
    originalName: row.original_name,
    author: row.author || author,
    category,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
async function readPosts(){
  const [admin, media, secretaria] = await Promise.all([
    sb("pastor_studies?select=*&order=created_at.desc").catch(()=>[]),
    sb("media_posts?select=*&order=created_at.desc").catch(()=>[]),
    sb("secretary_posts?select=*&order=created_at.desc").catch(()=>[])
  ]);
  return [
    ...admin.map(r=>mapPost(r,"admin")),
    ...media.map(r=>mapPost(r,"media")),
    ...secretaria.map(r=>mapPost(r,"secretaria"))
  ].sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0));
}
async function findPost(id){
  const posts = await readPosts();
  return posts.find(p => String(p.id) === String(id));
}
async function insertPost(post){
  const table = postTableByCategory(post.category);
  return sb(table, { method:"POST", body:JSON.stringify({
    title: post.title,
    description: post.description,
    content: post.description,
    type: post.type,
    mime: post.mime,
    file: post.file,
    url: post.url,
    image_url: post.type === "foto" ? post.file : null,
    video_url: post.type !== "foto" ? post.file : null,
    cloudinary_public_id: post.cloudinaryPublicId,
    cloudinary_resource_type: post.cloudinaryResourceType,
    original_name: post.originalName,
    author: post.author,
    category: post.category
  }) });
}
async function updatePost(id, category, changes){
  const table = postTableByCategory(category);
  return sb(`${table}?id=eq.${enc(id)}`, { method:"PATCH", body:JSON.stringify({
    title: changes.title,
    description: changes.description,
    content: changes.description,
    updated_at: new Date().toISOString()
  }) });
}
async function deletePostDb(id, category){
  const table = postTableByCategory(category);
  return sb(`${table}?id=eq.${enc(id)}`, { method:"DELETE", prefer:"return=minimal" });
}

async function readCourses(){
  const courses = await sb("courses?select=*&order=created_at.desc").catch(()=>[]);
  const lessons = await sb("lessons?select=*&order=created_at.asc").catch(()=>[]);
  return courses.map(c => ({
    id: c.id, title: c.title, description: c.description, createdAt: c.created_at,
    lessons: lessons.filter(l => String(l.course_id) === String(c.id)).map(l => ({
      id: l.id, title: l.title, description: l.description, videoUrl: l.video_url, materialUrl: l.material_url, createdAt: l.created_at
    }))
  }));
}
async function readAttendance(){
  const records = await sb("attendance?select=*,courses(title),lessons(title)&order=created_at.desc").catch(()=>[]);
  return records.map(r => ({
    id: r.id,
    courseId: r.course_id,
    lessonId: r.lesson_id,
    courseTitle: r.courses?.title || r.course_title || "Curso sem nome",
    lessonTitle: r.lessons?.title || r.lesson_title || "Aula sem nome",
    studentName: r.student_name,
    userEmail: r.user_email,
    createdAt: r.created_at
  }));
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "igreja-pedra-angular",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax" }
}));

// CLOUDINARY
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dpohhnsl6";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "813872269517687";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "6_Bpq9EPOQn-TXwlzy6GFMNVSfY";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "pedra-angular";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 500 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image|video|audio)\//.test(file.mimetype);
    cb(ok ? null : new Error("Tipo de arquivo não permitido."), ok);
  }
});
function cloudinaryResourceType(mimetype){ return String(mimetype || "").startsWith("image/") ? "image" : "video"; }
function cloudinarySignature(params){
  const str = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== "").sort().map(k => `${k}=${params[k]}`).join("&") + CLOUDINARY_API_SECRET;
  return crypto.createHash("sha1").update(str).digest("hex");
}
async function uploadToCloudinary(file){
  if(!file || !file.buffer) throw new Error("Arquivo inválido para upload.");
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const resourceType = cloudinaryResourceType(file.mimetype);
    const paramsToSign = { folder: CLOUDINARY_FOLDER, timestamp };
    const signature = cloudinarySignature(paramsToSign);
    const boundary = "----CloudinaryBoundary" + Date.now();
    const chunks = [];
    function addField(name, value){
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
      chunks.push(Buffer.from(String(value) + "\r\n"));
    }
    addField("api_key", CLOUDINARY_API_KEY); addField("timestamp", timestamp); addField("folder", CLOUDINARY_FOLDER); addField("signature", signature);
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${file.originalname || 'arquivo'}"\r\n`));
    chunks.push(Buffer.from(`Content-Type: ${file.mimetype}\r\n\r\n`));
    chunks.push(file.buffer); chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);
    const req = https.request({ hostname:"api.cloudinary.com", path:`/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, method:"POST", headers:{ "Content-Type":`multipart/form-data; boundary=${boundary}`, "Content-Length":body.length } }, res => {
      let data=""; res.on("data", c=>data+=c); res.on("end", ()=>{ try{ const json=JSON.parse(data||"{}"); if(res.statusCode>=200 && res.statusCode<300) resolve({ ...json, resourceType }); else reject(new Error(json.error?.message || "Erro ao enviar para o Cloudinary.")); }catch(e){ reject(e); } });
    });
    req.on("error", reject); req.write(body); req.end();
  });
}
async function deleteFromCloudinary(post){
  if(!post || !post.cloudinaryPublicId) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType = post.cloudinaryResourceType || (post.type === "foto" ? "image" : "video");
  const paramsToSign = { public_id: post.cloudinaryPublicId, timestamp };
  const signature = cloudinarySignature(paramsToSign);
  const body = new URLSearchParams({ public_id: post.cloudinaryPublicId, api_key: CLOUDINARY_API_KEY, timestamp:String(timestamp), signature });
  try{ await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`, { method:"POST", body }); }catch(e){ console.warn("Não foi possível excluir do Cloudinary:", e.message); }
}

function roleFromRequest(req){
  if(req.session && req.session.user && req.session.user.role) return req.session.user.role;
  const area = String(req.body?.postArea || req.body?.category || "").toLowerCase();
  if(["admin","media","secretaria"].includes(area)) return area;
  const ref = String(req.get("referer") || "").toLowerCase();
  if(ref.includes("area-midia")) return "media";
  if(ref.includes("area-secretaria")) return "secretaria";
  if(ref.includes("admin")) return "admin";
  return null;
}
function backByRole(role){
  if(role === "admin") return "/admin.html";
  if(role === "secretaria") return "/area-secretaria.html";
  if(role === "media") return "/area-midia.html";
  return "/login.html";
}
function canPublish(req, res, next){
  const role = roleFromRequest(req);
  if (["admin","media","secretaria"].includes(role)) return next();
  res.redirect("/login.html");
}
function loggedOnly(req, res, next){ if (req.session.user) return next(); res.redirect("/login.html"); }
function mediaOnly(req, res, next){ if (req.session.user && req.session.user.role === "media") return next(); if (req.session.user && req.session.user.role === "admin") return res.redirect("/admin.html"); res.redirect("/login.html"); }
function adminOnly(req, res, next){ if (req.session.user && req.session.user.role === "admin") return next(); res.redirect("/login.html"); }
function secretariaOnly(req, res, next){ if (req.session.user && req.session.user.role === "secretaria") return next(); if (req.session.user && req.session.user.role === "admin") return res.redirect("/admin.html"); if (req.session.user && req.session.user.role === "media") return res.redirect("/area-midia.html"); res.redirect("/login.html"); }

app.get("/midias.html", (req,res)=>res.redirect("/midia.html"));
app.get("/area-midia.html", mediaOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "area-midia.html")));
app.get("/area-secretaria.html", secretariaOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "area-secretaria.html")));
app.get("/admin.html", adminOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/presencas.html", adminOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "presencas.html")));
app.get("/cursos.html", loggedOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "cursos.html")));

app.use(express.static(path.join(__dirname, "public")));

app.post("/register", (req, res) => res.send("Cadastro desativado. Use o login de administrador ou mídia."));
app.post("/login", async (req, res) => {
  try{
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user) return res.send(errorPage("Usuário não encontrado.", "/login.html"));
    const valid = await passwordMatches(password, user.password);
    if (!valid) return res.send(errorPage("Senha incorreta.", "/login.html"));
    req.session.user = { id:user.id, name:user.name, email:user.email, role:user.role };
    req.session.save(() => res.redirect(user.role === 'admin' ? '/admin.html' : user.role === 'secretaria' ? '/area-secretaria.html' : user.role === 'media' ? '/area-midia.html' : '/cursos.html'));
  }catch(e){ res.send(errorPage("Erro ao fazer login: " + e.message, "/login.html")); }
});
app.get("/api/me", async (req,res)=>{
  res.set("Cache-Control", "no-store");
  if(!req.session.user) return res.json({ logged:false });
  try{
    const fresh = await getUserById(req.session.user.id);
    if(fresh){ req.session.user = { id:fresh.id, name:fresh.name, email:fresh.email, role:fresh.role }; }
  }catch(e){}
  res.json({ logged:true, user:req.session.user });
});
app.get("/login.html", (req,res)=>{
  if(req.session.user){ return res.redirect(req.session.user.role === "admin" ? "/admin.html" : req.session.user.role === "secretaria" ? "/area-secretaria.html" : req.session.user.role === "media" ? "/area-midia.html" : "/cursos.html"); }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/logout", (req,res)=> req.session.destroy(()=>res.redirect("/login.html")) );

app.post("/upload", canPublish, upload.single("media"), async (req, res) => {
  const role = roleFromRequest(req);
  const back = backByRole(role);
  try{
    if(!req.file) return res.send(errorPage("Selecione uma imagem, vídeo ou áudio.", back));
    let type = "foto";
    if(req.file.mimetype.startsWith("video/")) type = "video";
    if(req.file.mimetype.startsWith("audio/")) type = "audio";
    const cloudinaryFile = await uploadToCloudinary(req.file);
    const isAdmin = role === "admin";
    const isSecretaria = role === "secretaria";
    const author = isAdmin ? "Pr. Daniel" : isSecretaria ? "Secretaria" : "Mídia";
    const category = isAdmin ? "admin" : isSecretaria ? "secretaria" : "media";
    await insertPost({
      title: req.body.title || (isAdmin ? "Estudo" : isSecretaria ? "Publicação" : "Mídia"),
      description: req.body.description || "",
      type,
      mime: req.file.mimetype,
      file: cloudinaryFile.secure_url,
      url: cloudinaryFile.secure_url,
      cloudinaryPublicId: cloudinaryFile.public_id,
      cloudinaryResourceType: cloudinaryFile.resourceType,
      originalName: req.file.originalname,
      author,
      category
    });
    res.redirect(isAdmin ? '/estudos-pr-daniel.html' : isSecretaria ? '/publicacoes.html' : '/midia.html');
  }catch(e){ return res.status(400).send(errorPage(e.message || "Erro ao enviar arquivo.", back)); }
});
app.use((err, req, res, next) => {
  if(err){ const role = roleFromRequest(req); const back = backByRole(role); return res.status(400).send(errorPage(err.message || "Erro ao enviar arquivo.", back)); }
  next();
});

app.get("/api/posts", async (req,res)=>{ res.set("Cache-Control", "no-store"); try{ res.json(await readPosts()); }catch(e){ res.status(500).json([]); } });
function canManagePost(user, post){ if(!user || !post) return false; if(user.role === "admin") return true; if(user.role === "media") return post.category === "media" || post.author === "Mídia"; if(user.role === "secretaria") return post.category === "secretaria" || post.author === "Secretaria"; return false; }
app.post("/delete-post/:id", canPublish, async (req,res)=>{
  const post = await findPost(req.params.id);
  const back = req.session.user.role === "media" ? "/area-midia.html" : req.session.user.role === "secretaria" ? "/area-secretaria.html" : "/admin.html";
  if(!canManagePost(req.session.user, post)) return res.status(403).send(errorPage("Você não tem permissão para excluir esta publicação.", back));
  await deleteFromCloudinary(post);
  await deletePostDb(post.id, post.category);
  res.redirect(back);
});
app.post("/edit-post/:id", canPublish, async (req,res)=>{
  const post = await findPost(req.params.id);
  const back = req.session.user.role === "media" ? "/area-midia.html" : req.session.user.role === "secretaria" ? "/area-secretaria.html" : "/admin.html";
  if(!canManagePost(req.session.user, post)) return res.status(403).send(errorPage("Você não tem permissão para alterar esta publicação.", back));
  await updatePost(post.id, post.category, { title:(req.body.title || "").trim() || post.title || "Publicação", description:(req.body.description || "").trim() });
  res.redirect(back);
});

app.get("/api/courses", loggedOnly, async (req,res)=>{ res.set("Cache-Control", "no-store"); res.json(await readCourses()); });
app.post("/course", adminOnly, async (req,res)=>{
  const title = (req.body.title || "").trim(); const description = (req.body.description || "").trim();
  if(!title) return res.send(errorPage("Digite o título do curso.", "/admin.html"));
  await sb("courses", { method:"POST", body:JSON.stringify({ title, description }) });
  res.redirect("/admin.html");
});
app.post("/lesson", adminOnly, async (req,res)=>{
  const course_id = req.body.courseId; const title = (req.body.lessonTitle || "").trim();
  if(!course_id) return res.send(errorPage("Selecione o curso da aula.", "/admin.html"));
  if(!title) return res.send(errorPage("Digite o título da aula.", "/admin.html"));
  await sb("lessons", { method:"POST", body:JSON.stringify({ course_id, title, description:(req.body.lessonDescription||"").trim(), video_url:(req.body.videoUrl||"").trim(), material_url:(req.body.materialUrl||"").trim() }) });
  res.redirect("/admin.html");
});
app.post("/course/:id/lesson", adminOnly, async (req,res)=>{
  const course_id = req.params.id;
  const title = (req.body.lessonTitle || "").trim();
  if(!title) return res.send(errorPage("Digite o título da aula.", "/admin.html"));
  await sb("lessons", { method:"POST", body:JSON.stringify({
    course_id,
    title,
    description:(req.body.lessonDescription||"").trim(),
    video_url:(req.body.videoUrl||"").trim(),
    material_url:(req.body.materialUrl||"").trim()
  }) });
  res.redirect("/admin.html");
});
app.post("/delete-lesson/:courseId/:lessonId", adminOnly, async (req,res)=>{ await sb(`lessons?id=eq.${enc(req.params.lessonId)}`, { method:"DELETE", prefer:"return=minimal" }); res.redirect("/admin.html"); });
app.post("/delete-course/:id", adminOnly, async (req,res)=>{ await sb(`courses?id=eq.${enc(req.params.id)}`, { method:"DELETE", prefer:"return=minimal" }); res.redirect("/admin.html"); });
app.post("/attendance", loggedOnly, async (req,res)=>{
  const course_id = req.body.courseId; const lesson_id = req.body.lessonId; const student_name = (req.body.studentName || "").trim();
  if(!student_name || student_name.length < 3) return res.send(errorPage("Digite seu nome completo para registrar presença.", "/cursos.html"));
  await sb("attendance", { method:"POST", body:JSON.stringify({ course_id, lesson_id, student_name, user_email:req.session.user.email }) });
  res.redirect("/cursos.html?presenca=ok");
});
app.get("/api/attendance", adminOnly, async (req,res)=>{ res.set("Cache-Control", "no-store"); res.json(await readAttendance()); });

app.post("/alterar-senha", adminOnly, async (req,res)=>{
  try{
    const { emailAlvo, senhaAtual, novaSenha, confirmarSenha } = req.body;
    const permitido = ["admin@igreja.com","midia@igreja.com","secretaria@igreja.com","membro@igreja.com","pastor@igreja.com"].includes(String(emailAlvo || "").toLowerCase());
    if(!emailAlvo || !senhaAtual || !novaSenha || !confirmarSenha) return res.send(errorPage("Preencha todos os campos.", "/admin.html"));
    if(!permitido) return res.send(errorPage("Usuário não permitido.", "/admin.html"));
    if(novaSenha !== confirmarSenha) return res.send(errorPage("A nova senha e a confirmação não conferem.", "/admin.html"));
    if(String(novaSenha).length < 4) return res.send(errorPage("A nova senha precisa ter pelo menos 4 caracteres.", "/admin.html"));
    const admin = await getUserByEmail("admin@igreja.com");
    if(!admin) return res.send(errorPage("Administrador não encontrado.", "/login.html"));
    const ok = await passwordMatches(senhaAtual, admin.password);
    if(!ok) return res.send(errorPage("Senha atual do admin incorreta.", "/admin.html"));
    const alvo = await getUserByEmail(emailAlvo);
    if(!alvo) return res.send(errorPage("Usuário selecionado não encontrado.", "/admin.html"));
    const hash = await bcrypt.hash(novaSenha, 10);
    await updateUserPassword(emailAlvo, hash);
    req.session.destroy(()=>res.send(successPage("Senha alterada com sucesso!", `A senha do login ${emailAlvo} foi salva no Supabase e não voltará para o padrão.`, "/login.html", "Entrar novamente")));
  }catch(e){ res.send(errorPage("Erro ao alterar senha: " + e.message, "/admin.html")); }
});

function errorPage(msg, link){ return successPage("Atenção", msg, link, "Voltar"); }
function successPage(title,msg,link,btn){ return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="/style.css"><title>${title}</title></head><body><header class="site-header"><div class="topbar"><a class="brand" href="/index.html"><img src="/assets/logo-pedra-angular.png" alt="Igreja Pedra Angular"></a></div></header><main class="container narrow"><div class="panel center"><h1>${title}</h1><p>${msg}</p><a class="btn" href="${link}">${btn}</a></div></main></body></html>`; }

ensureDefaultUsers().catch(e => console.warn("Aviso: não foi possível garantir usuários padrão no Supabase:", e.message)).finally(()=>{
  app.listen(PORT, () => console.log(`Site rodando em http://localhost:${PORT}`));
});

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

const app = express();
const PORT = 3000;
const usersFile = path.join(__dirname, "users.json");
const postsFile = path.join(__dirname, "posts.json");
const coursesFile = path.join(__dirname, "courses.json");
const attendanceFile = path.join(__dirname, "attendance.json");
const mediaDir = path.join(__dirname, "public", "midia");

if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
if (!fs.existsSync(postsFile)) fs.writeFileSync(postsFile, JSON.stringify([], null, 2));
if (!fs.existsSync(coursesFile)) fs.writeFileSync(coursesFile, JSON.stringify([], null, 2));
if (!fs.existsSync(attendanceFile)) fs.writeFileSync(attendanceFile, JSON.stringify([], null, 2));

function defaultUsers(){
  return [
    { id: 1, name: "Pr. Daniel", email: "admin@igreja.com", password: bcrypt.hashSync("123456", 10), role: "admin" },
    { id: 2, name: "Mídia", email: "midia@igreja.com", password: bcrypt.hashSync("123456", 10), role: "media" },
    { id: 3, name: "Secretaria", email: "secretaria@igreja.com", password: bcrypt.hashSync("123456", 10), role: "secretaria" },
    { id: 4, name: "Membro da Igreja", email: "membro@igreja.com", password: bcrypt.hashSync("123456", 10), role: "member" }
  ];
}
function ensureUsers(){
  let users=[];
  try{ users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : []; }catch(e){ users=[]; }
  if(!Array.isArray(users)) users=[];
  const defs = defaultUsers();
  defs.forEach(def => {
    const found = users.find(u => String(u.email).toLowerCase() === def.email);
    if(!found) users.push(def);
  });

  // Garante que os dois logins principais sempre tenham a função correta.
  // Isso corrige o caso do login midia@igreja.com voltar para a página inicial
  // por estar salvo com role antigo/incorreto no users.json.
  users = users.map(u => {
    const email = String(u.email || '').toLowerCase();
    if(email === "admin@igreja.com") return { ...u, name:"Pr. Daniel", role:"admin" };
    if(email === "midia@igreja.com") return { ...u, name:"Mídia", role:"media" };
    if(email === "secretaria@igreja.com") return { ...u, name:"Secretaria", role:"secretaria" };
    if(email === "membro@igreja.com") return { ...u, name:"Membro da Igreja", role:"member" };
    return u;
  });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}
ensureUsers();

function readUsers(){ return JSON.parse(fs.readFileSync(usersFile)); }
function saveUsers(users){ fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); }
function readPosts(){ try { return JSON.parse(fs.readFileSync(postsFile)); } catch(e){ return []; } }
function savePosts(posts){ fs.writeFileSync(postsFile, JSON.stringify(posts, null, 2)); }
function readCourses(){ try { return JSON.parse(fs.readFileSync(coursesFile)); } catch(e){ return []; } }
function saveCourses(courses){ fs.writeFileSync(coursesFile, JSON.stringify(courses, null, 2)); }
function readAttendance(){ try { return JSON.parse(fs.readFileSync(attendanceFile)); } catch(e){ return []; } }
function saveAttendance(records){ fs.writeFileSync(attendanceFile, JSON.stringify(records, null, 2)); }
function findCourseAndLesson(courseId, lessonId){
  const courses = readCourses();
  const course = courses.find(c => Number(c.id) === Number(courseId));
  if(!course) return { courses, course:null, lesson:null };
  const lesson = (course.lessons || []).find(a => Number(a.id) === Number(lessonId));
  return { courses, course, lesson };
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: "igreja-pedra-angular",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // mantém logado por 30 dias ou até clicar em Sair
    httpOnly: true,
    sameSite: "lax"
  }
}));

// CLOUDINARY - dados informados pelo cliente
// Observação: para publicar online depois, o ideal é colocar esses dados em variáveis de ambiente.
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dpohhnsl6";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "813872269517687";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "6_Bpq9EPOQn-TXwlzy6GFMNVSfY";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "pedra-angular";

// Agora o arquivo fica em memória só para enviar ao Cloudinary.
// Não salva mais em public/midia.
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 }, // até 500 MB por arquivo
  fileFilter: (req, file, cb) => {
    const ok = /^(image|video|audio)\//.test(file.mimetype);
    cb(ok ? null : new Error("Tipo de arquivo não permitido."), ok);
  }
});

function cloudinaryResourceType(mimetype){
  if(String(mimetype || "").startsWith("image/")) return "image";
  return "video"; // vídeo e áudio ficam como resource_type video no Cloudinary
}

function cloudinarySignature(params){
  const str = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&") + CLOUDINARY_API_SECRET;
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

    addField("api_key", CLOUDINARY_API_KEY);
    addField("timestamp", timestamp);
    addField("folder", CLOUDINARY_FOLDER);
    addField("signature", signature);

    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${file.originalname || 'arquivo'}"\r\n`));
    chunks.push(Buffer.from(`Content-Type: ${file.mimetype}\r\n\r\n`));
    chunks.push(file.buffer);
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(chunks);

    const options = {
      hostname: "api.cloudinary.com",
      path: `/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": body.length
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data || "{}");
          if(res.statusCode >= 200 && res.statusCode < 300){
            resolve({ ...json, resourceType });
          } else {
            reject(new Error(json.error?.message || "Erro ao enviar para o Cloudinary."));
          }
        } catch(err){
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function deleteFromCloudinary(post){
  if(!post || !post.cloudinaryPublicId) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType = post.cloudinaryResourceType || (post.type === "foto" ? "image" : "video");
  const paramsToSign = { public_id: post.cloudinaryPublicId, timestamp };
  const signature = cloudinarySignature(paramsToSign);
  const form = new FormData();
  form.append("public_id", post.cloudinaryPublicId);
  form.append("api_key", CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`;
  try { await fetch(url, { method: "POST", body: form }); } catch(e) { console.warn("Não foi possível excluir do Cloudinary:", e.message); }
}

function canPublish(req, res, next){
  if (req.session.user && ["admin", "media", "secretaria"].includes(req.session.user.role)) return next();
  res.redirect("/login.html");
}


function loggedOnly(req, res, next){
  if (req.session.user) return next();
  res.redirect("/login.html");
}

function mediaOnly(req, res, next){
  if (req.session.user && req.session.user.role === "media") return next();
  if (req.session.user && req.session.user.role === "admin") return res.redirect("/admin.html");
  res.redirect("/login.html");
}
function adminOnly(req, res, next){
  if (req.session.user && req.session.user.role === "admin") return next();
  res.redirect("/login.html");
}
function secretariaOnly(req, res, next){
  if (req.session.user && req.session.user.role === "secretaria") return next();
  if (req.session.user && req.session.user.role === "admin") return res.redirect("/admin.html");
  if (req.session.user && req.session.user.role === "media") return res.redirect("/area-midia.html");
  res.redirect("/login.html");
}

app.get("/midias.html", (req,res)=>res.redirect("/midia.html"));
app.get("/area-midia.html", mediaOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "area-midia.html")));
app.get("/area-secretaria.html", secretariaOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "area-secretaria.html")));
app.get("/admin.html", adminOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/presencas.html", adminOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "presencas.html")));
app.get("/cursos.html", loggedOnly, (req,res)=>res.sendFile(path.join(__dirname, "public", "cursos.html")));

app.use(express.static(path.join(__dirname, "public")));

app.post("/register", (req, res) => res.send("Cadastro desativado. Use o login de administrador ou mídia."));

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = readUsers().find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
  if (!user) return res.send(errorPage("Usuário não encontrado.", "/login.html"));
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.send(errorPage("Senha incorreta.", "/login.html"));
  req.session.user = { id:user.id, name:user.name, email:user.email, role:user.role };
  req.session.save(() => {
    res.redirect(user.role === 'admin' ? '/admin.html' : user.role === 'secretaria' ? '/area-secretaria.html' : user.role === 'media' ? '/area-midia.html' : '/cursos.html');
  });
});

app.get("/api/me", (req,res)=>{
  res.set("Cache-Control", "no-store");
  res.json(req.session.user ? { logged:true, user:req.session.user } : { logged:false });
});

app.get("/login.html", (req,res)=>{
  if(req.session.user){
    return res.redirect(req.session.user.role === "admin" ? "/admin.html" : req.session.user.role === "secretaria" ? "/area-secretaria.html" : req.session.user.role === "media" ? "/area-midia.html" : "/cursos.html");
  }
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/logout", (req,res)=> req.session.destroy(()=>res.redirect("/login.html")) );

app.post("/upload", canPublish, upload.single("media"), async (req, res) => {
  const back = req.session.user.role === "admin" ? "/admin.html" : req.session.user.role === "secretaria" ? "/area-secretaria.html" : "/area-midia.html";
  try{
    if(!req.file) return res.send(errorPage("Selecione uma imagem, vídeo ou áudio.", back));

    let type = "foto";
    if(req.file.mimetype.startsWith("video/")) type = "video";
    if(req.file.mimetype.startsWith("audio/")) type = "audio";

    const cloudinaryFile = await uploadToCloudinary(req.file);

    const isAdmin = req.session.user.role === "admin";
    const isSecretaria = req.session.user.role === "secretaria";
    const posts = readPosts();
    const author = isAdmin ? "Pr. Daniel" : isSecretaria ? "Secretaria" : "Mídia";
    const category = isAdmin ? "admin" : isSecretaria ? "secretaria" : "media";
    posts.unshift({
      id: Date.now(),
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
      category,
      createdAt: new Date().toISOString()
    });
    savePosts(posts);
    req.session.save(() => {
      res.redirect(isAdmin ? '/estudos-pr-daniel.html' : isSecretaria ? '/publicacoes.html' : '/midia.html');
    });
  }catch(e){
    return res.status(400).send(errorPage(e.message || "Erro ao enviar arquivo para o Cloudinary.", back));
  }
});

app.use((err, req, res, next) => {
  if (err) {
    const role = req.session && req.session.user ? req.session.user.role : null;
    const back = role === "admin" ? "/admin.html" : role === "secretaria" ? "/area-secretaria.html" : role === "media" ? "/area-midia.html" : "/login.html";
    return res.status(400).send(errorPage(err.message || "Erro ao enviar arquivo.", back));
  }
  next();
});

app.get("/api/posts", (req,res)=>{
  res.set("Cache-Control", "no-store");
  res.json(readPosts());
});

function canManagePost(user, post){
  if(!user || !post) return false;
  if(user.role === "admin") return true;
  // A mídia só pode editar/excluir publicações feitas pelo próprio login da mídia.
  if(user.role === "media") return post.category === "media" || post.author === "Mídia";
  if(user.role === "secretaria") return post.category === "secretaria" || post.author === "Secretaria";
  return false;
}

app.post("/delete-post/:id", canPublish, async (req,res)=>{
  const id=Number(req.params.id);
  const posts=readPosts();
  const post=posts.find(p=>Number(p.id)===id);
  const back = req.session.user.role === "media" ? "/area-midia.html" : req.session.user.role === "secretaria" ? "/area-secretaria.html" : "/admin.html";

  if(!canManagePost(req.session.user, post)){
    return res.status(403).send(errorPage("Você não tem permissão para excluir esta publicação.", back));
  }

  if(post && post.cloudinaryPublicId){
    await deleteFromCloudinary(post);
  } else if(post && post.file && !String(post.file).startsWith("http")){
    const filePath=path.join(mediaDir, post.file);
    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  savePosts(posts.filter(p=>Number(p.id)!==id));
  res.redirect(back);
});

app.post("/edit-post/:id", canPublish, (req,res)=>{
  const id=Number(req.params.id);
  const posts=readPosts();
  const post=posts.find(p=>Number(p.id)===id);
  const back = req.session.user.role === "media" ? "/area-midia.html" : req.session.user.role === "secretaria" ? "/area-secretaria.html" : "/admin.html";

  if(!canManagePost(req.session.user, post)){
    return res.status(403).send(errorPage("Você não tem permissão para alterar esta publicação.", back));
  }

  post.title = (req.body.title || "").trim() || post.title || "Publicação";
  post.description = (req.body.description || "").trim();
  post.updatedAt = new Date().toISOString();
  savePosts(posts);
  res.redirect(back);
});


app.get("/api/courses", loggedOnly, (req,res)=>{
  res.set("Cache-Control", "no-store");
  res.json(readCourses());
});

app.post("/course", adminOnly, (req,res)=>{
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim();
  if(!title) return res.send(errorPage("Digite o título do curso.", "/admin.html"));
  const courses = readCourses();
  courses.unshift({
    id: Date.now(),
    title, description,
    lessons: [],
    createdAt: new Date().toISOString()
  });
  saveCourses(courses);
  res.redirect("/admin.html");
});


app.post("/lesson", adminOnly, (req,res)=>{
  const courseId = Number(req.body.courseId);
  const lessonTitle = (req.body.lessonTitle || "").trim();
  const lessonDescription = (req.body.lessonDescription || "").trim();
  const videoUrl = (req.body.videoUrl || "").trim();
  const materialUrl = (req.body.materialUrl || "").trim();
  if(!courseId) return res.send(errorPage("Selecione o curso da aula.", "/admin.html"));
  if(!lessonTitle) return res.send(errorPage("Digite o título da aula.", "/admin.html"));
  const courses = readCourses();
  const course = courses.find(c => Number(c.id) === courseId);
  if(!course) return res.send(errorPage("Curso não encontrado.", "/admin.html"));
  if(!Array.isArray(course.lessons)) course.lessons = [];
  course.lessons.push({
    id: Date.now(),
    title: lessonTitle,
    description: lessonDescription,
    videoUrl,
    materialUrl,
    createdAt: new Date().toISOString()
  });
  saveCourses(courses);
  res.redirect("/admin.html");
});

app.post("/course/:id/lesson", adminOnly, (req,res)=>{
  const courseId = Number(req.params.id);
  const lessonTitle = (req.body.lessonTitle || "").trim();
  const lessonDescription = (req.body.lessonDescription || "").trim();
  const videoUrl = (req.body.videoUrl || "").trim();
  const materialUrl = (req.body.materialUrl || "").trim();
  if(!lessonTitle) return res.send(errorPage("Digite o título da aula.", "/admin.html"));
  const courses = readCourses();
  const course = courses.find(c => Number(c.id) === courseId);
  if(!course) return res.send(errorPage("Curso não encontrado.", "/admin.html"));
  if(!Array.isArray(course.lessons)) course.lessons = [];
  course.lessons.push({
    id: Date.now(),
    title: lessonTitle,
    description: lessonDescription,
    videoUrl,
    materialUrl,
    createdAt: new Date().toISOString()
  });
  saveCourses(courses);
  res.redirect("/admin.html");
});

app.post("/delete-lesson/:courseId/:lessonId", adminOnly, (req,res)=>{
  const courseId = Number(req.params.courseId);
  const lessonId = Number(req.params.lessonId);
  const courses = readCourses();
  const course = courses.find(c => Number(c.id) === courseId);
  if(course && Array.isArray(course.lessons)){
    course.lessons = course.lessons.filter(a => Number(a.id) !== lessonId);
    saveCourses(courses);
  }
  res.redirect("/admin.html");
});

app.post("/delete-course/:id", adminOnly, (req,res)=>{
  const id = Number(req.params.id);
  saveCourses(readCourses().filter(c => Number(c.id) !== id));
  saveAttendance(readAttendance().filter(r => Number(r.courseId) !== id));
  res.redirect("/admin.html");
});

app.post("/attendance", loggedOnly, (req,res)=>{
  const courseId = Number(req.body.courseId);
  const lessonId = Number(req.body.lessonId);
  const studentName = (req.body.studentName || "").trim();
  if(!studentName || studentName.length < 3) return res.send(errorPage("Digite seu nome completo para registrar presença.", "/cursos.html"));
  const { course, lesson } = findCourseAndLesson(courseId, lessonId);
  if(!course || !lesson) return res.send(errorPage("Curso ou aula não encontrado.", "/cursos.html"));
  const records = readAttendance();
  records.unshift({
    id: Date.now(),
    courseId, lessonId,
    courseTitle: course.title,
    lessonTitle: lesson.title,
    studentName,
    userEmail: req.session.user.email,
    createdAt: new Date().toISOString()
  });
  saveAttendance(records);
  res.redirect("/cursos.html?presenca=ok");
});

app.get("/api/attendance", adminOnly, (req,res)=>{
  res.set("Cache-Control", "no-store");
  res.json(readAttendance());
});

app.post("/alterar-senha", adminOnly, async (req,res)=>{
  const { emailAlvo, senhaAtual, novaSenha, confirmarSenha } = req.body;
  const alvoPermitido = ["admin@igreja.com", "midia@igreja.com", "secretaria@igreja.com", "membro@igreja.com"].includes(String(emailAlvo || "").toLowerCase());

  if(!emailAlvo || !senhaAtual || !novaSenha || !confirmarSenha) {
    return res.send(errorPage("Preencha todos os campos.", "/admin.html"));
  }
  if(!alvoPermitido) {
    return res.send(errorPage("Você só pode alterar a senha do admin, da mídia, da secretaria ou do acesso de membros.", "/admin.html"));
  }
  if(novaSenha !== confirmarSenha) {
    return res.send(errorPage("A nova senha e a confirmação não conferem.", "/admin.html"));
  }
  if(String(novaSenha).length < 4) {
    return res.send(errorPage("A nova senha precisa ter pelo menos 4 caracteres.", "/admin.html"));
  }

  const users=readUsers();
  const admin=users.find(u=>String(u.email).toLowerCase()==="admin@igreja.com");
  if(!admin) return res.send(errorPage("Administrador não encontrado.", "/login.html"));

  const ok=await bcrypt.compare(senhaAtual, admin.password);
  if(!ok) return res.send(errorPage("Senha atual do admin incorreta.", "/admin.html"));

  const usuarioAlvo=users.find(u=>String(u.email).toLowerCase()===String(emailAlvo).toLowerCase());
  if(!usuarioAlvo) return res.send(errorPage("Usuário selecionado não encontrado.", "/admin.html"));

  usuarioAlvo.password=await bcrypt.hash(novaSenha,10);
  saveUsers(users);

  const emailNormalizado = String(emailAlvo).toLowerCase();
  const nomeAlvo = emailNormalizado === "admin@igreja.com" ? "admin" : emailNormalizado === "secretaria@igreja.com" ? "secretaria" : emailNormalizado === "membro@igreja.com" ? "membro" : "mídia";
  req.session.destroy(()=>res.send(successPage("Senha alterada com sucesso!", `A senha do login ${nomeAlvo} foi alterada. Faça login novamente.`, "/login.html", "Entrar novamente")));
});

function errorPage(msg, link){ return successPage("Atenção", msg, link, "Voltar"); }
function successPage(title,msg,link,btn){ return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="/style.css"><title>${title}</title></head><body><header class="site-header"><div class="topbar"><a class="brand" href="/index.html"><img src="/assets/logo-pedra-angular.png" alt="Igreja Pedra Angular"></a></div></header><main class="container narrow"><div class="panel center"><h1>${title}</h1><p>${msg}</p><a class="btn" href="${link}">${btn}</a></div></main></body></html>`; }

app.listen(PORT, () => console.log(`Site rodando em http://localhost:${PORT}`));

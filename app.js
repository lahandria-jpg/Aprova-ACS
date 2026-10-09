(() => {
  "use strict";
  const DATA_PATHS = {
    portugues: "./src/data/portugues.json",
    especificos: "./src/data/conhecimentos-especificos.json",
    simulados: "./src/data/simulados.json",
    flashcards: "./src/data/flashcards.json"
  };
  const STORAGE_KEY = "aprovacs-progress-v1";
  const APP_VERSION = "3";
  const defaultState = () => ({completedLessons:[], answers:[], seenCards:[], cardRatings:{}, theme:"dark"});
  let state = loadState(), subjects = [], questions = [], flashcards = [];
  let currentQuiz = [], quizIndex = 0, quizAnswers = [], currentCard = null, cardFlipped = false;
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function loadState() {
    try { return {...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")}; }
    catch { return defaultState(); }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { toast("Não foi possível salvar neste navegador."); }
    renderStats();
  }
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
  }
  async function fetchJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
    return response.json();
  }
  async function init() {
    try {
      const [pt, esp, sim, fc] = await Promise.all(Object.values(DATA_PATHS).map(fetchJSON));
      subjects = [pt, esp]; questions = sim; flashcards = fc;
      renderLessons(); renderFlashcard(); renderStats(); updateCountdown();
      setInterval(updateCountdown, 60000);
      applyTheme();
      if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
        // O caminho relativo funciona também em projetos GitHub Pages publicados em subdiretório.
        navigator.serviceWorker.register("./service-worker.js?v=3", { updateViaCache: "none" }).catch(() => {});
      }
    } catch (error) {
      console.error(error);
      $("lesson-subjects").innerHTML = '<div class="panel-card">Não foi possível carregar os conteúdos. Abra o app por um servidor local ou GitHub Pages; não use file://.</div>';
      toast("Erro ao carregar os dados do aplicativo.");
    }
  }
  function updateCountdown() {
    const target = new Date("2027-01-24T08:00:00-03:00").getTime(), diff = Math.max(0, target - Date.now());
    $("days").textContent = Math.floor(diff / 86400000);
    $("hours").textContent = Math.floor(diff % 86400000 / 3600000);
    $("minutes").textContent = Math.floor(diff % 3600000 / 60000);
  }
  function goTab(tab) {
    document.querySelectorAll(".tab-panel").forEach(el => el.classList.toggle("active", el.id === `tab-${tab}`));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.tab === tab));
    window.scrollTo({top:0,behavior:"smooth"});
    if (tab === "desempenho") renderPerformance();
  }
  function renderLessons() {
    const root = $("lesson-subjects");
    root.innerHTML = subjects.map(subject => {
      const all = subject.aulas.length, done = subject.aulas.filter(a => state.completedLessons.includes(a.id)).length;
      return `<article class="subject-card"><div class="subject-card-head"><div class="subject-emoji">${safe(subject.icone)}</div><div><h3>${safe(subject.titulo)}</h3><p>${all} aulas · ${done} concluídas</p></div></div><div class="progress-track"><span style="width:${all ? done/all*100 : 0}%"></span></div><div class="lesson-list">${subject.aulas.map((lesson,i) => {
        const completed = state.completedLessons.includes(lesson.id);
        return `<button class="lesson-row ${completed ? "done" : ""}" data-lesson="${safe(lesson.id)}"><span class="lesson-number">${completed ? "✓" : String(i+1).padStart(2,"0")}</span><span class="lesson-meta"><strong>${safe(lesson.titulo)}</strong><small>${safe(lesson.duracao)} · ${lesson.topicos.length} tópicos</small></span><span class="arrow">›</span></button>`;
      }).join("")}</div></article>`;
    }).join("");
    root.querySelectorAll("[data-lesson]").forEach(btn => btn.addEventListener("click", () => openLesson(btn.dataset.lesson)));
  }
  function findLesson(id) {
    for (const subject of subjects) { const lesson = subject.aulas.find(a => a.id === id); if (lesson) return {subject,lesson}; }
    return null;
  }
  function openLesson(id) {
    const found = findLesson(id); if (!found) return;
    const {subject,lesson} = found, done = state.completedLessons.includes(id);
    const reader = $("lesson-reader");
    reader.classList.remove("hidden");
    reader.innerHTML = `<button class="text-btn" id="back-lessons">← Voltar às trilhas</button><p class="eyebrow">${safe(subject.titulo)}</p><h3>${safe(lesson.titulo)}</h3><p class="small-muted">${safe(lesson.duracao)} de leitura · ${lesson.topicos.length} tópicos</p>${lesson.topicos.map((topic,i)=>`<h4>${i+1}. ${safe(topic.titulo)}</h4><p>${safe(topic.conteudo)}</p>`).join("")}<div class="lesson-actions"><button class="primary-btn" id="complete-lesson">${done ? "✓ Aula concluída" : "Marcar como concluída"}</button><button class="secondary-btn" id="back-lessons-2">Voltar</button></div>`;
    reader.scrollIntoView({behavior:"smooth",block:"start"});
    const back = () => {reader.classList.add("hidden"); renderLessons();};
    $("back-lessons").addEventListener("click",back); $("back-lessons-2").addEventListener("click",back);
    $("complete-lesson").addEventListener("click", () => {
      if (state.completedLessons.includes(id)) state.completedLessons = state.completedLessons.filter(x=>x!==id);
      else state.completedLessons.push(id);
      saveState(); renderLessons(); openLesson(id); toast(state.completedLessons.includes(id) ? "Aula marcada como concluída!" : "Conclusão desmarcada.");
    });
  }
  function renderStats() {
    const totalLessons = subjects.reduce((sum,s)=>sum+s.aulas.length,0);
    $("lessons-done").textContent = state.completedLessons.length;
    $("lessons-total").textContent = `de ${totalLessons} aulas`;
    const correct = state.answers.filter(a=>a.correct).length, answered = state.answers.length;
    const rate = answered ? Math.round(correct/answered*100) : 0;
    $("accuracy").textContent = `${rate}%`; $("cards-seen").textContent = state.seenCards.length;
    $("streak-label").textContent = state.completedLessons.length ? "Você está avançando" : "Vamos começar";
    $("performance-accuracy").textContent = `${rate}%`; $("accuracy-bar").style.width = `${rate}%`;
    $("questions-answered").textContent = answered; $("correct-answers").textContent = correct;
    $("answer-summary").textContent = answered ? `${correct} acertos em ${answered} respostas registradas.` : "Nenhuma questão respondida ainda.";
  }
  function renderPerformance() {
    renderStats();
    const areaNames = {portugues:"Língua Portuguesa",especificos:"Conhecimentos Específicos"};
    $("subject-performance").innerHTML = Object.keys(areaNames).map(area=>{
      const answers = state.answers.filter(a=>a.area===area), correct = answers.filter(a=>a.correct).length, rate = answers.length ? Math.round(correct/answers.length*100) : 0;
      return `<div class="performance-row"><div class="performance-row-head"><span>${areaNames[area]}</span><span>${rate}% · ${correct}/${answers.length}</span></div><div class="progress-track"><span style="width:${rate}%"></span></div></div>`;
    }).join("");
  }
  function startQuiz() {
    const subject = $("quiz-subject").value, countValue = $("quiz-count").value;
    let pool = questions.filter(q=>subject==="all" || q.area===subject);
    pool = pool.sort(()=>Math.random()-.5);
    const count = countValue==="all" ? pool.length : Math.min(Number(countValue),pool.length);
    currentQuiz = pool.slice(0,count); quizIndex=0; quizAnswers=[];
    if (!currentQuiz.length) {toast("Não há questões nesta seleção.");return;}
    $("quiz-setup").classList.add("hidden"); $("quiz-area").classList.remove("hidden"); renderQuestion();
  }
  function renderQuestion() {
    const q = currentQuiz[quizIndex], existing = quizAnswers[quizIndex];
    const areaName = q.area==="portugues" ? "Língua Portuguesa" : "Conhecimentos Específicos";
    $("quiz-area").innerHTML = `<div class="quiz-top"><span>QUESTÃO ${quizIndex+1} DE ${currentQuiz.length}</span><strong>${Math.round(quizIndex/currentQuiz.length*100)}% concluído</strong></div><p class="eyebrow">${areaName}</p><h3>${safe(q.pergunta)}</h3><div class="option-list">${q.opcoes.map((option,i)=>`<button class="option-btn ${existing ? (i===q.correta?"correct":i===existing.choice?"incorrect":"") : ""} ${existing && i===existing.choice ? "selected" : ""}" data-option="${i}" ${existing?"disabled":""}><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${safe(option)}</span></button>`).join("")}</div>${existing ? `<div class="explanation"><strong>${existing.correct?"Resposta correta!":"Resposta incorreta."}</strong><br>Gabarito: ${String.fromCharCode(65+q.correta)}. ${safe(q.comentario)}</div><div class="quiz-controls"><button id="next-question" class="primary-btn">${quizIndex===currentQuiz.length-1?"Ver resultado":"Próxima questão →"}</button></div>` : ""}`;
    if (!existing) $("quiz-area").querySelectorAll("[data-option]").forEach(btn=>btn.addEventListener("click",()=>answerQuestion(Number(btn.dataset.option))));
    else $("next-question").addEventListener("click",()=>{if(quizIndex<currentQuiz.length-1){quizIndex++;renderQuestion();}else finishQuiz();});
  }
  function answerQuestion(choice) {
    const q=currentQuiz[quizIndex], correct=choice===q.correta;
    quizAnswers[quizIndex]={choice,correct};
    state.answers.push({questionId:q.id,area:q.area,choice,correct,at:Date.now()}); saveState(); renderQuestion();
  }
  function finishQuiz() {
    const correct=quizAnswers.filter(a=>a.correct).length, total=quizAnswers.length, score=Math.round(correct/total*100);
    $("quiz-area").innerHTML=`<div class="result-card"><p class="eyebrow">SIMULADO FINALIZADO</p><div class="result-score">${score}%</div><h3>${score>=80?"Excelente evolução!":score>=60?"Bom trabalho!":"Continue praticando!"}</h3><p>Você acertou ${correct} de ${total} questões.<br>${score>=80?"Revise os detalhes para consolidar o conteúdo.":"Releia os comentários das questões e retome as aulas com mais dificuldade."}</p><button id="new-quiz" class="primary-btn">Fazer outro simulado</button><br><button id="review-performance" class="text-btn">Ver meu desempenho</button></div>`;
    $("new-quiz").addEventListener("click",resetQuiz); $("review-performance").addEventListener("click",()=>{resetQuiz(false);goTab("desempenho");});
  }
  function resetQuiz(showSetup=true) {
    $("quiz-area").classList.add("hidden"); $("quiz-area").innerHTML=""; $("quiz-setup").classList.toggle("hidden",!showSetup);
    if (!showSetup) $("quiz-setup").classList.remove("hidden");
  }
  function pickNextCard() {
    const now=Date.now();
    const due=flashcards.filter(card=>{
      const r=state.cardRatings[card.id]; return !r || !r.nextReview || r.nextReview<=now;
    });
    const pool=due.length?due:flashcards;
    currentCard=pool[Math.floor(Math.random()*pool.length)]||null; cardFlipped=false; drawCard();
  }
  function drawCard() {
    const button=$("flashcard");
    if (!currentCard) { $("flashcard-text").textContent="Nenhum cartão disponível.";return; }
    $("flashcard-position").textContent=`Cartões estudados: ${state.seenCards.length} de ${flashcards.length}`;
    $("flashcard-due").textContent=state.cardRatings[currentCard.id] ? "Revisão personalizada" : "Novo cartão";
    $("flashcard-label").textContent=cardFlipped?"RESPOSTA":"PERGUNTA";
    $("flashcard-text").textContent=cardFlipped?currentCard.resposta:currentCard.pergunta;
    button.setAttribute("aria-label",cardFlipped?"Cartão virado; toque para ver a pergunta":"Toque para revelar a resposta");
  }
  function renderFlashcard(){pickNextCard();}
  function flipCard() { if (!currentCard)return; cardFlipped=!cardFlipped; if (!state.seenCards.includes(currentCard.id)) state.seenCards.push(currentCard.id); saveState(); drawCard(); }
  function rateCard(easy) {
    if (!currentCard) return;
    const previous=state.cardRatings[currentCard.id]||{interval:0};
    const interval=easy ? Math.max(1,previous.interval ? previous.interval*2 : 1) : 0;
    state.cardRatings[currentCard.id]={interval,lastReviewed:Date.now(),nextReview:Date.now()+interval*86400000,rating:easy?"easy":"hard"};
    saveState(); pickNextCard(); toast(easy?"Cartão programado para revisão futura.":"Este cartão voltará em breve.");
  }
  function applyTheme(){document.body.classList.toggle("light-mode",state.theme==="light");}
  function toggleTheme(){state.theme=state.theme==="light"?"dark":"light";saveState();applyTheme();}
  function bindEvents() {
    document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>goTab(btn.dataset.tab)));
    document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>goTab(btn.dataset.go)));
    $("start-quiz").addEventListener("click",startQuiz);
    $("flashcard").addEventListener("click",flipCard);
    $("card-easy").addEventListener("click",()=>rateCard(true));
    $("card-hard").addEventListener("click",()=>rateCard(false));
    $("card-next").addEventListener("click",pickNextCard);
    $("theme-toggle").addEventListener("click",toggleTheme);
    $("reset-progress").addEventListener("click",()=>{
      if(confirm("Tem certeza de que deseja apagar todo o progresso salvo neste dispositivo?")) {
        state=defaultState(); saveState(); renderLessons(); renderFlashcard(); renderPerformance(); applyTheme(); toast("Progresso apagado.");
      }
    });
  }
  // Delegação global: mantém navegação e ações responsivas mesmo após renderizações dinâmicas.
  document.addEventListener("click", event => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.tab) { event.preventDefault(); goTab(target.dataset.tab); }
    else if (target.dataset.go) { event.preventDefault(); goTab(target.dataset.go); }
  }, true);

  // Exibe erros de execução no próprio aplicativo em vez de deixar a tela aparentemente congelada.
  window.addEventListener("error", event => {
    console.error("AprovACS:", event.error || event.message);
    const toastEl = $("toast");
    if (toastEl) {
      toastEl.textContent = "Ocorreu um erro. Atualize a página; se continuar, limpe o cache do site.";
      toastEl.classList.add("show");
    }
  });

  bindEvents(); init();
})();
/* Quiz Engine — ทำตามเรื่อง + สุ่มตัวเลือก 4 ตัว */
(function(){
  const BANK = window.QUIZ_BANK.slice();

  const els = {
    qIndex:  document.getElementById('qIndex'),
    qTotal:  document.getElementById('qTotal'),
    score:   document.getElementById('score'),
    question:document.getElementById('question'),
    choices: document.getElementById('choices'),
    feedback:document.getElementById('feedback'),
    nextBtn: document.getElementById('nextBtn'),
    revealBtn: document.getElementById('revealBtn'),
    retryBtn:  document.getElementById('retryBtn'),
    newSetBtn: document.getElementById('newSetBtn'),
    numQuestions: document.getElementById('numQuestions'),
    topicLabel: document.getElementById('topicLabel'),
  };

  const topicBtns = Array.from(document.querySelectorAll('.topic-btn'));

  let topic = 'all';
  let pool = [];     // ธนาคารหลังกรองตาม topic
  let set = [];      // ชุดข้อสอบที่สุ่มมา
  let i = 0;
  let score = 0;
  let answered = false;

  const randInt = n => Math.floor(Math.random()*n);
  const shuffle = arr => { for(let k=arr.length-1;k>0;k--){ const j=randInt(k+1); [arr[k],arr[j]]=[arr[j],arr[k]]; } return arr; };
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));

  function filterByTopic(tp){
    if(tp==='all') return BANK.slice();
    return BANK.filter(x => x.tag === tp);
  }

  function buildSet(){
    pool = filterByTopic(topic);
    if(pool.length === 0){
      // ถ้าเลือกเรื่องที่ยังไม่มีคำถาม ให้fallbackเป็นทั้งหมด
      pool = BANK.slice();
      topic = 'all';
    }
    const n = clamp(parseInt(els.numQuestions.value||10,10), 5, Math.min(50, pool.length));
    const idxs = shuffle([...Array(pool.length).keys()]).slice(0, n);
    set = idxs.map(k => pool[k]);
    i = 0; score = 0;
    render();
  }

  function render(){
    els.qTotal.textContent = set.length.toString();
    els.qIndex.textContent = (i+1).toString();
    els.score.textContent = score.toString();
    els.feedback.textContent = '';
    els.retryBtn.classList.add('hidden');
    els.nextBtn.disabled = true;
    els.topicLabel.textContent = (topic==='all' ? 'ทั้งหมด' : topic);

    const item = set[i];
    els.question.textContent = item.q;

    // distractors: ดึงจาก "คำตอบของข้ออื่น" ใน pool เดียวกันก่อน ถ้าไม่พอค่อยเติมจาก BANK
    const sameTopicAnswers = filterByTopic(topic==='all' ? item.tag : topic)
      .filter(x => x !== item).map(x => x.a);
    const extraAnswers = BANK.filter(x => x !== item && x.tag !== (topic==='all'? item.tag : topic)).map(x => x.a);

    const choices = [ item.a ];
    shuffle(sameTopicAnswers);
    while(choices.length < 4 && sameTopicAnswers.length){
      const pick = sameTopicAnswers.shift();
      if(!choices.includes(pick)) choices.push(pick);
    }
    shuffle(extraAnswers);
    while(choices.length < 4 && extraAnswers.length){
      const pick = extraAnswers.shift();
      if(!choices.includes(pick)) choices.push(pick);
    }
    shuffle(choices);

    els.choices.innerHTML = '';
    choices.forEach(text=>{
      const li = document.createElement('li');
      li.className = "choice rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-700/60 px-4 py-3";
      li.textContent = text;
      li.addEventListener('click', () => onPick(li, text, item.a));
      els.choices.appendChild(li);
    });
  }

  function onPick(el, picked, correct){
    if(answered) return;
    answered = true;

    [...els.choices.children].forEach(li=>{
      if(li.textContent === correct) li.classList.add('correct','ring','ring-emerald-400');
      if(li.textContent === picked && picked !== correct) li.classList.add('wrong','ring','ring-red-400');
      li.classList.add('pointer-events-none');
    });

    if(picked === correct){
      score++;
      els.feedback.innerHTML = `<span class="text-emerald-400">ถูกต้อง!</span>`;
    }else{
      els.feedback.innerHTML = `<span class="text-red-400">ผิด</span> คำตอบที่ถูก: <span class="underline decoration-dotted">${correct}</span>`;
    }
    els.score.textContent = score.toString();
    els.nextBtn.disabled = false;

    if(i === set.length-1){
      els.retryBtn.classList.remove('hidden');
    }
  }

  function next(){
    if(i < set.length-1){
      i++; answered=false; render();
    }
  }

  function reveal(){
    if(answered) return;
    const correct = set[i].a;
    [...els.choices.children].forEach(li=>{
      if(li.textContent === correct) li.classList.add('correct','ring','ring-emerald-400');
      li.classList.add('pointer-events-none');
    });
    els.feedback.innerHTML = `เฉลย: <span class="underline">${correct}</span>`;
    els.nextBtn.disabled = false;
    answered = true;
  }

  // Events
  document.getElementById('nextBtn').addEventListener('click', next);
  document.getElementById('revealBtn').addEventListener('click', reveal);
  document.getElementById('retryBtn').addEventListener('click', buildSet);
  document.getElementById('newSetBtn').addEventListener('click', buildSet);

  window.addEventListener('keydown', e=>{
    if(e.key==='ArrowRight') next();
    else if(e.key===' '){ e.preventDefault(); reveal(); }
  });

  topicBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      topicBtns.forEach(b=>b.classList.remove('ring','ring-indigo-400'));
      btn.classList.add('ring','ring-indigo-400');
      topic = btn.dataset.topic;
      buildSet();
    });
  });

  // init: เลือก "ทั้งหมด"
  topicBtns.find(b=>b.dataset.topic==='all').classList.add('ring','ring-indigo-400');
  buildSet();
})();

/* Quiz Engine — Similar Distractors + Topic filter + Explanations + Safe compare */
(function(){
  const BANK = (window.QUIZ_BANK || []).slice();

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

  // อธิบายเริ่มต้นตามหมวด (ใช้เมื่อไม่มี exp ในข้อ)
  const defaultExp = {
    ESP32:"สรุปสเปก/โหมดพลังงาน ESP32",
    Calibration:"คาลิเบรตเพื่อลดอคติ/ออฟเซ็ตและปรับสเกลให้ตรงมาตรฐาน",
    Voltage:"ตัวแบ่งแรงดัน (R1/R2) + ADC; คูณ divider gain เพื่อหา Vin",
    Current:"ACS712 ต้องลบ offset ก่อน แล้วหารด้วยความไว",
    MQ135:"ใช้ Rs/Ro + กราฟ log-log ใน datasheet เพื่อหา PPM",
    LoadCell:"Strain gauge + HX711 ขยาย ก่อนคาลิเบรตเชิงเส้น",
    MAX30100:"หา IBI → BPM = 60000/Δt; smoothing/threshold",
    KType:"Thermocouple ต้องชดเชย cold-junction (MAX6675)",
    DS18B20:"โพรบดิจิทัล 1-Wire ช่วงกว้าง ความละเอียดสูง",
    Inductive:"eddy current ในโลหะทำให้แอมพลิจูดลด",
    Comm:"HTTP = Request/Response; MQTT = Pub/Sub ผ่าน Broker",
    WiFi:"Throughput < Data rate เพราะ overhead/ชน; ช่อง 1/6/11",
    BLE:"พลังงานต่ำ ส่งเป็นช่วง; ช่องโฆษณา 37/38/39",
    LoRa:"LoRa=PHY; LoRaWAN=MAC/Network (Class A ประหยัดสุด)",
    Zigbee:"Mesh self-forming/self-healing 2.4 GHz",
    NBIoT:"LPWAN เครือข่ายมือถือ มี PSM/eDRX",
  };

  // ---------- Helpers ----------
  const ri = n => Math.floor(Math.random()*n);
  const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=ri(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const filterByTopic = tp => tp==='all' ? BANK.slice() : BANK.filter(x=>x.tag===tp);

  // normalize: ลด noise การเทียบสตริง
  const normalize = (s) => (s ?? "")
    .replace(/\u00A0/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();

  // ตัดคำคร่าว ๆ (ไทย/อังกฤษ)
  const STOP = new Set(["the","a","an","and","or","of","to","is","are","กับ","และ","หรือ","คือ","ที่","ใน","เป็น"]);
  function tokenize(str){
    const clean = normalize(str).replace(/[^\p{L}\p{N}\s\.\/\-\+\=]/gu,' ');
    const bySpace = clean.split(/\s+/).filter(Boolean).filter(w=>!STOP.has(w));
    // bigram อักขระ (ช่วยภาษาไทยไม่มีเว้นวรรค)
    const chars = clean.replace(/\s+/g,'');
    const bigrams = [];
    for(let i=0;i<chars.length-1;i++) bigrams.push(chars.slice(i,i+2));
    return {words:new Set(bySpace), bigrams:new Set(bigrams)};
  }

  // Jaccard ของชุดคำ
  const jaccard = (A,B) => {
    if(!A.size && !B.size) return 0;
    let inter=0; A.forEach(x=>{ if(B.has(x)) inter++; });
    const uni = A.size + B.size - inter;
    return inter/uni;
  };
  // Dice ของชุด bigram
  const dice = (A,B) => {
    if(!A.size && !B.size) return 0;
    let inter=0; A.forEach(x=>{ if(B.has(x)) inter++; });
    return (2*inter)/(A.size+B.size);
  };

  // คะแนนความคล้ายรวม (ปรับน้ำหนักได้)
  function similarScore(a,b){
    const ta = tokenize(a), tb = tokenize(b);
    const jw = jaccard(ta.words, tb.words);
    const dc = dice(ta.bigrams, tb.bigrams);
    // น้ำหนัก: ให้ bigram เด่นขึ้นสำหรับไทย
    return 0.4*jw + 0.6*dc;
  }

  // สร้างตัวเลือกหลอกแบบ "คล้ายกัน"
  function buildSimilarDistractors(correct, poolAnswers, k){
    const normCorrect = normalize(correct);
    // ตัดคำตอบที่เหมือนเดิมจริง ๆ
    const candidates = poolAnswers.filter(t => normalize(t) !== normCorrect);
    // ให้คะแนนความคล้าย แล้วเลือก Top-k
    const scored = candidates.map(t => ({t, s: similarScore(correct, t)}));
    scored.sort((a,b)=> b.s - a.s);
    const picks = [];
    for(const {t} of scored){
      if(picks.length>=k) break;
      // กันซ้ำแบบ normalize
      if(!picks.some(x=>normalize(x)===normalize(t))){
        picks.push(t);
      }
    }
    return picks;
  }

  function explanationOf(item){
    if (item.exp && item.exp.trim().length) return item.exp;
    return defaultExp[item.tag] || "แนวคิดหลักตามหัวข้อ";
  }
  function showExplain(html){ els.feedback.innerHTML = `<div class="explain">${html}</div>`; }

  // ---------- State ----------
  let topic = 'all';
  let pool = [];
  let set = [];
  let idx = 0;
  let score = 0;
  let answered = false;

  function buildSet(){
    answered = false; score = 0; idx = 0;
    els.score.textContent = '0';
    els.feedback.innerHTML = '';
    els.retryBtn.classList.add('hidden');
    els.nextBtn.disabled = true;

    pool = filterByTopic(topic);
    if(pool.length === 0){ pool = BANK.slice(); topic = 'all'; }

    const n = clamp(parseInt(els.numQuestions.value||10,10), 5, Math.min(50, pool.length));
    const ids = shuffle([...Array(pool.length).keys()]).slice(0, n);
    set = ids.map(k => pool[k]);

    render();
  }

  function render(){
    els.qTotal.textContent = set.length.toString();
    els.qIndex.textContent = (idx+1).toString();
    els.topicLabel.textContent = (topic==='all' ? 'ทั้งหมด' : topic);
    els.feedback.innerHTML = '';
    els.nextBtn.disabled = true;
    answered = false;

    const item = set[idx];
    els.question.textContent = item.q;

    // 1) ถ้ามี distractors ระบุเอง ใช้ก่อน (ควบคุมคุณภาพเต็ม)
    let distractors = Array.isArray(item.distractors) ? item.distractors.slice(0,3) : [];

    // 2) ไม่พอ → หา "คล้ายกัน" จากคำตอบในเรื่องเดียวกัน
    if(distractors.length < 3){
      const sameTopicAnswers = filterByTopic(topic==='all'? item.tag : topic)
        .filter(x => x !== item).map(x => x.a);
      const need = 3 - distractors.length;
      distractors = distractors.concat(
        buildSimilarDistractors(item.a, sameTopicAnswers, need)
      );
    }

    // 3) ยังไม่พอ (กรณีธนาคารเรื่องนั้นน้อย) → เติมจากทุกเรื่องที่คล้ายที่สุด
    if(distractors.length < 3){
      const otherAnswers = BANK.filter(x => x!==item).map(x => x.a);
      const need = 3 - distractors.length;
      distractors = distractors.concat(
        buildSimilarDistractors(item.a, otherAnswers, need)
      );
    }

    // สร้างช้อยส์ 4 ตัว
    const choices = shuffle([ item.a, ...distractors ].slice(0,4));

    els.choices.innerHTML = '';
    const letters = ['A','B','C','D'];
    choices.forEach((text, i)=>{
      const li = document.createElement('li');
      li.className = 'choice';
      li.setAttribute('role','button');
      li.setAttribute('tabindex','0');
      li.dataset.answer = text;
      li.dataset.answerNorm = normalize(text);
      li.dataset.badge = letters[i];
      li.innerHTML = `<span class="badge">${letters[i]}</span><span class="label">${text}</span>`;
      li.addEventListener('click', () => onPick(li, item));
      li.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ onPick(li, item); } });
      els.choices.appendChild(li);
    });
  }

  function lockChoices(){
    [...els.choices.children].forEach(li=>{
      li.setAttribute('aria-disabled','true');
      li.classList.add('pointer-events-none');
    });
  }

  function onPick(liPicked, item){
    if(answered) return;
    answered = true;

    const correctNorm = normalize(item.a);
    const pickedNorm = liPicked.dataset.answerNorm;

    [...els.choices.children].forEach(li=>{
      if(li.dataset.answerNorm === correctNorm) li.classList.add('correct');
      if(li === liPicked && li.dataset.answerNorm !== correctNorm) li.classList.add('wrong');
    });
    lockChoices();

    if(pickedNorm === correctNorm){
      score++;
      showExplain(`<b>ถูกต้อง</b> — ${explanationOf(item)}`);
    }else{
      showExplain(`<b>เฉลย</b>: <u>${item.a}</u><br>${explanationOf(item)}`);
    }

    els.score.textContent = score.toString();
    els.nextBtn.disabled = false;
    if(idx === set.length-1){ els.retryBtn.classList.remove('hidden'); }
  }

  function reveal(){
    if(answered) return;
    const item = set[idx];
    const correctNorm = normalize(item.a);
    [...els.choices.children].forEach(li=>{
      if(li.dataset.answerNorm === correctNorm) li.classList.add('correct');
    });
    lockChoices();
    showExplain(`<b>เฉลย</b>: <u>${item.a}</u><br>${explanationOf(item)}`);
    els.nextBtn.disabled = false;
    answered = true;
  }

  function next(){
    if(idx < set.length-1){ idx++; render(); }
  }

  // Events
  els.nextBtn.addEventListener('click', next);
  els.revealBtn.addEventListener('click', reveal);
  els.retryBtn.addEventListener('click', buildSet);
  els.newSetBtn.addEventListener('click', buildSet);
  window.addEventListener('keydown', e=>{
    if(e.key==='ArrowRight') next();
    else if(e.key===' '){ e.preventDefault(); reveal(); }
  });

  topicBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      topicBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      topic = btn.dataset.topic;
      buildSet();
    });
  });

  // Init
  const allBtn = topicBtns.find(b=>b.dataset.topic==='all');
  if(allBtn) allBtn.classList.add('active');
  buildSet();
})();

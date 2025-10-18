/* Quiz Engine — Topic filter + New set reset + Always explanation + Badges + Safe compare */
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
    ESP32:"สรุปสเปกและโหมดพลังงานของ ESP32 แบบใช้งานจริง",
    Calibration:"คาลิเบรตเพื่อลดอคติ/ออฟเซ็ตและปรับสเกลให้ตรงมาตรฐาน",
    Voltage:"ตัวแบ่งแรงดัน (R1/R2) แล้วอ่านด้วย ADC; คูณ divider gain เพื่อหา Vin",
    Current:"ACS712 แปลงสนามแม่เหล็กเป็นแรงดัน ต้องลบ offset ก่อนคำนวณ",
    MQ135:"ใช้อัตราส่วน Rs/Ro และกราฟ log-log ใน datasheet เพื่อหา PPM",
    LoadCell:"Strain gauge ใน Wheatstone bridge + HX711 ขยายก่อนคาลิเบรตเชิงเส้น",
    MAX30100:"หา IBI → BPM = 60000/Δt; smoothing/threshold ช่วยให้เสถียร",
    KType:"Thermocouple แรงดันเล็ก ต้องชดเชย cold-junction (MAX6675)",
    DS18B20:"โพรบดิจิทัล 1-Wire ความละเอียดสูง เหมาะงานทั่วไป",
    Inductive:"สนามความถี่สูงเหนี่ยวนำ eddy current ในโลหะทำให้แอมพลิจูดลด",
    Comm:"HTTP = Request/Response; MQTT = Pub/Sub ผ่าน Broker",
    WiFi:"Throughput < Data rate เพราะ overhead/ชน; ใช้ช่อง 1/6/11 ลดรบกวน",
    BLE:"พลังงานต่ำ ส่งเป็นช่วง; มีช่องโฆษณา 37/38/39",
    LoRa:"LoRa=PHY; LoRaWAN=MAC/Network (Star-of-Stars, Class A ประหยัดสุด)",
    Zigbee:"Mesh self-forming/self-healing บน 2.4 GHz",
    NBIoT:"LPWAN เครือข่ายมือถือ มี PSM/eDRX ประหยัดพลังงาน",
  };

  // ===== Helpers =====
  const ri = n => Math.floor(Math.random()*n);
  const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=ri(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const filterByTopic = tp => tp==='all' ? BANK.slice() : BANK.filter(x=>x.tag===tp);

  // normalize: ลบช่องว่างหลายแบบ/ขึ้นบรรทัด/แท็บ/nbsp → เว้นวรรคเดียว + lower
  const normalize = (s) => (s ?? "")
    .replace(/\u00A0/g, ' ')        // nbsp → space
    .replace(/\s+/g, ' ')           // บีบช่องว่าง/ขึ้นบรรทัด
    .trim()
    .toLowerCase();

  function explanationOf(item){
    if (item.exp && item.exp.trim().length) return item.exp;
    return defaultExp[item.tag] || "แนวคิดหลักตามหัวข้อ";
  }
  function showExplain(html){ els.feedback.innerHTML = `<div class="explain">${html}</div>`; }

  // ===== State =====
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

    // ตัวเลือก: เอาคำตอบจากเรื่องเดียวกันก่อน
    const sameTopic = filterByTopic(topic==='all' ? item.tag : topic).filter(x=>x!==item).map(x=>x.a);
    const otherTopic = BANK.filter(x=>x!==item && x.tag!==(topic==='all'? item.tag : topic)).map(x=>x.a);

    const choices = [ item.a ];
    shuffle(sameTopic);
    while(choices.length<4 && sameTopic.length){ const p=sameTopic.shift(); if(!choices.includes(p)) choices.push(p); }
    shuffle(otherTopic);
    while(choices.length<4 && otherTopic.length){ const p=otherTopic.shift(); if(!choices.includes(p)) choices.push(p); }
    shuffle(choices);

    els.choices.innerHTML = '';
    const letters = ['A','B','C','D'];
    choices.forEach((text, i)=>{
      const li = document.createElement('li');
      li.className = 'choice';
      li.setAttribute('role','button');
      li.setAttribute('tabindex','0');
      // เก็บทั้ง raw และ normalized
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

    const correct = item.a;
    const correctNorm = normalize(correct);
    const pickedNorm = liPicked.dataset.answerNorm;

    // ไฮไลต์สะอาดด้วย normalized
    [...els.choices.children].forEach(li=>{
      if(li.dataset.answerNorm === correctNorm) li.classList.add('correct');
      if(li === liPicked && li.dataset.answerNorm !== correctNorm) li.classList.add('wrong');
    });
    lockChoices();

    if(pickedNorm === correctNorm){
      score++;
      showExplain(`<b>ถูกต้อง</b> — ${explanationOf(item)}`);
    }else{
      showExplain(`<b>เฉลย</b>: <u>${correct}</u><br>${explanationOf(item)}`);
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

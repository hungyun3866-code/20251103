let questions = [];
let picked = [];
let current = 0;
let score = 0;
let questionDiv, optsDiv, infoDiv, uploadBtn, startBtn, genBtn;
let particles = [];
let state = 'idle'; // 'idle','running','waiting','finished'
let csvLoaded = false;

let cnv;
let optionRects = []; // {x,y,w,h,letter,text}
let feedbackMessage = '';

// 自動產生參數：改為 true 會在載入後自動開始測驗
const AUTO_GENERATE_COUNT = 4;
const AUTO_START = false;

function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0, 0);
  cnv.style('display', 'block');
  textFont('Arial');

  // UI container (右側控制區)
  const ctrl = createDiv();
  ctrl.style('position', 'absolute');
  ctrl.style('right', '12px');  // 改為靠右
  ctrl.style('top', '12px');
  ctrl.style('z-index', '1000');
  ctrl.style('background', 'rgba(0,0,0,0.35)');
  ctrl.style('padding', '8px');
  ctrl.style('border-radius', '8px');
  ctrl.style('backdrop-filter', 'blur(4px)');
  ctrl.style('min-width', '200px'); // 確保最小寬度

  ctrl.child(createElement('h3', '題庫控制').style('margin', '0 0 6px 0').style('color','#fff').elt);

  uploadBtn = createFileInput(handleFile);
  uploadBtn.attribute('accept', '.csv,text/csv');
  uploadBtn.parent(ctrl);
  uploadBtn.style('display','block');
  uploadBtn.style('width', '100%');

  genBtn = createButton('產生隨機題庫 (4 題)');
  genBtn.mousePressed(() => generateRandomQuestions(4));
  genBtn.parent(ctrl);
  genBtn.style('display','block');
  genBtn.style('margin-top','6px');
  genBtn.style('width', '100%');

  startBtn = createButton('隨機抽題並開始 (4 題)');
  startBtn.mousePressed(startQuiz);
  startBtn.attribute('disabled', true);
  startBtn.parent(ctrl);
  startBtn.style('display','block');
  startBtn.style('margin-top','6px');
  startBtn.style('width', '100%');

  infoDiv = createDiv('尚未上傳題庫，或按「產生隨機題庫」建立題庫');
  infoDiv.parent(ctrl);
  infoDiv.style('margin','8px 0 0 0');
  infoDiv.style('color','#fff');
  infoDiv.style('font-size','13px');

  questionDiv = createDiv('').style('font-size','20px').hide();
  optsDiv = createDiv('').hide();
  textAlign(CENTER, CENTER);

  // ===== 自動產生題目（不影響上傳 CSV） =====
  // 若需要自動開始測驗，將 AUTO_START 改為 true
  generateRandomQuestions(AUTO_GENERATE_COUNT);
  if (AUTO_START) {
    // 延遲一點讓畫面與按鈕初始化完成
    setTimeout(() => startQuiz(), 400);
  }
}

function draw() {
  background(30, 34, 40);
  // header area
  fill(255);
  noStroke();
  textSize(18);
  text('互動測驗（p5.js）', width/2, 28);

  // draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.2;
    p.life -= 1;
    fill(p.col);
    noStroke();
    ellipse(p.x, p.y, p.size);
    if (p.life <= 0) particles.splice(i, 1);
  }

  // central area: question/options/feedback
  push();
  translate(0, 0);
  textAlign(CENTER, CENTER);
  if (state === 'idle') {
    fill(200);
    textSize(16);
    text('上傳 CSV 或按「產生隨機題庫」，再按「隨機抽題並開始」進行測驗', width/2, height/2 - 20);
  } else if (state === 'running') {
    drawCurrentQuestion();
  } else if (state === 'waiting') {
    // show last question and feedback
    drawCurrentQuestion(true);
    // feedback text
    fill(255);
    textSize(18);
    text(feedbackMessage, width/2, height/2 + 140);
    textSize(14);
    fill(180);
    text('按畫面任意處繼續', width/2, height/2 + 170);
  } else if (state === 'finished') {
    fill(255);
    textSize(20);
    text(feedbackMessage, width/2, height/2 - 20);
    textSize(16);
    text('按「隨機抽題並開始」或重新上傳題庫再做一次', width/2, height/2 + 20);
  }
  pop();
}

// draw question and options centered; if showHighlights true, highlight correct/selected?
function drawCurrentQuestion() {
  if (current >= picked.length) return;
  const q = questions[picked[current]];

  // 計算可見的選項
  const optLetters = ['A','B','C','D'];
  const visibleOptions = [];
  for (let L of optLetters) {
    const txt = (q[L] || '').toString();
    if (txt.trim() !== '') visibleOptions.push({L, txt});
  }

  // 計算整體區塊尺寸
  const maxW = min(800, Math.floor(width * 0.8));
  const optionH = 52;  // 選項高度
  const gap = 16;      // 選項間距
  
  // 計算整體區塊高度
  const titleH = 120;  // 題目高度
  const optionsH = visibleOptions.length * optionH + (visibleOptions.length - 1) * gap;
  const totalH = titleH + gap * 2 + optionsH;
  
  // 整體區塊從這裡開始（垂直置中）
  const blockTop = height/2 - totalH/2;
  
  // 畫題目
  fill(255);
  textSize(36);
  textAlign(CENTER, CENTER);
  noStroke();
  const qText = `第 ${current+1} 題：${q.question}`;
  text(qText, width/2 - maxW/2, blockTop, maxW, titleH);

  // 畫選項（從題目下方開始）
  optionRects = [];
  let y = blockTop + titleH + gap * 2;
  
  for (let opt of visibleOptions) {
    const x = width/2 - maxW/2;
    
    // 選項背景
    stroke(80);
    strokeWeight(1);
    fill(50);
    rect(x, y, maxW, optionH, 8);
    
    // 選項文字
    noStroke();
    fill(230);
    textSize(24);
    textAlign(LEFT, CENTER);
    text(` ${opt.L}: ${opt.txt}`, x + 20, y + optionH/2);
    
    // 儲存選項區域資訊
    optionRects.push({
      x: x,
      y: y, 
      w: maxW,
      h: optionH,
      letter: opt.L,
      text: opt.txt
    });
    
    y += optionH + gap;
  }

  // 重設對齊方式
  textAlign(CENTER, CENTER);
}

// 新增：處理視窗縮放，保持全螢幕
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cnv.position(0, 0);
}

// 檔案上傳處理
function handleFile(file) {
  if (!file || file.type !== 'text') {
    infoDiv.html('請上傳 CSV 檔案（text/csv）');
    csvLoaded = false;
    startBtn.attribute('disabled', true);
    return;
  }
  try {
    const rows = parseCSV(file.data);
    // 自動偵測 header 行
    let startIdx = 0;
    const headers = rows[0].map(h => h.toLowerCase());
    if (headers.includes('question') || headers.includes('question')) startIdx = 1;
    const parsed = [];
    for (let i = startIdx; i < rows.length; i++) {
      const r = rows[i];
      if (r.length < 2) continue;
      parsed.push({
        question: r[0] || '',
        A: r[1] || '',
        B: r[2] || '',
        C: r[3] || '',
        D: r[4] || '',
        answer: (r[5] || '').trim().toUpperCase(),
        feedback: r[6] || ''
      });
    }
    if (parsed.length === 0) {
      infoDiv.html('CSV 解析後無題目，請檢查格式');
      csvLoaded = false;
      startBtn.attribute('disabled', true);
      return;
    }
    questions = parsed;
    csvLoaded = true;
    infoDiv.html('已載入題庫：' + questions.length + ' 題');
    startBtn.removeAttribute('disabled');
  } catch (e) {
    infoDiv.html('解析 CSV 發生錯誤: ' + e);
    csvLoaded = false;
    startBtn.attribute('disabled', true);
  }
}

// 簡易 CSV 解析（支援帶引號欄位）
function parseCSV(str) {
  const out = [];
  const lines = str.split(/\r?\n/);
  for (let line of lines) {
    if (line.trim() === '') continue;
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' ) {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; } // escaped quote
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    out.push(cols.map(c => c.replace(/^\s+|\s+$/g, '')));
  }
  return out;
}

function startQuiz() {
  if (!csvLoaded || questions.length === 0) {
    infoDiv.html('請先上傳題庫或產生隨機題庫');
    return;
  }
  // 隨機選 4 題（若題庫少於 4 題則全部出題）
  const n = min(4, questions.length);
  const indices = Array.from({length: questions.length}, (_,i)=>i);
  shuffle(indices, true);
  picked = indices.slice(0, n);
  current = 0;
  score = 0;
  state = 'running';
  feedbackMessage = '';
}

function mousePressed() {
  // click handling for canvas options / continue
  if (state === 'running') {
    // check optionRects
    for (let r of optionRects) {
      if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
        handleAnswer(r.letter);
        return;
      }
    }
  } else if (state === 'waiting') {
    // continue to next question
    state = 'running';
    feedbackMessage = '';
    current++;
    if (current >= picked.length) {
      finishQuiz();
    }
  } else if (state === 'finished') {
    // do nothing; user can press buttons
  }
}

// 當使用者答題
function handleAnswer(letter) {
  const q = questions[picked[current]];
  const correct = (q.answer || '').toUpperCase();
  const isRight = correct === letter;
  if (isRight) score++;
  // 回饋用語：優先使用題目 feedback 欄位（若存在以分號分隔 correct/incorrect），否則預設
  let fb = '';
  if (q.feedback && q.feedback.includes(';;')) {
    // custom format: "correct_msg;;incorrect_msg"
    const parts = q.feedback.split(';;');
    fb = isRight ? parts[0] : parts[1];
  } else if (q.feedback && q.feedback.trim() !== '') {
    // single feedback provided -> append correctness note
    fb = isRight ? ('答對！ ' + q.feedback) : ('答錯，正確為 ' + correct + '。' + q.feedback);
  } else {
    fb = isRight ? '答對！做得好。' : '答錯，正確為 ' + correct + '。再接再厲！';
  }
  feedbackMessage = fb;
  infoDiv.html(fb);
  // 粒子效果
  emitParticles(mouseX || width/2, mouseY || height/2, isRight ? color(80,220,120) : color(240,80,80));
  // 進入等待狀態，顯示回饋，等使用者點畫面任何處繼續
  state = 'waiting';
}

// finishQuiz
function finishQuiz() {
  state = 'finished';
  const pct = Math.round((score / picked.length) * 100);
  let msg = '';
  if (pct === 100) msg = '太棒了！全部答對！';
  else if (pct >= 70) msg = '不錯，繼續努力！';
  else msg = '再練習就會進步的！';
  feedbackMessage = `完成！ 得分：${score}/${picked.length} (${pct}%)\n${msg}`;
  infoDiv.html(feedbackMessage);
  // confetti
  for (let i = 0; i < 80; i++) {
    emitParticles(random(width*0.2, width*0.8), random(80,160), color(random(60,255),random(60,255),random(60,255)));
  }
}

// 產生粒子
function emitParticles(x, y, col) {
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: x + random(-10,10),
      y: y + random(-10,10),
      vx: random(-4,4),
      vy: random(-6, -1),
      life: int(random(30,70)),
      size: random(4,10),
      col: col
    });
  }
}

// 新增：產生隨機算術題庫
function generateRandomQuestions(n) {
  const pool = [];
  for (let i = 0; i < n; i++) {
    const ops = ['+','-','×','÷'];
    const op = random(ops);
    let a = int(random(2, 30));
    let b = int(random(2, 20));
    let questionText = '';
    let correctAns = '';
    if (op === '+') {
      correctAns = String(a + b);
      questionText = `${a} + ${b} = ?`;
    } else if (op === '-') {
      if (a < b) [a, b] = [b, a];
      correctAns = String(a - b);
      questionText = `${a} - ${b} = ?`;
    } else if (op === '×') {
      a = int(random(2, 12));
      b = int(random(2, 12));
      correctAns = String(a * b);
      questionText = `${a} × ${b} = ?`;
    } else { // ÷
      b = int(random(2, 12));
      const prod = b * int(random(2, 12));
      a = prod;
      correctAns = String(a / b);
      questionText = `${a} ÷ ${b} = ?`;
    }
    // 建立三個不重複的錯誤選項
    const opts = [correctAns];
    while (opts.length < 4) {
      let delta = int(random(-10, 11));
      if (delta === 0) delta = 1;
      let wrong = String(max(0, Number(correctAns) + delta));
      if (!opts.includes(wrong)) opts.push(wrong);
    }
    shuffle(opts, true);
    const letters = ['A','B','C','D'];
    // feedback format: leave as simple text. If you want different correct/incorrect messages per question,
    // you can set feedback to "correct_msg;;incorrect_msg"
    const obj = { question: questionText, feedback: '' };
    for (let j = 0; j < 4; j++) {
      obj[letters[j]] = opts[j];
      if (opts[j] === correctAns) obj.answer = letters[j];
    }
    pool.push(obj);
  }
  questions = pool;
  csvLoaded = true;
  infoDiv.html('已產生隨機題庫：' + questions.length + ' 題');
  startBtn.removeAttribute('disabled');
}

// 允許鍵盤 r 重新開始
function keyPressed() {
  if (key === 'r' || key === 'R') {
    startQuiz();
  }
}

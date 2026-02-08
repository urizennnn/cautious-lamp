(() => {
  const $ = (s) => document.querySelector(s);
  const screens = document.querySelectorAll('.screen');
  const petalContainer = $('#petal-container');

  // ── Screen transitions ──
  function showScreen(id) {
    screens.forEach((s) => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  // ── Petal spawner ──
  const petalEmojis = ['🌸', '🩷', '💮', '🪷', '🏵️', '✿'];
  const isSmall = window.matchMedia('(max-width: 480px)').matches;
  const maxPetals = isSmall ? 8 : 15;
  let petalCount = 0;

  function spawnPetal() {
    if (petalCount >= maxPetals) return;
    const el = document.createElement('span');
    el.className = 'petal';
    el.textContent = petalEmojis[Math.floor(Math.random() * petalEmojis.length)];
    el.style.left = Math.random() * 100 + 'vw';
    el.style.animationDuration = (6 + Math.random() * 8) + 's';
    el.style.opacity = 0.5 + Math.random() * 0.5;
    petalContainer.appendChild(el);
    petalCount++;
    el.addEventListener('animationend', () => {
      el.remove();
      petalCount--;
    });
  }

  setInterval(spawnPetal, 700);
  for (let i = 0; i < 5; i++) setTimeout(spawnPetal, i * 200);

  // ── Screen 1: Typewriter ──
  const lines = [
    { el: $('#typewriter-line1'), text: 'Hey Victoria...' },
    { el: $('#typewriter-line2'), text: 'I have something to ask you...' },
  ];

  async function typewrite(el, text, speed = 60) {
    el.classList.add('typing');
    for (const ch of text) {
      el.textContent += ch;
      await new Promise((r) => setTimeout(r, speed));
    }
    el.classList.remove('typing');
  }

  async function runTypewriter() {
    await typewrite(lines[0].el, lines[0].text, 70);
    await new Promise((r) => setTimeout(r, 400));
    await typewrite(lines[1].el, lines[1].text, 50);
    await new Promise((r) => setTimeout(r, 300));
    $('#btn-continue').classList.remove('hidden');
  }

  runTypewriter();

  $('#btn-continue').addEventListener('click', () => showScreen('#screen-question'));

  // ── Screen 2: NO button dodge ──
  const btnNo = $('#btn-no');
  const btnYes = $('#btn-yes');
  const sadOverlay = $('#sad-overlay');

  function dodgeButton(clientX, clientY) {
    const rect = btnNo.getBoundingClientRect();
    const btnCX = rect.left + rect.width / 2;
    const btnCY = rect.top + rect.height / 2;
    const dx = btnCX - clientX;
    const dy = btnCY - clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 120) {
      const angle = Math.atan2(dy, dx);
      const push = 140;
      let nx = btnCX + Math.cos(angle) * push;
      let ny = btnCY + Math.sin(angle) * push;

      const pad = 20;
      nx = Math.max(rect.width / 2 + pad, Math.min(window.innerWidth - rect.width / 2 - pad, nx));
      ny = Math.max(rect.height / 2 + pad, Math.min(window.innerHeight - rect.height / 2 - pad, ny));

      const offsetX = nx - btnCX;
      const offsetY = ny - btnCY;
      const current = new DOMMatrix(getComputedStyle(btnNo).transform);
      btnNo.style.transform = `translate(${(current.e || 0) + offsetX}px, ${(current.f || 0) + offsetY}px)`;
    }
  }

  document.addEventListener('mousemove', (e) => {
    if ($('#screen-question').classList.contains('active')) {
      dodgeButton(e.clientX, e.clientY);
    }
  });

  btnNo.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    dodgeButton(t.clientX, t.clientY);
  }, { passive: false });

  btnNo.addEventListener('click', () => {
    sadOverlay.classList.remove('hidden');
  });

  $('#btn-go-back').addEventListener('click', () => {
    sadOverlay.classList.add('hidden');
  });

  btnYes.addEventListener('click', () => {
    showScreen('#screen-record');
    initRecorder();
  });

  // ── Screen 3: Voice recording ──
  let mediaRecorder = null;
  let audioChunks = [];
  let audioBlob = null;
  let audioURL = null;
  let audioCtx = null;
  let analyser = null;
  let animFrame = null;
  let timerInterval = null;
  let recordStart = 0;
  const MAX_REC = 30;

  const canvas = $('#waveform');
  const ctx = canvas.getContext('2d');
  const btnRecord = $('#btn-record');
  const micIcon = $('#mic-icon');
  const stopIcon = $('#stop-icon');
  const timerEl = $('#rec-timer');
  const playbackArea = $('#playback-area');
  const audioEl = $('#audio-playback');

  function getSupportedMime() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  }

  function initRecorder() {
    if (!window.MediaRecorder) {
      $('#rec-fallback').classList.remove('hidden');
      $('.recorder-box').classList.add('hidden');
      return;
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function drawWaveform() {
    if (!analyser) return;
    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    analyser.getByteTimeDomainData(data);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e63973';
    ctx.beginPath();

    const slice = w / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    animFrame = requestAnimationFrame(drawWaveform);
  }

  function startTimer() {
    recordStart = Date.now();
    timerEl.textContent = '0:00';
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordStart) / 1000);
      timerEl.textContent = formatTime(elapsed);
      if (elapsed >= MAX_REC) stopRecording();
    }, 500);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const mimeType = getSupportedMime();
      const options = mimeType ? { mimeType } : {};
      mediaRecorder = new MediaRecorder(stream, options);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mimeType || 'audio/webm';
        audioBlob = new Blob(audioChunks, { type });
        audioURL = URL.createObjectURL(audioBlob);
        audioEl.src = audioURL;
        playbackArea.classList.remove('hidden');
        cancelAnimationFrame(animFrame);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };

      mediaRecorder.start();
      btnRecord.classList.add('recording');
      micIcon.classList.add('hidden');
      stopIcon.classList.remove('hidden');
      playbackArea.classList.add('hidden');
      startTimer();
      drawWaveform();
    } catch {
      $('#rec-fallback').classList.remove('hidden');
      $('.recorder-box').classList.add('hidden');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      btnRecord.classList.remove('recording');
      micIcon.classList.remove('hidden');
      stopIcon.classList.add('hidden');
      stopTimer();
      if (audioCtx) audioCtx.close();
    }
  }

  btnRecord.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  });

  $('#btn-rerecord').addEventListener('click', () => {
    playbackArea.classList.add('hidden');
    audioEl.pause();
    audioEl.src = '';
    timerEl.textContent = '0:00';
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioBlob = null;
    audioURL = null;
  });

  $('#btn-perfect').addEventListener('click', () => {
    showScreen('#screen-celebrate');
    launchConfetti();
  });

  // Fallback: skip recording if not supported
  $('#rec-fallback').addEventListener('click', () => {
    showScreen('#screen-celebrate');
    launchConfetti();
  });

  // ── Screen 4: Confetti ──
  const confettiCanvas = $('#confetti-canvas');
  const cctx = confettiCanvas.getContext('2d');
  let particles = [];

  function resizeConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeConfetti);
  resizeConfetti();

  function launchConfetti() {
    particles = [];
    const colors = ['#ff85a2', '#e63973', '#f5c518', '#ff5c8d', '#d32f2f', '#fff8fa', '#ffd6e0'];
    const hearts = ['💖', '💕', '❤️', '💗', '💝'];

    for (let i = 0; i < 80; i++) {
      const isHeart = i < 20;
      particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 14 - 4,
        size: isHeart ? 18 + Math.random() * 10 : 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        heart: isHeart ? hearts[Math.floor(Math.random() * hearts.length)] : null,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        gravity: 0.15 + Math.random() * 0.1,
        life: 1,
        decay: 0.003 + Math.random() * 0.005,
      });
    }
    animateConfetti();
  }

  function animateConfetti() {
    cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let alive = false;

    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;

      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.life -= p.decay;

      cctx.save();
      cctx.globalAlpha = Math.max(0, p.life);
      cctx.translate(p.x, p.y);
      cctx.rotate((p.rotation * Math.PI) / 180);

      if (p.heart) {
        cctx.font = p.size + 'px serif';
        cctx.textAlign = 'center';
        cctx.textBaseline = 'middle';
        cctx.fillText(p.heart, 0, 0);
      } else {
        cctx.fillStyle = p.color;
        cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      cctx.restore();
    }

    if (alive) requestAnimationFrame(animateConfetti);
  }

  // ── Share ──
  $('#btn-share').addEventListener('click', async () => {
    if (audioBlob && navigator.canShare) {
      const ext = audioBlob.type.includes('mp4') ? 'mp4' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([audioBlob], `victoria-valentine.${ext}`, { type: audioBlob.type });
      const shareData = {
        title: 'Happy Valentine\'s Day!',
        text: 'Victoria said YES! 💝',
        files: [file],
      };
      try {
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch {}
    }
    const msg = encodeURIComponent('Victoria said YES! Happy Valentine\'s Day 💝');
    window.open(`https://wa.me/2347041386799?text=${msg}`, '_blank');
  });
})();

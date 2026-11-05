// ==========================================
// ЧИСТЫЙ И ЛЕГКИЙ AUDIO ENGINE НА WEB AUDIO API
// ==========================================

const bpm = 122;
const stepLength = 60 / bpm / 4;
const instruments = ["drums", "bass", "chords", "melody"];

const settings = {
  drums: { volume: 82, frequency: 100, speed: 100, on: true },
  bass: { volume: 80, frequency: 100, speed: 100, on: true },
  chords: { volume: 67, frequency: 100, speed: 100, on: true },
  melody: { volume: 72, frequency: 100, speed: 100, on: true },
};

let audioCtx = null;
let masterGain = null;
let masterVolume = 70;
let playing = false;
let startTime = 0;
let nextStepTime = 0.0;
let currentStep = 0;
let timerId = null;

// Ноты и аккорды из оригинального проекта
const progression = [
  { root: 61.74, chord: [246.94, 311.13, 369.99, 466.16] }, // B
  { root: 49.00, chord: [207.65, 246.94, 311.13, 369.99] }, // G#
  { root: 82.41, chord: [164.81, 207.65, 246.94, 311.13] }, // E
  { root: 46.25, chord: [185.00, 233.08, 277.18, 329.63] }  // F#
];

const melodyNotes = [
  [369.99, 392.00, 466.16, 369.99, 293.66, 369.99, 392.00],
  [493.88, 466.16, 392.00, 369.99, 293.66, 369.99, 466.16]
];

// --- ИНИЦИАЛИЗАЦИЯ И СЛАЙДЕРЫ ---
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);
  updateMasterVolume();
}

function updateMasterVolume() {
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(masterVolume / 100, audioCtx.currentTime);
  }
}

const masterSlider = document.querySelector("#masterVolume");
if (masterSlider) {
  masterSlider.addEventListener("input", () => {
    masterVolume = Number(masterSlider.value);
    document.querySelector("#masterValue").textContent = masterVolume + "%";
    updateMasterVolume();
  });
}

// Упрощенный синтез бочки (Kick)
function playKick(time, vol) {
  if (!settings.drums.on) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(masterGain);

  osc.frequency.setValueAtTime(120 * (settings.drums.frequency / 100), time);
  osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);

  gain.gain.setValueAtTime(vol * (settings.drums.volume / 100) * 0.4, time);
  gain.gain.linearRampToValueAtTime(0.01, time + 0.12);

  osc.start(time);
  osc.stop(time + 0.13);
}

// Простой синтез хэта (Noise-like Hat)
function playHat(time, vol) {
  if (!settings.drums.on) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.connect(gain);
  gain.connect(masterGain);

  osc.frequency.setValueAtTime(8000, time);
  gain.gain.setValueAtTime(vol * (settings.drums.volume / 100) * 0.1, time);
  gain.gain.linearRampToValueAtTime(0.001, time + 0.03);

  osc.start(time);
  osc.stop(time + 0.04);
}

// Облегченный Моно-Бас
function playBass(time, freq, duration, vol) {
  if (!settings.bass.on) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.connect(gain);
  gain.connect(masterGain);

  osc.frequency.setValueAtTime(freq * (settings.bass.frequency / 100), time);
  gain.gain.setValueAtTime(vol * (settings.bass.volume / 100) * 0.15, time);
  gain.gain.linearRampToValueAtTime(0.001, time + duration);

  osc.start(time);
  osc.stop(time + duration);
}

// Легкие полифонические Аккорды (максимум 3 ноты для экономии процессора)
function playChord(time, freqs, duration, vol) {
  if (!settings.chords.on) return;
  freqs.slice(0, 3).forEach(f => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.connect(gain);
    gain.connect(masterGain);

    osc.frequency.setValueAtTime(f * (settings.chords.frequency / 100), time);
    gain.gain.setValueAtTime(vol * (settings.chords.volume / 100) * 0.08, time);
    gain.gain.linearRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration);
  });
}

// Мелодия (Lead)
function playMelody(time, freq, duration, vol) {
  if (!settings.melody.on) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.connect(gain);
  gain.connect(masterGain);

  osc.frequency.setValueAtTime(freq * (settings.melody.frequency / 100), time);
  gain.gain.setValueAtTime(vol * (settings.melody.volume / 100) * 0.15, time);
  gain.gain.linearRampToValueAtTime(0.001, time + duration);

  osc.start(time);
  osc.stop(time + duration);
}

// --- ШЕДУЛЕР (ПЛАНИРОВЩИК ШАГОВ) ---
function scheduler() {
  while (nextStepTime < audioCtx.currentTime + 0.1) {
    scheduleNote(currentStep, nextStepTime);
    advanceStep();
  }
  timerId = setTimeout(scheduler, 25);
}

function advanceStep() {
  const secondsPerBeat = 60.0 / bpm;
  nextStepTime += 0.25 * secondsPerBeat;
  currentStep = (currentStep + 1) % 128; // Логика на 8 такт(16*8=128)
}

function scheduleNote(step, time) {
  const bar = Math.floor(step / 16);
  const localStep = step % 16;
  const progIndex = bar % 4;

  // 1. Ритм-секция
  if ([0, 4, 8, 12].includes(localStep)) playKick(time, 0.8);
  if (localStep % 2 === 2) playHat(time, 0.3);

  // 2. Бас
  if (localStep === 0) playBass(time, progression[progIndex].root, stepLength * 2, 0.8);
  if (localStep === 6) playBass(time, progression[progIndex].root * 1.5, stepLength, 0.6);

  // 3. Аккорды
  if ([2, 6, 10, 14].includes(localStep)) {
    playChord(time, progression[progIndex].chord, stepLength * 1.5, 0.6);
  }

  // 4. Мелодия
  if (localStep % 2 === 0 && melodyNotes[bar % 2][localStep / 2]) {
    playMelody(time, melodyNotes[bar % 2][localStep / 2], stepLength * 1.2, 0.7);
  }
}

// --- УПРАВЛЕНИЕ КНОПКАМИ ---
document.querySelector(".play").addEventListener("click", () => {
  if (playing) return;
  if (!audioCtx) initAudio();
  
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  playing = true;
  currentStep = 0;
  nextStepTime = audioCtx.currentTime + 0.05;
  scheduler();
});

document.querySelector(".stop").addEventListener("click", () => {
  playing = false;
  clearTimeout(timerId);
});

// Заглушки, чтобы не ломался старый UI-код карточек эффектов
document.querySelectorAll(".instrument-card").forEach((card) => {
  const name = card.dataset.instrument;
  card.querySelectorAll("input[data-param]").forEach((slider) => {
    slider.addEventListener("input", () => {
      const param = slider.dataset.param;
      if (settings[name]) settings[name][param] = Number(slider.value);
    });
  });
  const btn = card.querySelector(".instrument-button");
  if (btn) {
    btn.addEventListener("click", () => {
      settings[name].on = !settings[name].on;
      btn.classList.toggle("active", settings[name].on);
    });
  }
});

const STORAGE_KEY = 'pimark_pro_real_history_v24';
let memoryFallback = [];

const state = {
  mode: 'single',       // 'single' | 'multi'
  limitType: 'fixed',   // 'fixed' (по объёму) | 'timed' (по времени)
  digits: 25000,
  threads: navigator.hardwareConcurrency || 4,
  multiIterations: 200000000,
  durationSec: 60,      // длительность теста по времени в секундах
  filter: 'all',
  running: false,
  workers: [],
  timerInterval: null,
  device: {
    name: 'Устройство',
    type: 'Desktop / PC',
    cores: navigator.hardwareConcurrency || 4,
    ram: '—',
    os: '—',
    screen: '—',
    engine: '—'
  }
};

const el = {
  fpsValue: document.getElementById('fpsValue'),
  openModalBtn: document.getElementById('openModalBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  understandBtn: document.getElementById('understandBtn'),
  infoModal: document.getElementById('infoModal'),

  deviceTypeBadge: document.getElementById('deviceTypeBadge'),
  deviceNameInput: document.getElementById('deviceNameInput'),
  specCores: document.getElementById('specCores'),
  specRam: document.getElementById('specRam'),
  specOs: document.getElementById('specOs'),
  specScreen: document.getElementById('specScreen'),
  specEngine: document.getElementById('specEngine'),

  modeTabs: document.getElementById('modeTabs'),
  limitTabs: document.getElementById('limitTabs'),
  modeDescription: document.getElementById('modeDescription'),
  multiThreadsBox: document.getElementById('multiThreadsBox'),
  singleControls: document.getElementById('singleControls'),
  multiControls: document.getElementById('multiControls'),
  timeControls: document.getElementById('timeControls'),

  singleDigitsLabel: document.getElementById('singleDigitsLabel'),
  digitsPresets: document.getElementById('digitsPresets'),
  singleCustomInput: document.getElementById('singleCustomInput'),

  threadsCountLabel: document.getElementById('threadsCountLabel'),
  threadsSlider: document.getElementById('threadsSlider'),
  recommendedThreadsText: document.getElementById('recommendedThreadsText'),
  multiIterLabel: document.getElementById('multiIterLabel'),
  multiPresets: document.getElementById('multiPresets'),
  multiCustomInput: document.getElementById('multiCustomInput'),

  timeDurationLabel: document.getElementById('timeDurationLabel'),
  timePresets: document.getElementById('timePresets'),
  timeCustomInput: document.getElementById('timeCustomInput'),

  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),

  statusBadge: document.getElementById('statusBadge'),
  teleTimeLabel: document.getElementById('teleTimeLabel'),
  teleTime: document.getElementById('teleTime'),
  teleSpeed: document.getElementById('teleSpeed'),
  teleProgressLabel: document.getElementById('teleProgressLabel'),
  teleProgress: document.getElementById('teleProgress'),
  mainProgressBar: document.getElementById('mainProgressBar'),
  workersBars: document.getElementById('workersBars'),
  piPreviewText: document.getElementById('piPreviewText'),
  copyPiBtn: document.getElementById('copyPiBtn'),

  scoreModeBadge: document.getElementById('scoreModeBadge'),
  scoreMainCaption: document.getElementById('scoreMainCaption'),
  scoreDisplay: document.getElementById('scoreDisplay'),
  scoreUnitCaption: document.getElementById('scoreUnitCaption'),
  tierBadge: document.getElementById('tierBadge'),
  bestSingleVal: document.getElementById('bestSingleVal'),
  bestMultiVal: document.getElementById('bestMultiVal'),

  historyFilter: document.getElementById('historyFilter'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  historyTableBody: document.getElementById('historyTableBody')
};

function formatIterText(iterCount) {
  if (iterCount >= 1000000000) {
    return `${(iterCount / 1e9).toFixed(2)} млрд итераций`;
  }
  if (iterCount >= 1000000) {
    const mln = iterCount / 1000000;
    const formattedMln = Number.isInteger(mln) ? mln.toLocaleString('ru-RU') : mln.toFixed(1);
    return `${formattedMln} млн итераций`;
  }
  return `${iterCount.toLocaleString('ru-RU')} итераций`;
}

function formatDurationLabel(sec) {
  if (sec >= 60 && sec % 60 === 0) {
    return `${sec} сек (${sec / 60} мин)`;
  }
  return `${sec} сек`;
}

// 1. Живой монитор FPS UI-потока
function startFpsMonitor() {
  let frames = 0;
  let last = performance.now();
  function tick(now) {
    frames++;
    if (now - last >= 500) {
      const fps = Math.min(240, Math.round((frames * 1000) / (now - last)));
      el.fpsValue.textContent = fps;
      frames = 0;
      last = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// 2. Автоопределение параметров устройства
async function detectDeviceProfile() {
  const ua = navigator.userAgent || '';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory ? `~${navigator.deviceMemory}+ ГБ` : '~8+ ГБ';
  const dpr = window.devicePixelRatio || 1;
  const screenRes = `${window.screen.width}×${window.screen.height} (${dpr}x)`;

  let os = 'Windows';
  let devType = 'Desktop / PC';
  let browser = 'Chrome';
  let name = `Windows ПК (${cores}-Core)`;

  if (ua.includes('YaBrowser/')) browser = 'Яндекс Браузер';
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Apple Safari';

  if (/Android/i.test(ua)) {
    const v = ua.match(/Android\s([0-9.]+)/i);
    os = v ? `Android ${v[1]}` : 'Android';
    devType = /BRAVIA|AFT|Android TV|GoogleTV|TV/i.test(ua) ? 'Smart TV / TV Box' : 'Mobile / Android';
    const m = ua.match(/;\s*([^;)]+?)\s+Build\//i);
    name = m && m[1] ? `${m[1].trim()} (${cores}-Core)` : `${devType} (${cores}-Core)`;
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS / iPadOS';
    devType = 'Mobile / Apple';
    name = /iPad/i.test(ua) ? `Apple iPad (${cores}-Core)` : `Apple iPhone (${cores}-Core)`;
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
    devType = 'Desktop / Mac';
    name = `Apple Mac (${cores}-Core)`;
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    name = `Linux ПК (${cores}-Core)`;
  }

  state.device = {
    name,
    type: devType,
    cores,
    ram: mem,
    os,
    screen: screenRes,
    engine: `${browser} (${os})`
  };

  state.threads = cores;
  applyDeviceUI();

  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
      if (hints.platform === 'Windows' && hints.platformVersion) {
        const major = parseInt(hints.platformVersion.split('.')[0], 10);
        state.device.os = major >= 13 ? 'Windows 11' : 'Windows 10';
        state.device.engine = `${browser} (${state.device.os})`;
      }
      if (hints.model && hints.model.trim()) {
        state.device.name = `${hints.model.trim()} (${cores}-Core)`;
      }
      applyDeviceUI();
    } catch (_) {}
  }
}

function applyDeviceUI() {
  el.deviceTypeBadge.textContent = state.device.type;
  el.deviceNameInput.value = state.device.name;
  el.specCores.textContent = `${state.device.cores} потоков`;
  el.specRam.textContent = state.device.ram;
  el.specOs.textContent = state.device.os;
  el.specScreen.textContent = state.device.screen;
  el.specEngine.textContent = `Движок: ${state.device.engine}`;

  el.threadsSlider.value = state.threads;
  el.threadsCountLabel.textContent = `${state.threads} потоков`;
  el.recommendedThreadsText.textContent = `Логических ядер: ${state.device.cores}`;
  updateControlsVisibility();
}

// Синхронизация видимости панелей настроек (Single / Multi + Fixed / Timed)
function updateControlsVisibility() {
  const isSingle = state.mode === 'single';
  const isTimed = state.limitType === 'timed';

  // Ползунок потоков показываем всегда, когда выбран Multi-Core
  el.multiThreadsBox.classList.toggle('hidden', isSingle);

  // Панели нагрузки
  el.singleControls.classList.toggle('hidden', !isSingle || isTimed);
  el.multiControls.classList.toggle('hidden', isSingle || isTimed);
  el.timeControls.classList.toggle('hidden', !isTimed);

  // Бейдж и заголовки карточки результатов
  const modeStr = isSingle ? 'SINGLE-CORE' : `MULTI-CORE (${state.threads} ПОТОКОВ)`;
  el.scoreModeBadge.textContent = isTimed ? `${modeStr} • ТАЙМЕР` : modeStr;

  if (isTimed) {
    el.teleTimeLabel.textContent = 'ТАЙМЕР / ЛИМИТ';
    el.teleProgressLabel.textContent = 'ПРОГРЕСС ВРЕМЕНИ';
    el.scoreMainCaption.textContent = 'ВЫЧИСЛЕНО ЗА ОТВЕДЁННОЕ ВРЕМЯ';
    el.scoreUnitCaption.textContent = isSingle ? 'ТОЧНЫХ ЗНАКОВ ЧИСЛА π' : 'ИТЕРАЦИЙ BBP / НИЛАКАНТЫ';
    el.modeDescription.innerHTML = isSingle
      ? 'Непрерывное вычисление знаков числа π на базе <code>BigInt</code> строго в течение заданного времени. Позволяет узнать, сколько реальных знаков π процессор успеет выдать за минуту или другой интервал.'
      : 'Многопоточный стресс-тест всех ядер в течение заданного времени. Показывает реальный суммарный объём итераций, который процессор способен перемолоть до срабатывания таймера.';
  } else {
    el.teleTimeLabel.textContent = 'ВРЕМЯ ВЫПОЛНЕНИЯ';
    el.teleProgressLabel.textContent = 'ПРОГРЕСС ЗАДАЧИ';
    el.scoreMainCaption.textContent = 'ИНДЕКС ПРОИЗВОДИТЕЛЬНОСТИ';
    el.scoreUnitCaption.textContent = 'БАЛЛОВ (PTS)';
    el.modeDescription.innerHTML = isSingle
      ? 'Вычисляет точные знаки числа π по формуле Джона Мэчина на базе длинной арифметики <code>BigInt</code> в одном потоке. Идеально для проверки однопоточной производительности ядра ЦП.'
      : 'Создаёт пул параллельных потоков <code>Web Workers</code> и распределяет между ними заданное число 64-битных итераций (ряды Нилаканты / BBP) для 100% нагрузки всех ядер.';
  }

  renderWorkerCells(isSingle ? 1 : state.threads);
}

// 3. Отрисовка индикаторов потоков Web Workers
function renderWorkerCells(count) {
  el.workersBars.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'worker-cell';
    cell.innerHTML = `
      <div class="worker-cell-top">
        <span>Поток #${i + 1}</span>
        <strong id="wPct_${i}">0%</strong>
      </div>
      <div class="worker-mini-bar">
        <div class="worker-mini-fill" id="wBar_${i}"></div>
      </div>
    `;
    el.workersBars.appendChild(cell);
  }
}

// 4. Создание воркера (поддержка и локального file://, и внешнего worker.js)
function createBenchmarkWorker() {
  if (window.location.protocol !== 'file:') {
    try {
      return new Worker('worker.js');
    } catch (_) {}
  }
  const inlineCode = `
    self.onmessage = function (e) {
      const { mode, limitType, workerId, digits, iterations, durationMs } = e.data;
      const startTime = performance.now();

      if (limitType === 'timed') {
        const deadline = startTime + durationMs;
        if (mode === 'single') {
          const blockDigits = 10000;
          const guard = 10;
          const totalBlockDigits = blockDigits + guard;
          const scale = 10n ** BigInt(totalBlockDigits);
          const steps5 = Math.ceil(totalBlockDigits / Math.log10(25));
          const steps239 = Math.ceil(totalBlockDigits / Math.log10(57121));
          const totalStepsPerBlock = steps5 + steps239;
          let totalComputedDigits = 0;
          let lastPiSample = '3.14159265358979323846264338327950288419716939937510...';
          let lastReportTime = startTime;

          while (performance.now() < deadline) {
            let stepsInCurrentBlock = 0;
            let timeUp = false;
            function arccotTimed(xBig, scaleVal) {
              const x2 = xBig * xBig;
              let term = scaleVal / xBig;
              let sum = term;
              let n = 1n;
              let sign = -1n;
              while (term > 0n) {
                term = term / x2;
                const current = term / (2n * n + 1n);
                if (current === 0n) break;
                sum += sign * current;
                sign = -sign;
                n += 1n;
                stepsInCurrentBlock++;
                if (stepsInCurrentBlock % 15 === 0) {
                  const now = performance.now();
                  if (now >= deadline) { timeUp = true; break; }
                  if (now - lastReportTime >= 90) {
                    lastReportTime = now;
                    const partialDigits = Math.floor((stepsInCurrentBlock / totalStepsPerBlock) * blockDigits);
                    const currentTotal = totalComputedDigits + partialDigits;
                    const timeProgress = Math.min(99, Math.floor(((now - startTime) / durationMs) * 100));
                    self.postMessage({ type: 'progress', workerId, progress: timeProgress, workDone: currentTotal });
                  }
                }
              }
              return sum;
            }
            const p1 = arccotTimed(5n, scale);
            let p2 = 0n;
            if (!timeUp) p2 = arccotTimed(239n, scale);
            if (!timeUp) {
              totalComputedDigits += blockDigits;
              const piBig = 4n * (4n * p1 - p2);
              const piStr = (piBig / (10n ** BigInt(guard))).toString();
              lastPiSample = piStr.slice(0, 1) + '.' + piStr.slice(1, 65) + ' ... ' + piStr.slice(-45);
            } else {
              totalComputedDigits += Math.floor((stepsInCurrentBlock / totalStepsPerBlock) * blockDigits);
              break;
            }
          }
          self.postMessage({ type: 'done', workerId, durationMs: performance.now() - startTime, workDone: Math.max(10, totalComputedDigits), sample: lastPiSample });
          return;
        } else {
          let acc = 3.0;
          let sign = 1.0;
          let completedIter = 0;
          let i = 1;
          const batch = 50000;
          let lastReportTime = startTime;
          while (true) {
            for (let b = 0; b < batch; b++, i++) {
              const k = 2.0 * i;
              acc += sign * (4.0 / (k * (k + 1.0) * (k + 2.0)));
              sign = -sign;
            }
            completedIter += batch;
            const now = performance.now();
            if (now >= deadline) break;
            if (now - lastReportTime >= 90) {
              lastReportTime = now;
              const timeProgress = Math.min(99, Math.floor(((now - startTime) / durationMs) * 100));
              self.postMessage({ type: 'progress', workerId, progress: timeProgress, workDone: completedIter });
            }
          }
          self.postMessage({ type: 'done', workerId, durationMs: performance.now() - startTime, workDone: completedIter, sample: acc.toFixed(15) + ' (контрольная сумма потока #' + (workerId + 1) + ')' });
          return;
        }
      }

      if (mode === 'single') {
        const guard = 10;
        const totalDigits = digits + guard;
        const scale = 10n ** BigInt(totalDigits);
        function arccot(xBig, scaleVal, offset, weight) {
          const x2 = xBig * xBig;
          let term = scaleVal / xBig;
          let sum = term;
          let n = 1n;
          let sign = -1n;
          let step = 0;
          const approxSteps = Math.max(1, Math.ceil(totalDigits / Math.log10(Number(x2))));
          const reportInterval = Math.max(5, Math.floor(approxSteps / 100));
          while (term > 0n) {
            term = term / x2;
            const current = term / (2n * n + 1n);
            if (current === 0n) break;
            sum += sign * current;
            sign = -sign;
            n += 1n;
            step++;
            if (step % reportInterval === 0) {
              const local = Math.min(1, step / approxSteps);
              const progress = Math.min(99, Math.floor((offset + local * weight) * 100));
              self.postMessage({ type: 'progress', workerId, progress, workDone: Math.floor((progress / 100) * digits) });
            }
          }
          return sum;
        }
        const p1 = arccot(5n, scale, 0, 0.78);
        const p2 = arccot(239n, scale, 0.78, 0.22);
        const piBig = 4n * (4n * p1 - p2);
        const piStr = (piBig / (10n ** BigInt(guard))).toString();
        const formatted = piStr.length > 110
          ? piStr.slice(0, 1) + '.' + piStr.slice(1, 65) + ' ... ' + piStr.slice(-45)
          : piStr.slice(0, 1) + '.' + piStr.slice(1);
        self.postMessage({ type: 'done', workerId, durationMs: performance.now() - startTime, workDone: digits, sample: formatted });
      } else {
        let acc = 3.0;
        let sign = 1.0;
        const chunk = Math.max(1000, Math.floor(iterations / 60));
        for (let i = 1; i <= iterations; i++) {
          const k = 2.0 * i;
          acc += sign * (4.0 / (k * (k + 1.0) * (k + 2.0)));
          sign = -sign;
          if (i % chunk === 0) {
            const progress = Math.min(99, Math.floor((i / iterations) * 100));
            self.postMessage({ type: 'progress', workerId, progress, workDone: i });
          }
        }
        self.postMessage({
          type: 'done',
          workerId,
          durationMs: performance.now() - startTime,
          workDone: iterations,
          sample: acc.toFixed(15) + ' (контрольная сумма потока #' + (workerId + 1) + ')'
        });
      }
    };
  `;
  const blob = new Blob([inlineCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

// 5. Запуск и выполнение бенчмарка
function startBenchmark() {
  if (state.running) return;

  const isSingle = state.mode === 'single';
  const isTimed = state.limitType === 'timed';

  // Валидируем ввод перед стартом
  if (isTimed) {
    const manualSec = parseFloat(el.timeCustomInput.value);
    if (!isNaN(manualSec) && manualSec >= 1) {
      state.durationSec = Math.min(3600, manualSec);
    } else {
      state.durationSec = 60;
      el.timeCustomInput.value = 60;
    }
    el.timeDurationLabel.textContent = formatDurationLabel(state.durationSec);
  } else if (isSingle) {
    const manualDigits = parseInt(el.singleCustomInput.value, 10);
    if (!isNaN(manualDigits) && manualDigits >= 10) {
      state.digits = manualDigits;
    } else {
      state.digits = 25000;
      el.singleCustomInput.value = 25000;
    }
    el.singleDigitsLabel.textContent = `${state.digits.toLocaleString('ru-RU')} знаков`;
  } else {
    const manualIter = parseInt(el.multiCustomInput.value, 10);
    if (!isNaN(manualIter) && manualIter >= 1000) {
      state.multiIterations = manualIter;
    } else {
      state.multiIterations = 200000000;
      el.multiCustomInput.value = 200000000;
    }
    el.multiIterLabel.textContent = formatIterText(state.multiIterations);
  }

  state.running = true;

  const activeThreads = isSingle ? 1 : state.threads;
  renderWorkerCells(activeThreads);

  el.startBtn.disabled = true;
  el.stopBtn.classList.remove('hidden');
  el.statusBadge.textContent = isTimed
    ? `Таймер: ${state.durationSec} с (${activeThreads} пот.)...`
    : `Выполняется (${activeThreads} пот.)...`;
  el.statusBadge.style.color = '#22d3ee';
  el.mainProgressBar.style.width = '0%';
  el.teleProgress.textContent = '0%';
  el.scoreDisplay.textContent = '...';

  const progresses = new Array(activeThreads).fill(0);
  const workerWorkDone = new Array(activeThreads).fill(0);
  let finished = 0;
  const startWall = performance.now();
  const targetDurationMs = state.durationSec * 1000;

  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    const elapsedSec = (performance.now() - startWall) / 1000;
    if (isTimed) {
      const clamped = Math.min(state.durationSec, elapsedSec);
      el.teleTime.innerHTML = `${clamped.toFixed(1)} <small>/ ${state.durationSec} с</small>`;
    } else {
      el.teleTime.innerHTML = `${elapsedSec.toFixed(3)} <small>с</small>`;
    }
  }, 50);

  state.workers = [];
  const perWorkerIter = Math.max(100, Math.floor(state.multiIterations / activeThreads));

  for (let i = 0; i < activeThreads; i++) {
    const worker = createBenchmarkWorker();
    state.workers.push(worker);

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        progresses[msg.workerId] = msg.progress;
        if (typeof msg.workDone === 'number') {
          workerWorkDone[msg.workerId] = msg.workDone;
        }

        const wPct = document.getElementById(`wPct_${msg.workerId}`);
        const wBar = document.getElementById(`wBar_${msg.workerId}`);
        if (wPct) wPct.textContent = `${msg.progress}%`;
        if (wBar) wBar.style.width = `${msg.progress}%`;

        const avg = Math.floor(progresses.reduce((a, b) => a + b, 0) / activeThreads);
        el.mainProgressBar.style.width = `${avg}%`;
        el.teleProgress.textContent = `${avg}%`;

        // Обновляем живую скорость и текущий результат во время теста
        const elapsedSec = Math.max(0.05, (performance.now() - startWall) / 1000);
        const totalWorkNow = workerWorkDone.reduce((a, b) => a + b, 0);
        if (totalWorkNow > 0) {
          if (isSingle) {
            const liveSpeed = Math.round(totalWorkNow / elapsedSec);
            el.teleSpeed.innerHTML = `${liveSpeed.toLocaleString('ru-RU')} <small>зн/с</small>`;
            if (isTimed) el.scoreDisplay.textContent = totalWorkNow.toLocaleString('ru-RU');
          } else {
            const liveMlnPerSec = (totalWorkNow / 1e6) / elapsedSec;
            el.teleSpeed.innerHTML = `${liveMlnPerSec.toFixed(1)} <small>млн ит/с</small>`;
            if (isTimed) el.scoreDisplay.textContent = `${(totalWorkNow / 1e6).toFixed(0)}M`;
          }
        }
      } else if (msg.type === 'done') {
        progresses[msg.workerId] = 100;
        if (typeof msg.workDone === 'number') {
          workerWorkDone[msg.workerId] = msg.workDone;
        }

        const wPct = document.getElementById(`wPct_${msg.workerId}`);
        const wBar = document.getElementById(`wBar_${msg.workerId}`);
        if (wPct) wPct.textContent = '100%';
        if (wBar) wBar.style.width = '100%';

        finished++;
        if (finished === activeThreads) {
          const totalWork = workerWorkDone.reduce((a, b) => a + b, 0);
          finishBenchmark(performance.now() - startWall, activeThreads, totalWork, msg.sample);
        }
      }
    };

    worker.postMessage({
      mode: state.mode,
      limitType: state.limitType,
      workerId: i,
      digits: state.digits,
      iterations: perWorkerIter,
      durationMs: targetDurationMs
    });
  }
}

function finishBenchmark(totalMs, activeThreads, totalWorkDone, sampleText) {
  stopWorkers();
  state.running = false;
  el.startBtn.disabled = false;
  el.stopBtn.classList.add('hidden');

  const isSingle = state.mode === 'single';
  const isTimed = state.limitType === 'timed';
  const sec = Math.max(0.001, totalMs / 1000);

  el.teleTime.innerHTML = `${sec.toFixed(3)} <small>с</small>`;
  el.teleProgress.textContent = '100%';
  el.mainProgressBar.style.width = '100%';
  el.statusBadge.textContent = 'Тест успешно завершён';
  el.statusBadge.style.color = '#34d399';

  let speedStr = '';
  let taskLabel = '';
  let score = 0;
  let mainDisplayStr = '';
  let tableResultBadge = '';

  if (isSingle) {
    const computedDigits = isTimed ? totalWorkDone : state.digits;
    const speed = Math.round(computedDigits / sec);
    speedStr = `${speed.toLocaleString('ru-RU')} зн/с`;
    el.teleSpeed.innerHTML = `${speed.toLocaleString('ru-RU')} <small>зн/с</small>`;

    if (isTimed) {
      taskLabel = `⏱️ Таймер ${state.durationSec} с`;
      // Эквивалентный индекс относительно эталона 10 000 знаков
      score = Math.max(10, Math.round((computedDigits / sec) * 0.22));
      mainDisplayStr = computedDigits.toLocaleString('ru-RU');
      tableResultBadge = `${computedDigits.toLocaleString('ru-RU')} зн. (${score.toLocaleString('ru-RU')} PTS)`;
    } else {
      taskLabel = `${state.digits.toLocaleString('ru-RU')} знаков π`;
      const norm = Math.pow(state.digits / 10000, 1.95);
      score = Math.max(10, Math.round((norm * 2200) / sec));
      mainDisplayStr = score.toLocaleString('ru-RU');
      tableResultBadge = `${score.toLocaleString('ru-RU')} PTS`;
    }
  } else {
    const computedIter = isTimed ? totalWorkDone : state.multiIterations;
    const millionPerSec = (computedIter / 1e6) / sec;
    speedStr = `${millionPerSec.toFixed(1)} млн ит/с`;
    el.teleSpeed.innerHTML = `${millionPerSec.toFixed(1)} <small>млн ит/с</small>`;
    score = Math.max(10, Math.round(millionPerSec * 128));

    if (isTimed) {
      taskLabel = `⏱️ Таймер ${state.durationSec} с`;
      const formattedWork = computedIter >= 1e9
        ? `${(computedIter / 1e9).toFixed(2)} млрд`
        : `${(computedIter / 1e6).toFixed(1)} млн`;
      mainDisplayStr = formattedWork;
      tableResultBadge = `${formattedWork} ит. (${score.toLocaleString('ru-RU')} PTS)`;
    } else {
      taskLabel = formatIterText(state.multiIterations);
      mainDisplayStr = score.toLocaleString('ru-RU');
      tableResultBadge = `${score.toLocaleString('ru-RU')} PTS`;
    }
  }

  el.scoreDisplay.textContent = mainDisplayStr;
  el.piPreviewText.textContent = sampleText;
  el.tierBadge.textContent = isTimed
    ? `${getTierTitle(score, state.mode)} • Индекс: ${score.toLocaleString('ru-RU')} PTS`
    : getTierTitle(score, state.mode);

  saveRealResult({
    device: el.deviceNameInput.value.trim() || state.device.name,
    os: state.device.os,
    modeKey: state.mode,
    limitType: state.limitType,
    modeLabel: isSingle ? 'Single-Core (1T)' : `Multi-Core (${activeThreads}T)`,
    task: taskLabel,
    timeSec: sec.toFixed(2),
    speed: speedStr,
    score,
    resultBadge: tableResultBadge,
    date: new Date().toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  });
}

function getTierTitle(score, mode) {
  const ref = mode === 'single' ? score : score / 4;
  if (ref >= 6000) return '🏆 Класс: Флагман / Desktop';
  if (ref >= 3000) return '🚀 Класс: Высокая производительность';
  if (ref >= 1200) return '⚡ Класс: Средний сегмент (Mid-Range)';
  return '📱 Класс: Базовый процессор';
}

function stopWorkers() {
  clearInterval(state.timerInterval);
  state.workers.forEach((w) => w.terminate());
  state.workers = [];
}

function abortBenchmark() {
  if (!state.running) return;
  stopWorkers();
  state.running = false;
  el.startBtn.disabled = false;
  el.stopBtn.classList.add('hidden');
  el.statusBadge.textContent = 'Остановлено пользователем';
  el.statusBadge.style.color = '#f87171';
}

// 6. История реальных устройств
function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : memoryFallback;
  } catch (_) {
    return memoryFallback;
  }
}

function saveRealResult(item) {
  const list = getHistory();
  list.unshift(item);
  const trimmed = list.slice(0, 60);
  memoryFallback = trimmed;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {}
  renderHistory();
}

function renderHistory() {
  const all = getHistory();
  const filtered = all.filter((x) => {
    if (state.filter === 'all') return true;
    if (state.filter === 'timed') return x.limitType === 'timed';
    return x.modeKey === state.filter;
  });

  const bestS = all.filter((x) => x.modeKey === 'single').reduce((m, x) => Math.max(m, x.score || 0), 0);
  const bestM = all.filter((x) => x.modeKey === 'multi').reduce((m, x) => Math.max(m, x.score || 0), 0);
  el.bestSingleVal.textContent = bestS ? `${bestS.toLocaleString('ru-RU')} PTS` : '—';
  el.bestMultiVal.textContent = bestM ? `${bestM.toLocaleString('ru-RU')} PTS` : '—';

  el.historyTableBody.innerHTML = '';
  if (filtered.length === 0) {
    el.historyTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-history">
          Записей для выбранного фильтра пока нет. Запустите бенчмарк, чтобы сохранить реальный результат.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((row, idx) => {
    const badgeText = row.resultBadge || `${Number(row.score).toLocaleString('ru-RU')} PTS`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <strong>${escapeHtml(row.device)}</strong>
        <div style="font-size:0.74rem;color:#7e92b2">${escapeHtml(row.os)}</div>
      </td>
      <td>${escapeHtml(row.modeLabel)}</td>
      <td>${escapeHtml(row.task)}</td>
      <td>${row.timeSec} с</td>
      <td>${escapeHtml(row.speed)}</td>
      <td><span class="score-pill">${escapeHtml(badgeText)}</span></td>
      <td style="color:#7e92b2;font-size:0.78rem">${escapeHtml(row.date)}</td>
    `;
    el.historyTableBody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// 7. Обработчики интерфейса, пресетов и ручного ввода
el.openModalBtn.addEventListener('click', () => el.infoModal.classList.remove('hidden'));
el.closeModalBtn.addEventListener('click', () => el.infoModal.classList.add('hidden'));
el.understandBtn.addEventListener('click', () => el.infoModal.classList.add('hidden'));
el.infoModal.addEventListener('click', (e) => {
  if (e.target === el.infoModal) el.infoModal.classList.add('hidden');
});

// Переключение Single-Core / Multi-Core
el.modeTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-tab');
  if (!btn || state.running) return;
  el.modeTabs.querySelectorAll('.mode-tab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.mode = btn.dataset.mode;
  updateControlsVisibility();
});

// Переключение Фиксированный объём / Ограничение по времени
el.limitTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.limit-tab');
  if (!btn || state.running) return;
  el.limitTabs.querySelectorAll('.limit-tab').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.limitType = btn.dataset.limit;
  updateControlsVisibility();
});

// Выбор пресета Single-Core
el.digitsPresets.addEventListener('click', (e) => {
  const btn = e.target.closest('.pill-btn');
  if (!btn || state.running) return;
  el.digitsPresets.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.digits = parseInt(btn.dataset.digits, 10);
  el.singleCustomInput.value = state.digits;
  el.singleDigitsLabel.textContent = `${state.digits.toLocaleString('ru-RU')} знаков`;
});

// Ручной ввод Single-Core
el.singleCustomInput.addEventListener('input', (e) => {
  if (state.running) return;
  const val = parseInt(e.target.value, 10);
  if (!isNaN(val) && val > 0) {
    state.digits = val;
    el.singleDigitsLabel.textContent = `${val.toLocaleString('ru-RU')} знаков`;
    el.digitsPresets.querySelectorAll('.pill-btn').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.digits, 10) === val);
    });
  }
});

// Ползунок потоков Multi-Core
el.threadsSlider.addEventListener('input', (e) => {
  if (state.running) return;
  state.threads = parseInt(e.target.value, 10);
  el.threadsCountLabel.textContent = `${state.threads} потоков`;
  updateControlsVisibility();
});

// Выбор пресета Multi-Core
el.multiPresets.addEventListener('click', (e) => {
  const btn = e.target.closest('.pill-btn');
  if (!btn || state.running) return;
  el.multiPresets.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.multiIterations = parseInt(btn.dataset.iter, 10);
  el.multiCustomInput.value = state.multiIterations;
  el.multiIterLabel.textContent = formatIterText(state.multiIterations);
});

// Ручной ввод Multi-Core
el.multiCustomInput.addEventListener('input', (e) => {
  if (state.running) return;
  const val = parseInt(e.target.value, 10);
  if (!isNaN(val) && val > 0) {
    state.multiIterations = val;
    el.multiIterLabel.textContent = formatIterText(val);
    el.multiPresets.querySelectorAll('.pill-btn').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.iter, 10) === val);
    });
  }
});

// Выбор пресета Времени (Таймер)
el.timePresets.addEventListener('click', (e) => {
  const btn = e.target.closest('.pill-btn');
  if (!btn || state.running) return;
  el.timePresets.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.durationSec = parseInt(btn.dataset.sec, 10);
  el.timeCustomInput.value = state.durationSec;
  el.timeDurationLabel.textContent = formatDurationLabel(state.durationSec);
});

// Ручной ввод Времени (Таймер)
el.timeCustomInput.addEventListener('input', (e) => {
  if (state.running) return;
  const val = parseFloat(e.target.value);
  if (!isNaN(val) && val > 0) {
    state.durationSec = val;
    el.timeDurationLabel.textContent = formatDurationLabel(val);
    el.timePresets.querySelectorAll('.pill-btn').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.sec, 10) === val);
    });
  }
});

el.startBtn.addEventListener('click', startBenchmark);
el.stopBtn.addEventListener('click', abortBenchmark);

el.copyPiBtn.addEventListener('click', () => {
  navigator.clipboard?.writeText(el.piPreviewText.textContent.trim());
  el.copyPiBtn.textContent = 'Скопировано!';
  setTimeout(() => (el.copyPiBtn.textContent = 'Копировать π'), 1500);
});

el.historyFilter.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  el.historyFilter.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.filter = btn.dataset.filter;
  renderHistory();
});

el.clearHistoryBtn.addEventListener('click', () => {
  memoryFallback = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  renderHistory();
});

el.exportJsonBtn.addEventListener('click', () => {
  const list = getHistory();
  if (!list.length) return alert('История замеров пока пуста!');
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pimark-pro-results.json';
  a.click();
});

// Инициализация
startFpsMonitor();
detectDeviceProfile();
renderHistory();
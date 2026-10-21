// Фоновый поток PiMark v2.5 PRO (Поддерживает фиксированный объём И ограничение по времени)
self.onmessage = function (e) {
  const { mode, limitType, workerId, digits, iterations, durationMs } = e.data;
  const startTime = performance.now();

  // =========================================================================
  // ВАРИАНТ А: ТЕСТ С ОГРАНИЧЕНИЕМ ПО ВРЕМЕНИ (TIMED MODE)
  // =========================================================================
  if (limitType === 'timed') {
    const deadline = startTime + durationMs;

    if (mode === 'single') {
      // Single-Core Timed: Считаем знаки Пи методом Мэчина (BigInt) эталонными блоками по 10 000 знаков,
      // проверяя таймер каждые 15 шагов, чтобы остановиться ровно по истечении времени.
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
              if (now >= deadline) {
                timeUp = true;
                break;
              }
              if (now - lastReportTime >= 90) {
                lastReportTime = now;
                const partialDigits = Math.floor((stepsInCurrentBlock / totalStepsPerBlock) * blockDigits);
                const currentTotal = totalComputedDigits + partialDigits;
                const timeProgress = Math.min(99, Math.floor(((now - startTime) / durationMs) * 100));
                self.postMessage({
                  type: 'progress',
                  workerId,
                  progress: timeProgress,
                  workDone: currentTotal
                });
              }
            }
          }
          return sum;
        }

        const p1 = arccotTimed(5n, scale);
        let p2 = 0n;
        if (!timeUp) {
          p2 = arccotTimed(239n, scale);
        }

        if (!timeUp) {
          totalComputedDigits += blockDigits;
          const piBig = 4n * (4n * p1 - p2);
          const piStr = (piBig / (10n ** BigInt(guard))).toString();
          lastPiSample = piStr.slice(0, 1) + '.' + piStr.slice(1, 65) + ' ... ' + piStr.slice(-45);
        } else {
          const partialDigits = Math.floor((stepsInCurrentBlock / totalStepsPerBlock) * blockDigits);
          totalComputedDigits += partialDigits;
          break;
        }
      }

      self.postMessage({
        type: 'done',
        workerId,
        durationMs: performance.now() - startTime,
        workDone: Math.max(10, totalComputedDigits),
        sample: lastPiSample
      });
      return;
    } else {
      // Multi-Core Timed: Непрерывный расчёт рядов Нилаканты/BBP на всех потоках до истечения таймера
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
        if (now >= deadline) {
          break;
        }
        if (now - lastReportTime >= 90) {
          lastReportTime = now;
          const timeProgress = Math.min(99, Math.floor(((now - startTime) / durationMs) * 100));
          self.postMessage({
            type: 'progress',
            workerId,
            progress: timeProgress,
            workDone: completedIter
          });
        }
      }

      self.postMessage({
        type: 'done',
        workerId,
        durationMs: performance.now() - startTime,
        workDone: completedIter,
        sample: acc.toFixed(15) + ' (контрольная сумма потока #' + (workerId + 1) + ')'
      });
      return;
    }
  }

  // =========================================================================
  // ВАРИАНТ Б: ФИКСИРОВАННЫЙ ОБЪЁМ ЗАДАЧИ (FIXED MODE)
  // =========================================================================
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

    const formatted =
      piStr.length > 110
        ? piStr.slice(0, 1) + '.' + piStr.slice(1, 65) + ' ... ' + piStr.slice(-45)
        : piStr.slice(0, 1) + '.' + piStr.slice(1);

    self.postMessage({
      type: 'done',
      workerId,
      durationMs: performance.now() - startTime,
      workDone: digits,
      sample: formatted
    });
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
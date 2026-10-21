// Фоновый поток PiMark v2.4 PRO (Поддерживает произвольное число знаков и итераций)
self.onmessage = function (e) {
  const { mode, workerId, digits, iterations } = e.data;
  const startTime = performance.now();

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
          self.postMessage({ type: 'progress', workerId, progress });
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
        self.postMessage({ type: 'progress', workerId, progress });
      }
    }

    self.postMessage({
      type: 'done',
      workerId,
      durationMs: performance.now() - startTime,
      sample: acc.toFixed(15) + ' (контрольная сумма потока #' + (workerId + 1) + ')'
    });
  }
};
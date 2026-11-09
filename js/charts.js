export function clearCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

export function drawLineChart(canvas, series, options = {}) {
  const ctx = clearCanvas(canvas);
  const w = canvas.width, h = canvas.height;
  const pad = 30;
  const all = series.flatMap(s => s.data);
  if (all.length === 0) return;
  let minY = Math.min(...all), maxY = Math.max(...all);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const n = Math.max(...series.map(s => s.data.length));
  ctx.strokeStyle = options.gridColor || 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  // grid horizontal
  for (let i = 0; i <= 4; i++) {
    const y = pad + (h - 2*pad) * i / 4;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
  }
  for (const s of series) {
    ctx.strokeStyle = s.color || '#f5c542';
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.data.forEach((v, i) => {
      const x = pad + (w - 2*pad) * (i / Math.max(1, s.data.length - 1));
      const y = pad + (h - 2*pad) * (1 - (v - minY) / (maxY - minY));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  // labels
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '10px system-ui';
  ctx.fillText(minY.toFixed(2), 2, h - pad);
  ctx.fillText(maxY.toFixed(2), 2, pad + 10);
  if (options.title) {
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 12px system-ui';
    ctx.fillText(options.title, pad, 14);
  }
}

export function drawBarChart(canvas, labels, values, options = {}) {
  const ctx = clearCanvas(canvas);
  const w = canvas.width, h = canvas.height;
  const pad = 30;
  const max = Math.max(...values, 1);
  const bw = (w - 2*pad) / values.length;
  values.forEach((v, i) => {
    const bh = (h - 2*pad) * (v / max);
    const x = pad + i * bw + bw * 0.1;
    const y = h - pad - bh;
    ctx.fillStyle = options.color || '#f5c542';
    ctx.fillRect(x, y, bw * 0.8, bh);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '9px system-ui';
  labels.forEach((lab, i) => {
    const x = pad + i * bw + bw * 0.1;
    ctx.fillText(String(lab).slice(0, 8), x, h - 12);
  });
  if (options.title) {
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 12px system-ui';
    ctx.fillText(options.title, pad, 14);
  }
}

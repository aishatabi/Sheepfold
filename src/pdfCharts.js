// Renders simple bar/line charts to a canvas and returns a PNG data URL,
// which gets embedded into the PDF via doc.addImage(). No chart library
// needed — keeps the app bundle small.

const FONT = 'Helvetica, Arial, sans-serif';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

export function makeBarChartDataUrl({ labels, values, colors, title }) {
  const width = 1000, height = 480;
  const { canvas, ctx } = makeCanvas(width, height);
  const padding = { top: title ? 70 : 30, right: 40, bottom: 70, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(1, ...values);

  if (title) {
    ctx.fillStyle = '#2A2A24';
    ctx.font = `bold 28px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(title, 30, 44);
  }

  // gridlines
  ctx.strokeStyle = '#E6E9E0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + chartH - (chartH * i) / 4;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + chartW, y); ctx.stroke();
  }
  ctx.strokeStyle = '#182B20';
  ctx.beginPath(); ctx.moveTo(padding.left, padding.top); ctx.lineTo(padding.left, padding.top + chartH); ctx.lineTo(padding.left + chartW, padding.top + chartH); ctx.stroke();

  const gap = 40;
  const barW = (chartW - gap * (values.length - 1)) / values.length;
  values.forEach((v, i) => {
    const barH = (v / maxVal) * chartH;
    const x = padding.left + i * (barW + gap);
    const y = padding.top + chartH - barH;
    ctx.fillStyle = colors[i] || '#3E6B48';
    ctx.fillRect(x, y, barW, Math.max(barH, 1));

    ctx.fillStyle = '#2A2A24';
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(v), x + barW / 2, y - 12);

    ctx.fillStyle = '#6B675A';
    ctx.font = `20px ${FONT}`;
    ctx.fillText(labels[i], x + barW / 2, padding.top + chartH + 34);
  });

  return canvas.toDataURL('image/png');
}

export function makeLineChartDataUrl({ labels, values, title, color = '#3E6B48', yMax = 100, yLabel = '%' }) {
  const width = 1000, height = 480;
  const { canvas, ctx } = makeCanvas(width, height);
  const padding = { top: title ? 70 : 30, right: 40, bottom: 80, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (title) {
    ctx.fillStyle = '#2A2A24';
    ctx.font = `bold 28px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(title, 30, 44);
  }

  ctx.strokeStyle = '#E6E9E0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + chartH - (chartH * i) / 4;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + chartW, y); ctx.stroke();
    ctx.fillStyle = '#6B675A';
    ctx.font = `18px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round((yMax * i) / 4)}${yLabel}`, padding.left - 10, y + 6);
  }
  ctx.strokeStyle = '#182B20';
  ctx.beginPath(); ctx.moveTo(padding.left, padding.top); ctx.lineTo(padding.left, padding.top + chartH); ctx.lineTo(padding.left + chartW, padding.top + chartH); ctx.stroke();

  if (values.length === 0) {
    ctx.fillStyle = '#6B675A';
    ctx.font = `20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('No data in this date range', padding.left + chartW / 2, padding.top + chartH / 2);
    return canvas.toDataURL('image/png');
  }

  const stepX = values.length > 1 ? chartW / (values.length - 1) : 0;
  const points = values.map((v, i) => ({
    x: padding.left + (values.length > 1 ? i * stepX : chartW / 2),
    y: padding.top + chartH - (Math.min(v, yMax) / yMax) * chartH,
  }));

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  points.forEach(p => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  });

  // thin x labels so they don't overlap when there are many dates
  const maxLabels = 8;
  const everyN = Math.max(1, Math.ceil(labels.length / maxLabels));
  ctx.fillStyle = '#6B675A';
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    if (i % everyN !== 0 && i !== labels.length - 1) return;
    ctx.save();
    ctx.translate(points[i].x, padding.top + chartH + 26);
    ctx.rotate(labels.length > 6 ? -Math.PI / 5 : 0);
    ctx.textAlign = labels.length > 6 ? 'right' : 'center';
    ctx.fillText(l, 0, 0);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

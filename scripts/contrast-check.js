function hex(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lin(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function L(h) {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const x = L(a), y = L(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const pairs = [
  ['#dbeafe', '#0d1a2e', 'btn'],
  ['#dbeafe', '#0f1f39', 'btn hover'],
  ['#a5b4fc', '#0b1324', 'step text?'],
  ['#a5b4fc', '#0e1a2e', 'step .n'],
  ['#a5b4fc', '#0d1a2e', 'pill'],
  ['#94a3b8', '#0b1220', 'muted bg'],
  ['#94a3b8', '#0f172a', 'muted card'],
  ['#94a3b8', '#0b1324', 'muted soft'],
  ['#94a3b8', '#111827', 'muted bg2'],
  ['#9aa5b1', '#0b1220', 'core muted'],
  ['#9aa5b1', '#0f172a', 'core muted card'],
  ['#9aa5b1', '#0b1324', 'core muted soft'],
  ['#cbd5e1', '#0d1a2e', 'label'],
  ['#93a3b5', '#0b1220', 'footer'],
  ['#a3b2c4', '#0f172a', 'inline'],
  ['#a8b6c7', '#0f172a', 'cand muted'],
  ['#b6c2d0', '#0f172a', 'cand muted2'],
  ['#c0cad6', '#0f172a', 'cand muted3'],
  ['#c7d2e0', '#0b1324', 'cand muted4'],
  ['#c4d0de', '#0e1a2e', 'cand on surface'],
  ['#bfdbfe', '#0d1a2e', 'btn cand'],
  ['#e2e8f0', '#0d1a2e', 'btn text cand'],
  ['#c7d2fe', '#0e1a2e', 'step n cand'],
  ['#a5b4fc', '#0c1629', 'thead'],
  ['#475569', '#ffffff', 'light muted'],
  ['#475569', '#f0f4fa', 'light soft'],
  ['#334155', '#ffffff', 'light muted strong'],
  ['#0f172a', '#0b1220', 'light text on dark bg'],
];

for (const [fg, bg, name] of pairs) {
  const r = ratio(fg, bg);
  console.log(`${r >= 4.5 ? 'PASS' : 'FAIL'} ${r.toFixed(2)}  ${name}  ${fg} on ${bg}`);
}

const extra = [
  ['#94a3b8', '#ffffff', 'embedded footer'],
  ['#94a3b8', '#fafafa', 'step embedded'],
  ['#475569', '#0b1220', 'light muted on dark bg'],
  ['#475569', '#0f172a', 'light muted on card'],
  ['#0f172a', '#0b1324', 'light text on step'],
  ['#0f172a', '#0d1a2e', 'light text on btn bg'],
  ['#dbeafe', '#ffffff', 'btn text on white'],
  ['#dbeafe', '#f4f7fb', 'btn on light bg'],
  ['#a5b4fc', '#ffffff', 'pill on white'],
  ['#22c55e', '#0b1220', 'accent green'],
  ['#f59e0b', '#0b1220', 'warn'],
];
console.log('--- extra ---');
for (const [fg, bg, name] of extra) {
  const r = ratio(fg, bg);
  console.log(`${r >= 4.5 ? 'PASS' : 'FAIL'} ${r.toFixed(2)}  ${name}`);
}

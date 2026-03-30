/* =============================================
   script.js — Temperature & Air Quality Monitor
   ============================================= */

'use strict';

// ── CONFIG DEFAULT ──
const THRESHOLDS = {
  lm:  { min: 24, max: 30,   unit: '°C',  label: 'Suhu LM35' },
  dht: { min: 24, max: 30,   unit: '°C',  label: 'Suhu DHT22' },
  hum: { min: 0,  max: 80,   unit: '%',   label: 'Kelembapan' },
  co2: { min: 350, max: 1000, unit: 'ppm', label: 'CO₂' },
};

// ── STATE ──
let fetchInterval = null;
let isRunning     = false;
let currentChart  = 'lm';
let chartInstance = null;
let historyData   = [];

// ── DOM REFS ──
const el = {
  apiUrl:    document.getElementById('apiUrl'),
  interval:  document.getElementById('intervalInput'),
  btnStart:  document.getElementById('btnStart'),
  btnStop:   document.getElementById('btnStop'),
  logStatus: document.getElementById('logStatus'),
  statusDot: document.getElementById('statusDot'),
  lastUpdate:document.getElementById('lastUpdate'),
  tableMeta: document.getElementById('tableMeta'),
  tableBody: document.getElementById('tableBody'),
  alert:     document.getElementById('alertOverlay'),
  alertDetail: document.getElementById('alertDetail'),
};

// ── CLOCK ──
function tickClock() {
  const now = new Date();
  document.getElementById('clockDisplay').textContent =
    now.toLocaleTimeString('id-ID', { hour12: false });
  document.getElementById('dateDisplay').textContent =
    now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
setInterval(tickClock, 1000);
tickClock();

// ── CHART INIT ──
function initChart() {
  const ctx = document.getElementById('sensorChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, 'rgba(0, 212, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: '',
        data: [],
        borderColor: '#00d4ff',
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#00d4ff',
        pointBorderColor: '#0b0d0f',
        pointBorderWidth: 1.5,
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161a1e',
          borderColor: '#2a2f36',
          borderWidth: 1,
          titleColor: '#7a8694',
          bodyColor: '#e8edf2',
          titleFont: { family: 'Share Tech Mono', size: 11 },
          bodyFont:  { family: 'Share Tech Mono', size: 13 },
          padding: 10,
        }
      },
      scales: {
        x: {
          grid:   { color: 'rgba(42,47,54,0.6)', drawBorder: false },
          ticks:  { color: '#7a8694', font: { family: 'Share Tech Mono', size: 10 }, maxTicksLimit: 10, maxRotation: 0 },
        },
        y: {
          grid:   { color: 'rgba(42,47,54,0.6)', drawBorder: false },
          ticks:  { color: '#7a8694', font: { family: 'Share Tech Mono', size: 11 } },
          beginAtZero: false,
        }
      }
    }
  });
}

// ── UPDATE CHART ──
function updateChart() {
  if (!chartInstance || historyData.length === 0) return;

  const keyMap = { lm: 'tempLM', dht: 'tempDHT', hum: 'hum', co2: 'co2' };
  const key    = keyMap[currentChart];
  const cfg    = THRESHOLDS[currentChart];

  const labels = historyData.map(d => d.waktu);
  const values = historyData.map(d => d[key]);

  // Color based on any value out of threshold
  const anyBad = values.some(v => v < cfg.min || v > cfg.max);
  const color  = anyBad ? '#ff3a3a' : '#00d4ff';

  const ctx = document.getElementById('sensorChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 260);
  gradient.addColorStop(0, anyBad ? 'rgba(255,58,58,0.22)' : 'rgba(0,212,255,0.22)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  chartInstance.data.labels = labels;
  chartInstance.data.datasets[0].data          = values;
  chartInstance.data.datasets[0].label         = `${cfg.label} (${cfg.unit})`;
  chartInstance.data.datasets[0].borderColor   = color;
  chartInstance.data.datasets[0].backgroundColor = gradient;
  chartInstance.data.datasets[0].pointBackgroundColor = color;
  chartInstance.update('active');
}

// ── FETCH DATA ──
async function fetchData() {
  const url = el.apiUrl.value.trim();
  if (!url) {
    showLogStatus('URL kosong!', 'stopped');
    return;
  }

  try {
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();

    if (json.status === 'kosong' || !json.latest) return;

    const { latest, history } = json;
    historyData = history;

    renderCards(latest);
    renderTable(history);
    updateChart();

    el.lastUpdate.textContent = 'Terakhir update: ' + new Date().toLocaleTimeString('id-ID');

  } catch (err) {
    console.error('Fetch error:', err);
    showLogStatus('● ERROR: ' + err.message, 'stopped');
  }
}

// ── RENDER SENSOR CARDS ──
function renderCards(d) {
  const sensors = [
    { key: 'lm',  val: d.tempLM,  cfg: THRESHOLDS.lm },
    { key: 'dht', val: d.tempDHT, cfg: THRESHOLDS.dht },
    { key: 'hum', val: d.hum,     cfg: THRESHOLDS.hum },
    { key: 'co2', val: d.co2,     cfg: THRESHOLDS.co2 },
  ];

  const warnings = [];

  sensors.forEach(({ key, val, cfg }) => {
    const card      = document.getElementById(`card-${key}`);
    const valEl     = document.getElementById(`val-${key}`);
    const statusEl  = document.getElementById(`status-${key}`);
    const barEl     = document.getElementById(`bar-${key}`);

    const isNormal = (val >= cfg.min && val <= cfg.max);

    // Display value
    valEl.textContent = key === 'co2'
      ? Math.round(val)
      : val.toFixed(1);

    // Card class
    card.classList.remove('normal', 'warning');
    card.classList.add(isNormal ? 'normal' : 'warning');

    // Status text
    statusEl.textContent = isNormal ? '✓ NORMAL' : '✗ TIDAK NORMAL';

    // Progress bar — percent relative to double the max
    const barMax = cfg.max * 1.4;
    const pct    = Math.min(100, (val / barMax) * 100);
    barEl.style.width = pct + '%';

    if (!isNormal) {
      const dir = val < cfg.min ? 'rendah' : 'tinggi';
      warnings.push(`${cfg.label}: ${val}${cfg.unit} (terlalu ${dir})`);
    }
  });

  // Alert overlay
  if (warnings.length > 0) {
    el.alertDetail.textContent = warnings.join('  |  ');
    el.alert.classList.remove('hidden');
  } else {
    el.alert.classList.add('hidden');
  }
}

// ── RENDER TABLE ──
function renderTable(history) {
  if (!history || history.length === 0) return;

  el.tableMeta.textContent = `${history.length} entri`;

  const rows = [...history].reverse(); // newest first
  el.tableBody.innerHTML = rows.map((d, i) => {
    const isNormal =
      (d.tempLM  >= 24 && d.tempLM  <= 29) &&
      (d.tempDHT >= 24 && d.tempDHT <= 29) &&
      (d.hum     < 80) &&
      (d.co2     >= 400 && d.co2 <= 1000);

    const statusTxt = isNormal ? 'NORMAL' : 'TIDAK NORMAL';
    const statusCls = isNormal ? 'ok' : 'bad';
    const rowCls    = isNormal ? '' : 'row-warning';

    return `
      <tr class="${rowCls}">
        <td>${rows.length - i}</td>
        <td>${d.tanggal}</td>
        <td>${d.waktu}</td>
        <td>${parseFloat(d.tempLM).toFixed(1)}</td>
        <td>${parseFloat(d.tempDHT).toFixed(1)}</td>
        <td>${parseFloat(d.hum).toFixed(1)}</td>
        <td>${Math.round(d.co2)}</td>
        <td class="status-cell ${statusCls}">${statusTxt}</td>
      </tr>`;
  }).join('');
}

// ── LOG STATUS HELPER ──
function showLogStatus(msg, cls) {
  el.logStatus.textContent  = msg;
  el.logStatus.className    = 'log-status ' + (cls || '');
}

// ── START / STOP ──
el.btnStart.addEventListener('click', () => {
  const url = el.apiUrl.value.trim();
  if (!url) {
    alert("https://script.google.com/macros/s/AKfycbzUoxMSPIKsXnfeX9ZncLbdraos9srYLCUbwYud_VFzcv6wy50Laf_elrIzqcrnXbrgqQ/exec");
    return;
  }

  const secs = Math.max(2, parseInt(el.interval.value) || 5);
  el.interval.value = secs;

  isRunning = true;
  el.btnStart.disabled = true;
  el.btnStop.disabled  = false;
  el.statusDot.classList.add('active');
  showLogStatus('● LOGGING', 'running');

  fetchData(); // langsung fetch pertama kali
  fetchInterval = setInterval(fetchData, secs * 1000);
});

el.btnStop.addEventListener('click', () => {
  clearInterval(fetchInterval);
  fetchInterval = null;
  isRunning = false;

  el.btnStart.disabled = false;
  el.btnStop.disabled  = true;
  el.statusDot.classList.remove('active');
  el.alert.classList.add('hidden');
  showLogStatus('■ STOPPED', 'stopped');
});

// ── CHART TAB SWITCH ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentChart = btn.dataset.chart;
    updateChart();
  });
});

// ── INIT ──
initChart();
showLogStatus('● IDLE');
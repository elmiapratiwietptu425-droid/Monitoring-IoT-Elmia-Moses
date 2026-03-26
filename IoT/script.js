const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwixkYgfpqgQ7WHoCndam8IknX5ynvMEds97S3bZFjOGA5jZbK6c5zHyt-I7Ky1E4mXGA/exec"; 

let mainChart, fullHistory = [], isLogging = false, logIntervalId = null;
let activeSensor = 'tempDHT';
let lastSeenData = { t: "-", w: "-" };

// 1. Fungsi Ambil Data (Hanya dijalankan saat Timer berbunyi)
async function fetchData() {
    if (!isLogging) return;
    
    try {
        console.log("Menghubungi Spreadsheet...");
        const res = await fetch(SCRIPT_URL);
        const json = await res.json();
        
        if (json.history) {
            fullHistory = json.history;
            lastSeenData.t = json.latest.tanggal;
            lastSeenData.w = json.latest.waktu;
            
            updateDashboard(json.latest);
            renderVisuals(fullHistory);
            console.log("Data berhasil diperbarui pada: " + lastSeenData.w);
        }
    } catch (e) { 
        console.error("Gagal mengambil data. Cek koneksi internet atau URL Script."); 
    }
}

// 2. Logika Tombol START
document.getElementById('btn-start').onclick = () => {
    // Ambil angka interval terbaru dari kotak input saat tombol diklik
    const intervalDetik = parseInt(document.getElementById('interval-input').value);
    
    if (isNaN(intervalDetik) || intervalDetik < 1) {
        alert("Masukkan angka interval yang valid (minimal 1 detik)!");
        return;
    }

    isLogging = true;
    
    // Update Tampilan Status
    document.getElementById('status-badge').className = "badge-connected";
    document.getElementById('status-text').innerText = "Connected";
    document.getElementById('update-status').innerText = "Sistem sedang mengambil data...";
    
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-stop').disabled = false;

    // JALANKAN SEGERA (Tanpa tunggu delay pertama)
    fetchData();

    // SET TIMER BARU (Ini yang bikin mandiri)
    // Jika input 10, maka fetchData akan dipanggil setiap 10.000 milidetik
    logIntervalId = setInterval(fetchData, intervalDetik * 1000);
};

// 3. Logika Tombol STOP
document.getElementById('btn-stop').onclick = () => {
    isLogging = false;
    
    // HAPUS TIMER (Wajib agar tidak jalan terus di latar belakang)
    if (logIntervalId) {
        clearInterval(logIntervalId);
        logIntervalId = null;
    }
    
    // Update Tampilan Status
    document.getElementById('status-badge').className = "badge-disconnected";
    document.getElementById('status-text').innerText = "Disconnected";
    document.getElementById('update-status').innerText = `Data terakhir: ${lastSeenData.t} ${lastSeenData.w}`;
    
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled = true;
};

// --- FUNGSI PENDUKUNG (Dashboard, Grafik, Tabel, Salju) ---

function updateDashboard(latest) {
    document.getElementById('val-tempLM').innerText = latest.tempLM;
    document.getElementById('val-tempDHT').innerText = latest.tempDHT;
    document.getElementById('val-hum').innerText = latest.hum;
    document.getElementById('val-co2').innerText = latest.co2;
}

function renderVisuals(data) {
    const slice = data.slice(-15);
    mainChart.data.labels = slice.map(d => d.waktu);
    mainChart.data.datasets[0].data = slice.map(d => d[activeSensor]);
    mainChart.update();

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = [...data].reverse().slice(0, 15).map(row => `
        <tr>
            <td>${row.tanggal}</td><td>${row.waktu}</td>
            <td>${row.tempLM}</td><td>${row.tempDHT}</td>
            <td>${row.hum}</td><td>${row.co2}</td>
        </tr>
    `).join('');
}

function switchSensor(s, c) {
    activeSensor = s;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    mainChart.data.datasets[0].borderColor = c;
    renderVisuals(fullHistory);
}

function createSnow() {
    const container = document.getElementById('snow-container');
    if(!container) return;
    for (let i = 0; i < 40; i++) {
        let flake = document.createElement('div');
        flake.className = 'snowflake';
        let size = Math.random() * 4 + 2;
        flake.style.width = size + 'px'; flake.style.height = size + 'px';
        flake.style.left = Math.random() * 100 + 'vw';
        flake.style.animationDuration = Math.random() * 3 + 4 + 's';
        flake.style.animationDelay = Math.random() * 5 + 's';
        container.appendChild(flake);
    }
}

window.onload = () => {
    createSnow();
    const ctx = document.getElementById('mainChart').getContext('2d');
    mainChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#FFB7B2', tension: 0.4, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
};
// Elementy DOM
const video = document.getElementById('camera');
const canvas = document.getElementById('grid');
const scanButton = document.getElementById('scanButton');
const colorOutput = document.getElementById('colorOutput');
const instruction = document.getElementById('instruction');

// Rozmiar siatki
const gridSize = 3;
const cellSize = 100;
const margin = 20;
const width = gridSize * cellSize + 2 * margin;
const height = gridSize * cellSize + 2 * margin;

// Kontekst canvas
const ctx = canvas.getContext('2d');
canvas.width = width;
canvas.height = height;

// Kolejność ścian zgodnie z algorytmem Kociemby
const kociembaOrder = ["U", "R", "F", "D", "L", "B"];
const faceLetters = {
    "U": "żółty",
    "R": "zielony",
    "F": "czerwony",
    "D": "biały",
    "L": "niebieski",
    "B": "pomarańczowy"
};

let remainingScans = 6;
let results = {};
let isScanning = false;

// Uruchomienie kamery
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
    } catch (error) {
        console.error("Błąd dostępu do kamery:", error);
        instruction.textContent = "Nie można uzyskać dostępu do kamery.";
    }
}

// Rysowanie siatki
function drawGrid() {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = 1; i < gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(margin + i * cellSize, margin);
        ctx.lineTo(margin + i * cellSize, height - margin);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(margin, margin + i * cellSize);
        ctx.lineTo(width - margin, margin + i * cellSize);
        ctx.stroke();
    }
}

// Pobranie kolorów z siatki
function scanColors() {
    const colors = [];
    for (let y = 0; y < gridSize; y++) {
        const row = [];
        for (let x = 0; x < gridSize; x++) {
            const startX = margin + x * cellSize + cellSize / 2;
            const startY = margin + y * cellSize + cellSize / 2;
            const imageData = ctx.getImageData(startX, startY, 1, 1).data;
            row.push(rgbToHsl(imageData[0], imageData[1], imageData[2]));
        }
        colors.push(row);
    }
    return colors;
}

// Konwersja RGB na HSL
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

// Mapowanie HSL na litery Kociemby
function mapToKociembaLetter(hsl) {
    const [h, s, l] = hsl;
    if (l > 85 && s < 15) return "D";
    if (h >= 40 && h <= 70) return "U";
    if (h >= 80 && h <= 160) return "R";
    if ((h >= 0 && h <= 20) || (h >= 340 && h <= 360)) return "F";
    if (h >= 200 && h <= 260) return "L";
    if (h >= 20 && h <= 40) return "B";
    return "?";
}

// Generowanie ciągu dla algorytmu Kociemby
function generateKociembaString(results) {
    return kociembaOrder.map(face => results[face].flat().join('')).join('');
}

// Aktualizacja wyświetlania zeskanowanych ścian
function updateScannedFaces() {
    colorOutput.innerHTML = `<h2>Zeskanowane ściany:</h2><p>${Object.keys(results).map(face => faceLetters[face]).join(', ')}</p>`;
}

// Główna pętla renderowania
function render() {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);
    drawGrid();
    requestAnimationFrame(render);
}

// Obsługa przycisku "Skanuj"
scanButton.addEventListener('click', () => {
    if (isScanning) return;
    isScanning = true;
    
    const hslValues = scanColors();
    const kociembaLetters = hslValues.map(row => row.map(mapToKociembaLetter));
    
    const centerLetter = kociembaLetters[1][1];
    if (!kociembaOrder.includes(centerLetter)) {
        colorOutput.innerHTML = `<h2>Błąd:</h2><p>Nie rozpoznano koloru środkowego kafelka.</p>`;
        isScanning = false;
        return;
    }
    
    results[centerLetter] = kociembaLetters;
    remainingScans--;
    instruction.textContent = `Pozostało do zeskanowania: ${remainingScans} ścian.`;
    updateScannedFaces();
    
    if (remainingScans === 0) {
        try {
            const resultString = generateKociembaString(results);
            colorOutput.innerHTML += `<h2>Wynik dla algorytmu Kociemby:</h2><pre>${resultString}</pre>`;
            video.style.display = "none";
            canvas.style.display = "none";
            scanButton.style.display = "none";
            instruction.textContent = "Wszystkie ściany zeskanowane!";
        } catch (error) {
            colorOutput.innerHTML = `<h2>Błąd:</h2><pre>${error.message}</pre>`;
        }
    }
    isScanning = false;
});

// Inicjalizacja
startCamera();
render();
instruction.textContent = `Pozostało do zeskanowania: ${remainingScans} ścian.`;

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
        const constraints = { video: { facingMode: "environment" } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
    } catch (error) {
        console.error("Błąd dostępu do kamery:", error);
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

// Wykrywanie kolorów w siatce
function scanColors() {
    const colors = [];
    for (let y = 0; y < gridSize; y++) {
        const row = [];
        for (let x = 0; x < gridSize; x++) {
            const startX = margin + x * cellSize + cellSize / 2;
            const startY = margin + y * cellSize + cellSize / 2;
            const imageData = ctx.getImageData(startX, startY, 10, 10).data;
            const color = getDominantColor(imageData);
            row.push(color);
        }
        colors.push(row);
    }
    return colors;
}

// Obliczanie dominującego koloru
function getDominantColor(imageData) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
    }
    const count = imageData.length / 4;
    return identifyColor(r / count, g / count, b / count);
}

// Konwersja RGB na HSL i identyfikacja koloru
function identifyColor(r, g, b) {
    [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.2 && l > 0.85) return "D";
    if (s < 0.2 && l < 0.15) return "X";
    if (h >= 45 && h < 70) return "U";
    if (h >= 0 && h < 15 || h >= 345) return "F";
    if (h >= 15 && h < 45) return "B";
    if (h >= 70 && h < 170) return "R";
    if (h >= 170 && h < 260) return "L";
    return "?";
}

// Generowanie wyniku dla algorytmu Kociemby
function generateKociembaString(results) {
    let kociembaString = "";
    for (const face of kociembaOrder) {
        if (!results[face]) {
            throw new Error(`Brak zeskanowanej ściany: ${faceLetters[face]}`);
        }
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                kociembaString += results[face][y][x];
            }
        }
    }
    return kociembaString;
}

// Aktualizacja wyświetlanych ścian
function updateScannedFaces() {
    const scannedFaces = Object.keys(results).map(face => faceLetters[face]).join(', ');
    colorOutput.innerHTML = `<h2>Zeskanowane ściany:</h2><p>${scannedFaces}</p>`;
}

// Obsługa skanowania
scanButton.addEventListener('click', () => {
    if (isScanning) return;
    isScanning = true;

    const colors = scanColors();
    const centerColor = colors[1][1];
    if (!kociembaOrder.includes(centerColor)) {
        colorOutput.innerHTML = `<h2>Błąd:</h2><p>Nie rozpoznano koloru środkowego kafelka.</p>`;
        isScanning = false;
        return;
    }
    results[centerColor] = colors;
    remainingScans--;
    instruction.textContent = `Pozostało do zeskanowania: ${remainingScans} ścian.`;
    updateScannedFaces();

    if (remainingScans === 0) {
        try {
            const resultString = generateKociembaString(results);
            colorOutput.innerHTML += `<h2>Wynik dla algorytmu Kociemby:</h2><pre>${resultString}</pre>`;
        } catch (error) {
            colorOutput.innerHTML = `<h2>Błąd:</h2><pre>${error.message}</pre>`;
        }
    }
    isScanning = false;
});

// Inicjalizacja
startCamera();
render();

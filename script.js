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

function mapToKociembaLetter(hsl) {
    const [h, s, l] = hsl;

    // **Biały** – wysoka jasność i niskie nasycenie
    if (l > 85 && s < 20) return "D"; 

    // **Żółty** – odcień 40-70, ale nie za jasny i nie za mało nasycony
    if (h >= 40 && h <= 70 && l < 85) return "U"; 

    // **Zielony** – 80-160
    if (h >= 80 && h <= 160) return "R"; 

    // **Czerwony** – odcień w zakresie 0-15 i 345-360 (unikając pomarańczowego)
    if ((h >= 0 && h <= 15) || (h >= 345 && h <= 360)) return "F"; 

    // **Pomarańczowy** – odcień 15-40 (węższy zakres, aby nie pokrywał się z czerwonym)
    if (h > 15 && h <= 40) return "B"; 

    // **Niebieski** – 200-260
    if (h >= 200 && h <= 260) return "L"; 

    return "?"; // Nieznany kolor
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

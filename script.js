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

let remainingScans = 6; // Liczba pozostałych ścian do zeskanowania
let results = {}; // Wyniki skanowania
let isScanning = false;

// Uruchomienie kamery (głównej)
async function startCamera() {
    try {
        const constraints = { video: { facingMode: "environment" } }; // Główna kamera
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
        // Linie pionowe
        ctx.beginPath();
        ctx.moveTo(margin + i * cellSize, margin);
        ctx.lineTo(margin + i * cellSize, height - margin);
        ctx.stroke();
        // Linie poziome
        ctx.beginPath();
        ctx.moveTo(margin, margin + i * cellSize);
        ctx.lineTo(width - margin, margin + i * cellSize);
        ctx.stroke();
    }
}

// Wykrywanie kolorów w siatce (tylko środek każdego pola)
function scanColors() {
    const colors = [];
    for (let y = 0; y < gridSize; y++) {
        const row = [];
        for (let x = 0; x < gridSize; x++) {
            const startX = margin + x * cellSize + cellSize / 2 - 5; // Środek pola (X)
            const startY = margin + y * cellSize + cellSize / 2 - 5; // Środek pola (Y)
            const imageData = ctx.getImageData(startX, startY, 10, 10).data; // Mały obszar (10x10 pikseli)
            const grayValue = getGrayValue(imageData); // Wartość w skali szarości
            row.push(grayValue);
        }
        colors.push(row);
    }
    return colors;
}

// Obliczanie wartości w skali szarości
function getGrayValue(imageData) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
    }
    const count = imageData.length / 4;
    const gray = Math.round((r + g + b) / (3 * count)); // Średnia wartość szarości
    return gray;
}

// Mapowanie wartości szarości na litery zgodnie z algorytmem Kociemby
function mapToKociembaLetter(grayValue) {
    // Zakresy szarości dla każdego koloru
    const grayRanges = {
        "U": { min: 200, max: 255 }, // Żółty (jasny)
        "D": { min: 200, max: 255 }, // Biały (jasny)
        "F": { min: 0, max: 100 },   // Czerwony (ciemny)
        "R": { min: 100, max: 150 }, // Zielony (średni)
        "L": { min: 50, max: 100 },  // Niebieski (ciemny)
        "B": { min: 150, max: 200 }  // Pomarańczowy (średni)
    };
    for (const [letter, range] of Object.entries(grayRanges)) {
        if (grayValue >= range.min && grayValue <= range.max) {
            return letter;
        }
    }
    return "?"; // Nieznany kolor
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

// Wyświetlanie zeskanowanych ścian
function updateScannedFaces() {
    const scannedFaces = Object.keys(results).map(face => faceLetters[face]).join(', ');
    colorOutput.innerHTML = `<h2>Zeskanowane ściany:</h2><p>${scannedFaces}</p>`;
}

// Główna pętla renderowania
function render() {
    // Wyczyść canvas
    ctx.clearRect(0, 0, width, height);

    // Narysuj obraz z kamery
    ctx.drawImage(video, 0, 0, width, height);

    // Narysuj siatkę
    drawGrid();

    // Kontynuuj renderowanie
    requestAnimationFrame(render);
}

// Obsługa przycisku "Skanuj"
scanButton.addEventListener('click', () => {
    if (isScanning) return; // Zapobiegaj wielokrotnemu skanowaniu

    isScanning = true;

    // Wykryj kolory z bieżącego obrazu
    const grayValues = scanColors();
    const kociembaLetters = grayValues.map(row => row.map(mapToKociembaLetter));

    // Określ, która ściana została zeskanowana (na podstawie środkowego kafelka)
    const centerLetter = kociembaLetters[1][1]; // Środkowy kafelek
    if (!kociembaOrder.includes(centerLetter)) {
        colorOutput.innerHTML = `<h2>Błąd:</h2><p>Nie rozpoznano koloru środkowego kafelka.</p>`;
        isScanning = false;
        return;
    }

    results[centerLetter] = kociembaLetters;

    // Zmniejsz liczbę pozostałych skanów
    remainingScans--;
    instruction.textContent = `Pozostało do zeskanowania: ${remainingScans} ścian.`;

    // Zaktualizuj listę zeskanowanych ścian
    updateScannedFaces();

    // Sprawdź, czy wszystkie ściany zostały zeskanowane
    if (remainingScans === 0) {
        try {
            // Generowanie wyniku dla algorytmu Kociemby
            const resultString = generateKociembaString(results);
            colorOutput.innerHTML += `<h2>Wynik dla algorytmu Kociemby:</h2><pre>${resultString}</pre>`;

            // Ukryj kamerę i siatkę
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

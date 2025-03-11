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

// Kolejność skanowania ścian zgodnie z Kociembą
const faces = [
    { name: "U", color: "żółty", center: [255, 255, 0] },    // Żółty (Up)
    { name: "R", color: "zielony", center: [0, 255, 0] },    // Zielony (Right)
    { name: "F", color: "czerwony", center: [255, 0, 0] },   // Czerwony (Front)
    { name: "D", color: "biały", center: [255, 255, 255] },  // Biały (Down)
    { name: "L", color: "niebieski", center: [0, 0, 255] },  // Niebieski (Left)
    { name: "B", color: "pomarańczowy", center: [255, 165, 0] } // Pomarańczowy (Back)
];

let currentFaceIndex = 0;
let results = {};
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

// Skanowanie wszystkich pól na ścianie
function scanFace() {
    const colors = [];
    for (let y = 0; y < gridSize; y++) {
        const row = [];
        for (let x = 0; x < gridSize; x++) {
            const startX = margin + x * cellSize + cellSize / 2;
            const startY = margin + y * cellSize + cellSize / 2;
            const imageData = ctx.getImageData(startX, startY, 1, 1).data; // Pobierz 1 piksel z centrum pola
            const color = mapToRubikColor([imageData[0], imageData[1], imageData[2]]);
            row.push(color);
        }
        colors.push(row);
    }
    return colors;
}

// Mapowanie kolorów na nazwy
function mapToRubikColor(color) {
    const rubikColors = {
        "czerwony": [255, 0, 0],
        "zielony": [0, 255, 0],
        "niebieski": [0, 0, 255],
        "pomarańczowy": [255, 165, 0],
        "żółty": [255, 255, 0],
        "biały": [255, 255, 255]
    };
    let minDistance = Infinity;
    let matchedColor = "nieznany";
    for (const [name, rgb] of Object.entries(rubikColors)) {
        const distance = Math.sqrt(
            Math.pow(color[0] - rgb[0], 2) +
            Math.pow(color[1] - rgb[1], 2) +
            Math.pow(color[2] - rgb[2], 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            matchedColor = name;
        }
    }
    return matchedColor[0].toUpperCase(); // Zwróć pierwszą literę koloru (np. "C" dla czerwonego)
}

// Generowanie ciągu dla algorytmu Kociemby
function generateKociembaString(results) {
    const order = ["U", "R", "F", "D", "L", "B"]; // Kolejność ścian
    let kociembaString = "";
    for (const face of order) {
        const colors = results[face];
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                kociembaString += colors[y][x]; // Dodaj kolor pola
            }
        }
    }
    return kociembaString;
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

    // Wykryj kolory na bieżącej ścianie
    const colors = scanFace();
    const currentFace = faces[currentFaceIndex];
    results[currentFace.name] = colors;

    // Wyświetl wyniki
    colorOutput.innerHTML = `<h2>Wykryte kolory (${currentFace.name}):</h2>` +
        colors.map(row => row.join(' ')).join('<br>');

    // Przejdź do następnej ściany
    currentFaceIndex++;
    if (currentFaceIndex < faces.length) {
        instruction.textContent = `Skanuj ścianę ${faces[currentFaceIndex].name}.`;
    } else {
        instruction.textContent = "Wszystkie ściany zeskanowane!";
        scanButton.disabled = true;

        // Generowanie wyniku dla algorytmu Kociemby
        const resultString = generateKociembaString(results);
        colorOutput.innerHTML += `<h2>Wynik dla algorytmu Kociemby:</h2><pre>${resultString}</pre>`;

        // Wyłącz kamerę
        video.srcObject.getTracks().forEach(track => track.stop());
        video.style.display = "none";
    }

    isScanning = false;
});

// Inicjalizacja
startCamera();
render();

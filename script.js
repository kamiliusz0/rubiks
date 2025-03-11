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

// Kolejność skanowania ścian
const faces = [
    { name: "czerwony", color: "red", center: [255, 0, 0] },
    { name: "zielony", color: "green", center: [0, 255, 0] },
    { name: "niebieski", color: "blue", center: [0, 0, 255] },
    { name: "pomarańczowy", color: "orange", center: [255, 165, 0] },
    { name: "żółty", color: "yellow", center: [255, 255, 0] },
    { name: "biały", color: "white", center: [255, 255, 255] }
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

// Wykrywanie kolorów w siatce
function scanColors() {
    const colors = [];
    for (let y = 0; y < gridSize; y++) {
        const row = [];
        for (let x = 0; x < gridSize; x++) {
            const startX = margin + x * cellSize;
            const startY = margin + y * cellSize;
            const imageData = ctx.getImageData(startX, startY, cellSize, cellSize).data;
            const avgColor = getAverageColor(imageData);
            row.push(avgColor);
        }
        colors.push(row);
    }
    return colors;
}

// Obliczanie średniego koloru
function getAverageColor(imageData) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
    }
    const count = imageData.length / 4;
    return [
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count)
    ];
}

// Mapowanie kolorów na nazwy
function mapToRubikColors(color) {
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
    return matchedColor;
}

// Generowanie ciągu dla algorytmu Kociemby
function generateKociembaString(results) {
    const order = ["czerwony", "zielony", "niebieski", "pomarańczowy", "żółty", "biały"];
    let kociembaString = "";
    for (const face of order) {
        const colors = results[face];
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                kociembaString += colors[y][x][0]; // Pierwsza litera koloru
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

    // Wykryj kolory z bieżącego obrazu
    const colors = scanColors();
    const rubikColors = colors.map(row => row.map(mapToRubikColors));
    const currentFace = faces[currentFaceIndex];
    results[currentFace.name] = rubikColors;

    // Wyświetl wyniki
    colorOutput.innerHTML = `<h2>Wykryte kolory (${currentFace.name}):</h2>` +
        rubikColors.map(row => row.join(', ')).join('<br>');

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
    }

    isScanning = false;
});

// Inicjalizacja
startCamera();
render();

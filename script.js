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

// Mapowanie liter algorytmu Kociemby na nazwy kolorów (dla wyświetlania)
const faceLetters = {
  "U": "żółty",
  "R": "zielony",
  "F": "czerwony",
  "D": "biały",
  "L": "niebieski",
  "B": "pomarańczowy"
};

// Wzorcowe kolory (w przestrzeni HSL) dla sześciu barw kostki Rubika
// Uwaga: wartości można korygować w zależności od typu kostki i oświetlenia.
// - h (odcień) w stopniach [0..360]
// - s (nasycenie) w procentach [0..100]
// - l (jasność) w procentach [0..100]
const referenceColors = [
  // Biały
  { letter: 'D', name: 'biały',       hsl: [  0,   0,  95] }, 
  // Żółty
  { letter: 'U', name: 'żółty',      hsl: [ 60, 100,  50] },
  // Zielony
  { letter: 'R', name: 'zielony',    hsl: [120, 100,  40] },
  // Czerwony
  { letter: 'F', name: 'czerwony',   hsl: [  0, 100,  50] },
  // Niebieski
  { letter: 'L', name: 'niebieski',  hsl: [240, 100,  40] },
  // Pomarańczowy
  { letter: 'B', name: 'pomarańczowy', hsl: [ 30, 100,  50] }
];

// Liczba pozostałych ścian do zeskanowania
let remainingScans = 6;

// Wyniki skanowania
let results = {}; 

// Flaga oznaczająca czy trwa właśnie skanowanie
let isScanning = false;


/* ================================================
   1. URUCHOMIENIE KAMERY
   ================================================ */
async function startCamera() {
  try {
    // facingMode: "environment" - stara się używać tylnej kamery (np. w telefonach)
    const constraints = { video: { facingMode: "environment" } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  } catch (error) {
    console.error("Błąd dostępu do kamery:", error);
  }
}


/* ================================================
   2. RYSOWANIE SIATKI NA CANVAS
   ================================================ */
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


/* ================================================
   3. SKANOWANIE KOLORÓW
   - Pobiera fragment 10x10 px ze środka każdej komórki
   - Przekształca je na HSL
   ================================================ */
function scanColors() {
  const colors = [];
  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) {

      // Środek każdej komórki (np. 10x10 px)
      const startX = margin + x * cellSize + cellSize / 2 - 5;
      const startY = margin + y * cellSize + cellSize / 2 - 5;

      // Pobierz obrazek (fragment)
      const imageData = ctx.getImageData(startX, startY, 10, 10).data;

      // Oblicz średnią wartość koloru w tym fragmencie (R, G, B)
      let totalR = 0, totalG = 0, totalB = 0;
      const numPixels = 15 * 15;
      for (let i = 0; i < imageData.length; i += 4) {
        totalR += imageData[i + 0];
        totalG += imageData[i + 1];
        totalB += imageData[i + 2];
      }
      const avgR = totalR / numPixels;
      const avgG = totalG / numPixels;
      const avgB = totalB / numPixels;

      // Konwertuj średnie RGB na HSL
      const hsl = rgbToHsl(avgR, avgG, avgB);
      row.push(hsl);
    }
    colors.push(row);
  }
  return colors;
}


/* ================================================
   4. KONWERSJA RGB NA HSL
   ================================================ */
function rgbToHsl(r, g, b) {
  r /= 255; 
  g /= 255; 
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    // Szary, brak odcienia
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Przeskaluj na bardziej czytelne wartości
  return [
    h * 360,       // Zakres 0..360
    s * 100,       // Zakres 0..100
    l * 100        // Zakres 0..100
  ];
}


/* ================================================
   5. OBLICZANIE NAJBLIŻSZEGO KOLORU (WZORCE HSL)
   ================================================
   - Dla każdego wczytanego HSL wylicz dystans do
     zdefiniowanych barw i wybierz tę z najmniejszym
     dystansem (najbliższą).
   ================================================ */

function mapToKociembaLetter(hsl) {
  let minDistance = Infinity;
  let bestLetter = 'D'; // Domyślnie biały, gdyby coś poszło nie tak

  for (const refColor of referenceColors) {
    const dist = getHslDistance(hsl, refColor.hsl);
    if (dist < minDistance) {
      minDistance = dist;
      bestLetter = refColor.letter;
    }
  }
  return bestLetter;
}

// Funkcja licząca "odległość" między dwoma kolorami HSL
// Uwzględniamy okrężność H (np. 350° i 10° są blisko).
function getHslDistance([h1, s1, l1], [h2, s2, l2]) {
  // Różnica odcienia (z uwzględnieniem 360°)
  let dh = Math.abs(h1 - h2);
  if (dh > 180) dh = 360 - dh;

  // Różnica nasycenia i jasności
  const ds = Math.abs(s1 - s2);
  const dl = Math.abs(l1 - l2);

  // Zwróć np. kwadrat dystansu
  // (nie ma to wielkiego znaczenia, czy kwadrat czy pierwiastek –
  //  ważne, by być spójnym w porównywaniu).
  return dh * dh + ds * ds + dl * dl;
}


/* ================================================
   6. GENEROWANIE CIĄGU DLA ALGORYTMU KOCIEMBY
   ================================================ */
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


/* ================================================
   7. OBSŁUGA WYŚWIETLANIA ZESKANOWANYCH ŚCIAN
   ================================================ */
function updateScannedFaces() {
  const scannedFaces = Object.keys(results)
    .map(face => faceLetters[face])
    .join(', ');

  colorOutput.innerHTML = `<h2>Zeskanowane ściany:</h2><p>${scannedFaces}</p>`;
}


/* ================================================
   8. PĘTLA RENDEROWANIA (CAMERA -> CANVAS)
   ================================================ */
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


/* ================================================
   9. OBSŁUGA PRZYCISKU "SKANUJ"
   ================================================ */
scanButton.addEventListener('click', () => {
  if (isScanning) return; // Zapobiegaj wielokrotnemu skanowaniu

  isScanning = true;

  // Wykryj kolory z bieżącego obrazu
  const hslValues = scanColors();
  // Zamień każdy HSL na literę algorytmu Kociemby
  const kociembaLetters = hslValues.map(row => row.map(mapToKociembaLetter));

  // Określ, która ściana została zeskanowana (na podstawie środkowego kafelka)
  const centerLetter = kociembaLetters[1][1]; // Środkowy kafelek
  if (!kociembaOrder.includes(centerLetter)) {
    colorOutput.innerHTML = `<h2>Błąd:</h2><p>Nie rozpoznano koloru środkowego kafelka.</p>`;
    isScanning = false;
    return;
  }

  // Zapisz wyniki dla tej ściany
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
      colorOutput.innerHTML += `
        <h2>Wynik dla algorytmu Kociemby:</h2>
        <pre>${resultString}</pre>`;

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


/* ================================================
   10. INICJALIZACJA: URUCHOMIENIE KAMERY I START
   ================================================ */
startCamera();
render();
instruction.textContent = `Pozostało do zeskanowania: ${remainingScans} ścian.`;

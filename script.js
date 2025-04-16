// Endpoint API (zmień na swój URL backendu)
const backendUrl = "https://rubik-cube-backend-zh6g.onrender.com/solve";

// Elementy DOM
const video = document.getElementById('camera');
const canvas = document.getElementById('grid');
const scanButton = document.getElementById('scanButton');
const calibrateButton = document.getElementById('calibrateButton');
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

// Nazwy kolorów (dla wyświetlania) przypisane literom
const faceLetters = {
  "U": "żółty",
  "R": "zielony",
  "F": "czerwony",
  "D": "biały",
  "L": "niebieski",
  "B": "pomarańczowy"
};

//stare
// const referenceColors = [
//   { letter: 'D', name: 'biały',         hsl: [ 36.0, 15.4, 72.3 ] },
//   { letter: 'B', name: 'pomarańczowy', hsl: [ 20.4, 100.0, 44.0 ] },
//   { letter: 'R', name: 'zielony',      hsl: [125.8, 58.5, 47.2 ] },
//   { letter: 'F', name: 'czerwony',     hsl: [0.6, 70.9, 46.7 ] },
//   { letter: 'U', name: 'żółty',        hsl: [52.2, 91.7, 42.8 ] }, 
//   { letter: 'L', name: 'niebieski',    hsl: [204.1, 68.5, 33.1 ] }
// ];

//Nowe kolory referencyjne
const referenceColors = [
  { letter: 'D', name: 'biały',         hsl: [0, 0, 100] },
  { letter: 'B', name: 'pomarańczowy', hsl: [30, 100.0, 50] },
  { letter: 'R', name: 'zielony',      hsl: [120, 100, 50] },
  { letter: 'F', name: 'czerwony',     hsl: [0, 100, 50] },
  { letter: 'U', name: 'żółty',        hsl: [60, 100, 50] }, 
  { letter: 'L', name: 'niebieski',    hsl: [240, 100, 50] }
];

let correctedReferenceColors = null;
let correctionVector = { h: 1, s: 1, l: 1 };
let remainingScans = 6;
let results = {};
let isScanning = false;
let isCalibrated = false;

// Funkcje pomocnicze
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getColorFromCenterField() {
  const sampleSize = 10;
  const startX = width / 2 - sampleSize / 2;
  const startY = height / 2 - sampleSize / 2;
  const imageData = ctx.getImageData(startX, startY, sampleSize, sampleSize).data;

  let totalR = 0, totalG = 0, totalB = 0;
  const numPixels = sampleSize * sampleSize;
  for (let i = 0; i < imageData.length; i += 4) {
    totalR += imageData[i];
    totalG += imageData[i + 1];
    totalB += imageData[i + 2];
  }
  const avgR = totalR / numPixels;
  const avgG = totalG / numPixels;
  const avgB = totalB / numPixels;
  
  return rgbToHsl(avgR, avgG, avgB);
}

function getCorrectionVector(detectedWhite, expectedWhite = { h: 0, s: 0, l: 100 }) {
  return {
    hShift: 0, //expectedWhite.h - detectedWhite.h,  // PRZESUNIĘCIE
    sFactor: 1,//expectedWhite.s / Math.max(detectedWhite.s, 1), // SKALOWANIE
    lFactor: expectedWhite.l / Math.max(detectedWhite.l, 1)  // SKALOWANIE
  };
}

function applyWhiteBalanceCorrection(referenceColors, correctionVector) {
  return referenceColors.map(color => ({
    letter: color.letter,
    name: color.name,
    hsl: [
      (color.hsl[0] + correctionVector.hShift + 360) % 360, // Hue przesunięcie
      clamp(color.hsl[1] * correctionVector.sFactor, 0, 100), // Saturation korekcja
      clamp(color.hsl[2] * correctionVector.lFactor, 0, 100)  // Lightness korekcja
    ]
  }));
}

/* ================================================
   Funkcje główne
   ================================================ */
async function startCamera() {
  try {
    const constraints = { video: { facingMode: "environment" } };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  } catch (error) {
    console.error("Błąd dostępu do kamery:", error);
    instruction.textContent = `Błąd dostępu do kamery: ${error.message}`;
  }
}

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

function scanColors() {
  const colors = [];
  const sampleSize = 10;

  for (let y = 0; y < gridSize; y++) {
    const row = [];
    for (let x = 0; x < gridSize; x++) {
      const startX = margin + x * cellSize + cellSize / 2 - sampleSize/2;
      const startY = margin + y * cellSize + cellSize / 2 - sampleSize/2;
      const imageData = ctx.getImageData(startX, startY, sampleSize, sampleSize).data;

      let totalR = 0, totalG = 0, totalB = 0;
      const numPixels = sampleSize * sampleSize;
      for (let i = 0; i < imageData.length; i += 4) {
        totalR += imageData[i];
        totalG += imageData[i + 1];
        totalB += imageData[i + 2];
      }
      
      const avgR = totalR / numPixels;
      const avgG = totalG / numPixels;
      const avgB = totalB / numPixels;
      
      const hsl = rgbToHsl(avgR, avgG, avgB);
      row.push(hsl);
    }
    colors.push(row);
  }
  return colors;
}

function rgbToHsl(r, g, b) {
  r /= 255; 
  g /= 255; 
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = (l > 0.5) ? d / (2 - max - min) : d / (max + min);
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
  let minDistance = Infinity;
  let bestLetter = 'D';

  for (const refColor of correctedReferenceColors) {
    const dist = getHslDistance(hsl, refColor.hsl);
    if (dist < minDistance) {
      minDistance = dist;
      bestLetter = refColor.letter;
    }
  }
  return bestLetter;
}

function getHslDistance([h1, s1, l1], [h2, s2, l2]) {
  let dh = Math.abs(h1 - h2);
  if (dh > 180) dh = 360 - dh;
  const ds = Math.abs(s1 - s2);
  const dl = Math.abs(l1 - l2);
  return dh*dh + ds*ds + dl*dl;
}

function generateKociembaString(results) {
  let kociembaString = "";
  for (const face of kociembaOrder) {
    if (!results[face]) throw new Error(`Brak zeskanowanej ściany: ${faceLetters[face]}`);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        kociembaString += results[face][y][x];
      }
    }
  }
  return kociembaString;
}

function updateScannedFaces() {
  const scannedFaces = Object.keys(results)
    .map(face => faceLetters[face])
    .join(', ');
  colorOutput.innerHTML = `<h2>Zeskanowane ściany:</h2><p>${scannedFaces}</p>`;
}

function render() {
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(video, 0, 0, width, height);
  drawGrid();
  requestAnimationFrame(render);
}

scanButton.addEventListener('click', async () => {
   if (!isCalibrated) {
    instruction.textContent = "Najpierw wykonaj kalibrację!";
    setTimeout(() => instruction.textContent = "", 3000);
    return;
  }
  
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
      colorOutput.innerHTML += `
        <h2>Wynik dla algorytmu Kociemby:</h2>
        <pre>${resultString}</pre>`;

      const solutionResponse = await solveCube(resultString);
      if (solutionResponse.error) {
        colorOutput.innerHTML += `<h2>Błąd:</h2><pre>${solutionResponse.error}</pre>`;
      } else {
        colorOutput.innerHTML += `<h2>Rozwiązanie:</h2><pre>${solutionResponse.solution}</pre>`;
      }

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

calibrateButton.addEventListener('click', () => {
  try {
    if(video.paused || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      throw new Error("Kamera nie jest gotowa");
    }
    
    const detectedWhite = getColorFromCenterField();
    console.log("Wykryty biały:", detectedWhite);

    const [h, s, l] = detectedWhite;
    correctionVector = getCorrectionVector({h, s, l});
    correctedReferenceColors = applyWhiteBalanceCorrection(referenceColors, correctionVector);
    
    console.log("Skorygowane kolory:", correctedReferenceColors);
    
    isCalibrated = true;
    scanButton.style.display = 'inline-block';
    scanButton.disabled = false;
    instruction.textContent = "Kalibracja udana! Możesz skanować ściany.";
    //setTimeout(() => instruction.textContent = "", 3000);
    calibrateButton.style.display = 'none';
    
  } catch (error) {
    console.error("Błąd kalibracji:", error);
    instruction.textContent = `Błąd kalibracji: ${error.message}`;
    //setTimeout(() => instruction.textContent = "", 5000);
    calibrateButton.style.display = 'none';
  }
});

// Inicjalizacja
scanButton.disabled = true;
scanButton.style.display = 'none';
startCamera();
render();
instruction.textContent = `Pozostało do zeskanowania: ${remainingScans} ścian.`;

async function solveCube(cubeState) {
  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cubeState: cubeState }),
    });

    if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Błąd podczas wysyłania żądania:", error);
    return { error: error.message };
  }
}

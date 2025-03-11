// Elementy DOM
const video = document.getElementById('camera');
const canvas = document.getElementById('grid');
const scanButton = document.getElementById('scanButton');
const colorOutput = document.getElementById('colorOutput');
const instruction = document.getElementById('instruction');

// Rozmiar siatki
const gridSize = 3, cellSize = 100, margin = 20;
const width = gridSize * cellSize + 2 * margin;
const height = gridSize * cellSize + 2 * margin;
const ctx = canvas.getContext('2d');
canvas.width = width; canvas.height = height;

// Kolejność ścian i nazwy
const kociembaOrder = ["U","R","F","D","L","B"];
const faceLetters = {
  "U": "żółty",  "R": "zielony", "F": "czerwony",
  "D": "biały",   "L": "niebieski","B": "pomarańczowy"
};

// Twoje HSL
const referenceColors = [
  { letter: 'D', hsl: [94.9,1.4,66.0] },
  { letter: 'B', hsl: [23.4,98.4,43.5] },
  { letter: 'R', hsl: [121.8,66.8,47.4] },
  { letter: 'F', hsl: [357.9,78.9,43.8] },
  { letter: 'U', hsl: [55.2,100.0,40.1] },
  { letter: 'L', hsl: [204.5,93.9,39.8] }
];

let remainingScans = 6, results = {}, isScanning = false;


/* ====== Konfiguracja GitHub (dopisz swoje dane) ====== */
const GH_TOKEN   = "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";      // UWAGA na upublicznienie
const REPO_OWNER = "kamiliusz0";        // np. "janKowalski"
const REPO_NAME  = "rubiks";       // np. "rubic-cube"
const FILE_PATH  = "cube_state.json"; // ścieżka w repo


// 1. Start kamery
async function startCamera() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment"}});
    video.srcObject = s;
  } catch(e){ console.error("Błąd kamery:", e); }
}

// 2. Siatka
function drawGrid(){
  ctx.strokeStyle='#fff'; ctx.lineWidth=2;
  for(let i=1; i<gridSize; i++){
    ctx.beginPath();
    ctx.moveTo(margin+i*cellSize, margin);
    ctx.lineTo(margin+i*cellSize, height-margin);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(margin, margin+i*cellSize);
    ctx.lineTo(width-margin, margin+i*cellSize);
    ctx.stroke();
  }
}

// 3. Skan kolorów
function scanColors(){
  const sample=10, colors=[];
  for(let y=0;y<gridSize;y++){
    const row=[];
    for(let x=0;x<gridSize;x++){
      const sx=margin+x*cellSize+cellSize/2-sample/2;
      const sy=margin+y*cellSize+cellSize/2-sample/2;
      const d=ctx.getImageData(sx,sy,sample,sample).data;
      let r=0,g=0,b=0;
      for(let i=0;i<d.length;i+=4){ r+=d[i]; g+=d[i+1]; b+=d[i+2]; }
      const n=sample*sample, hsl=rgbToHsl(r/n,g/n,b/n);
      row.push(hsl);
    }
    colors.push(row);
  }
  return colors;
}

// 4. RGB->HSL
function rgbToHsl(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;} else {
    const d=max-min;
    s=l>0.5? d/(2-max-min): d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return [h*360,s*100,l*100];
}

// 5. Mapuj HSL->literka
function mapToKociembaLetter(hsl){
  let minDist=1e9, best='D';
  for(const ref of referenceColors){
    const d=getHslDist(hsl,ref.hsl);
    if(d<minDist){ minDist=d; best=ref.letter; }
  }
  return best;
}
function getHslDist([h1,s1,l1],[h2,s2,l2]){
  let dh=Math.abs(h1-h2); if(dh>180) dh=360-dh;
  const ds=Math.abs(s1-s2), dl=Math.abs(l1-l2);
  return dh*dh+ds*ds+dl*dl;
}

// 6. Ciąg do Kociemby
function generateKociembaString(res){
  let str='';
  for(const face of kociembaOrder){
    if(!res[face]) throw new Error(`Brak ściany: ${face}`);
    for(let y=0;y<3;y++){
      for(let x=0;x<3;x++){
        str+=res[face][y][x];
      }
    }
  }
  return str;
}

// 7. Wyświetlanie info
function updateScannedFaces(){
  const scanned = Object.keys(results).map(f=>faceLetters[f]).join(', ');
  colorOutput.innerHTML=`<h2>Zeskanowane:</h2><p>${scanned}</p>`;
}

// 8. Render pętla
function render(){
  ctx.clearRect(0,0,width,height);
  ctx.drawImage(video,0,0,width,height);
  drawGrid();
  requestAnimationFrame(render);
}

// 9. Podgląd 9 kolorów
function displayScannedFace(faceLetter,kociembaLetters){
  const c=document.createElement('div'); c.style.margin='10px 0';
  const t=document.createElement('h3');
  t.textContent=`Skan: ${faceLetters[faceLetter]} (${faceLetter})`;
  c.appendChild(t);

  const grid=document.createElement('div');
  grid.style.display='grid';
  grid.style.gridTemplateColumns='repeat(3,40px)';
  grid.style.gridTemplateRows='repeat(3,40px)';
  grid.style.gap='2px';

  for(let y=0;y<3;y++){
    for(let x=0;x<3;x++){
      const letter = kociembaLetters[y][x];
      const d=document.createElement('div');
      d.style.width='40px'; d.style.height='40px';
      d.style.border='1px solid #333';
      d.style.backgroundColor=mapLetterToColor(letter);
      d.style.display='flex'; d.style.justifyContent='center';
      d.style.alignItems='center'; d.style.fontWeight='bold';
      d.textContent=letter;
      grid.appendChild(d);
    }
  }
  c.appendChild(grid);
  colorOutput.appendChild(c);
}
function mapLetterToColor(l){
  switch(l){
    case 'U': return 'yellow'; case 'R': return 'green';
    case 'F': return 'red';    case 'D': return 'white';
    case 'L': return 'blue';   case 'B': return 'orange';
    default:  return 'gray';
  }
}

// 10. Click "Skanuj"
scanButton.addEventListener('click',()=>{
  if(isScanning) return;
  isScanning=true;

  const hslVals=scanColors();
  const letters=hslVals.map(row=>row.map(mapToKociembaLetter));
  const center=letters[1][1];
  if(!kociembaOrder.includes(center)){
    colorOutput.innerHTML="<h2>Błąd:</h2><p>Nie rozpoznano środka.</p>";
    isScanning=false; return;
  }
  results[center]=letters;
  displayScannedFace(center,letters);
  remainingScans--;
  instruction.textContent=`Pozostało: ${remainingScans} ścian.`;
  updateScannedFaces();

  if(remainingScans===0){
    try {
      const resultString=generateKociembaString(results);
      colorOutput.innerHTML+=`<h2>Kociemba:</h2><pre>${resultString}</pre>`;

      // ====== ZAPIS DO GITHUBA (autmatycznie) ======
      const json = JSON.stringify({
        kociembaCode: resultString,
        time: new Date().toISOString()
      }, null, 2);
      saveFileToGitHub(json).then(()=>{
        console.log("Zapisano w GitHubie");
      }).catch(err=>console.error("Błąd GitHub:", err));

      video.style.display="none";
      canvas.style.display="none";
      scanButton.style.display="none";
      instruction.textContent="Wszystko zeskanowane!";
    } catch(e){
      colorOutput.innerHTML=`<h2>Błąd:</h2><pre>${e.message}</pre>`;
    }
  }
  isScanning=false;
});

// 10b. Funkcja – minimalna wersja do zapisu w GitHub
async function saveFileToGitHub(jsonStr) {
  try {
    // Zakoduj zawartość JSON w base64
    const base64Content = Buffer.from(jsonStr).toString('base64');

    // URL do pliku w repozytorium GitHub
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

    // Nagłówki z tokenem GitHub
    const headers = {
      "Authorization": `Bearer ${GH_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    };

    // Spróbuj pobrać sha istniejącego pliku
    let sha = null;
    try {
      const r = await fetch(url, { method: 'GET', headers });
      if (r.ok) {
        const d = await r.json();
        sha = d.sha;
      } else {
        console.error("Błąd podczas pobierania sha:", r.statusText);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania sha:", error);
    }

    // Przygotuj dane do wysłania
    const body = {
      message: "Update cube state",
      content: base64Content
    };
    if (sha) body.sha = sha;

    // Wyślij żądanie PUT
    const r2 = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    // Sprawdź odpowiedź
    if (!r2.ok) {
      const errorDetails = await r2.json();
      throw new Error(`PUT Error: ${r2.statusText} - ${errorDetails.message}`);
    }

    console.log("Plik zapisany pomyślnie!");
  } catch (error) {
    console.error("Błąd podczas zapisywania pliku:", error);
    throw error;
  }
}
// 11. Start
startCamera();
render();
instruction.textContent=`Pozostało do zeskanowania: ${remainingScans} ścian.`;

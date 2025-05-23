const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const STAGE_IMAGES = [
  "background_stage1.webp",
  "background_stage2.webp",
  "background_stage3.webp",
  "background_stage4.webp",
  "background_stage5.webp",
];
const FAIL_IMAGE = "background2.webp";
const ENEMY_IMAGE_SRC = "enemy.png";

const restartButton = document.getElementById("restartButton");
let isGameOver = false;

let stageIndex = 0;
let timerExpired = false;
const stageTime = 20;
let timer = stageTime;
let lives = 3;
let areaRevealed = 0;
let gameInterval;

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 8,
  speed: 3,
  vx: 0,
  vy: 0,
  color: "lime",
  trail: [],
  inSafeZone: true,
};

let keys = {};
let revealedMap;
let bgImage = new Image();
let bgReady = false;

const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");
maskCanvas.width = canvas.width;
maskCanvas.height = canvas.height;

const enemyImage = new Image();
enemyImage.src = ENEMY_IMAGE_SRC;

const enemies = [];
const enemyCount = 5;

// === 파티클 관련 변수 ===
const particles = [];

function createParticle(x, y) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    life: 30 + Math.floor(Math.random() * 30),
    size: 2 + Math.random() * 3,
    color: `rgba(255,255,255,${Math.random()})`
  };
}

function loadStage(index) {
  bgImage = new Image();
  bgReady = false;
  bgImage.src = STAGE_IMAGES[index];
  bgImage.onload = () => {
    bgReady = true;

    revealedMap = maskCtx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < revealedMap.data.length; i += 4) {
      revealedMap.data[i] = 0;
      revealedMap.data[i + 1] = 0;
      revealedMap.data[i + 2] = 0;
      revealedMap.data[i + 3] = 255;
    }

    const startX = Math.floor(canvas.width / 2 - 15);
    const startY = Math.floor(canvas.height / 2 - 15);
    for (let y = startY; y < startY + 120; y++) {
      for (let x = startX; x < startX + 120; x++) {
        const i = (y * canvas.width + x) * 4;
        revealedMap.data[i + 3] = 0;
      }
    }

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.trail = [];
    player.inSafeZone = true;

    timer = stageTime;
    timerExpired = false;
    areaRevealed = 0;

    enemies.length = 0;
    spawnEnemies();

    particles.length = 0; // 파티클 초기화
  };
}

function spawnEnemies() {
  enemies.length = 0;
  const safeX1 = Math.floor(canvas.width / 2 - 15);
  const safeY1 = Math.floor(canvas.height / 2 - 15);
  const safeX2 = safeX1 + 120;
  const safeY2 = safeY1 + 120;

  for (let i = 0; i < enemyCount; i++) {
    let x, y;
    do {
      x = Math.random() * canvas.width;
      y = Math.random() * canvas.height;
    } while (x >= safeX1 && x <= safeX2 && y >= safeY1 && y <= safeY2);

    const baseSpeed = 2;
    const speedMultiplier = 1 + Math.random() * 2;
    const angle = Math.random() * Math.PI * 2;

    enemies.push({
      x,
      y,
      vx: Math.cos(angle) * baseSpeed * speedMultiplier,
      vy: Math.sin(angle) * baseSpeed * speedMultiplier,
      size: 50,
      rotation: 0,
      rotationSpeed: 0,
      stopped: false,
      stopTime: 0,
      maxStopTime: 0,
      rotateDirection: 1,
    });
  }
}

function update() {
  if (!timerExpired) {
    timer -= 1 / 60;
    if (timer <= 0) {
      timer = 0;
      timerExpired = true;

      // 배경 이미지만 교체 (revealedMap 유지)
      const failBg = new Image();
      failBg.src = FAIL_IMAGE;
      failBg.onload = () => {
        bgImage = failBg;
      };
    }
  }

  player.vx = (keys["ArrowRight"] ? 1 : 0) - (keys["ArrowLeft"] ? 1 : 0);
  player.vy = (keys["ArrowDown"] ? 1 : 0) - (keys["ArrowUp"] ? 1 : 0);
  player.vx *= player.speed;
  player.vy *= player.speed;

  player.x += player.vx;
  player.y += player.vy;
  player.x = Math.min(canvas.width, Math.max(0, player.x));
  player.y = Math.min(canvas.height, Math.max(0, player.y));

  const inRevealed = getRevealValue(player.x, player.y);
  if (inRevealed === 0) {
    if (!player.inSafeZone) {
      fillTrailArea();
      player.trail = [];
    }
    player.inSafeZone = true;
  } else {
    if (player.inSafeZone) player.trail = [];
    player.inSafeZone = false;
    player.trail.push({ x: player.x, y: player.y });
  }

  for (let enemy of enemies) {
    if (!enemy.stopped) {
      const nextX = enemy.x + enemy.vx;
      const nextY = enemy.y + enemy.vy;
      const i = (Math.floor(nextY) * canvas.width + Math.floor(nextX)) * 4;
      const isInRevealed = revealedMap.data[i + 3] === 0;

      if (isInRevealed) {
        enemy.vx = -enemy.vx;
        enemy.vy = -enemy.vy;
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
      } else {
        enemy.x = nextX;
        enemy.y = nextY;
      }

      if (Math.random() < 0.002) {
        enemy.stopped = true;
        enemy.rotationSpeed = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 0.1 + 0.05);
        enemy.maxStopTime = 30 + Math.floor(Math.random() * 60);
        enemy.stopTime = 0;
      }
    } else {
      enemy.rotation += enemy.rotationSpeed;
      enemy.stopTime++;
      if (enemy.stopTime >= enemy.maxStopTime) {
        enemy.stopped = false;
        const baseSpeed = 2;
        const speedMultiplier = 1 + Math.random() * 2;
        const angle = Math.random() * Math.PI * 2;
        enemy.vx = Math.cos(angle) * baseSpeed * speedMultiplier;
        enemy.vy = Math.sin(angle) * baseSpeed * speedMultiplier;
        enemy.rotationSpeed = 0;
      }
    }

    if (enemy.x < 0 || enemy.x > canvas.width) enemy.vx *= -1;
    if (enemy.y < 0 || enemy.y > canvas.height) enemy.vy *= -1;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    if (Math.hypot(dx, dy) < enemy.size + player.size && !player.inSafeZone) {
      loseLife();
    }

    if (!player.inSafeZone && player.trail.length > 0) {
      for (let point of player.trail) {
        if (Math.hypot(enemy.x - point.x, enemy.y - point.y) < enemy.size) {
          loseLife();
          break;
        }
      }
    }
  }

  // === 파티클 생성 및 업데이트 ===
  if (!player.inSafeZone) {
    if (particles.length < 50) {
      particles.push(createParticle(player.x, player.y));
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  areaRevealed = calculateRevealedPercentage();

  if (!timerExpired && areaRevealed >= 50) {
    clearInterval(gameInterval);
    const nextAvailable = stageIndex + 1 < STAGE_IMAGES.length;
    const msg = nextAvailable
      ? "스테이지 클리어! 다음 스테이지로 진행하시겠습니까?"
      : "모든 스테이지를 클리어했습니다! 게임을 종료합니다.";

    if (nextAvailable) {
      if (confirm(msg)) {
        stageIndex++;
        loadStage(stageIndex);
        startGame();
      } else {
        showRestartButton();
      }
    } else {
      alert(msg);
      showRestartButton();
    }
  }
}

function getRevealValue(x, y) {
  const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  return revealedMap?.data[i + 3] ?? 255;
}

function fillTrailArea() {
  if (player.trail.length < 3) return;
  maskCtx.clearRect(0, 0, canvas.width, canvas.height);
  maskCtx.beginPath();
  maskCtx.moveTo(player.trail[0].x, player.trail[0].y);
  for (let i = 1; i < player.trail.length; i++) {
    maskCtx.lineTo(player.trail[i].x, player.trail[i].y);
  }
  maskCtx.closePath();
  maskCtx.fillStyle = "white";
  maskCtx.fill();

  const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < revealedMap.data.length; i += 4) {
    if (maskData.data[i + 3] > 128) {
      revealedMap.data[i + 3] = 0;
    }
  }
}

function calculateRevealedPercentage() {
  let count = 0;
  for (let i = 0; i < revealedMap.data.length; i += 4) {
    if (revealedMap.data[i + 3] === 0) count++;
  }
  return (count / (canvas.width * canvas.height)) * 100;
}

function loseLife() {
  lives--;
  if (lives <= 0) {
    lives = 0;
    isGameOver = true;
    clearInterval(gameInterval);
    showRestartButton();
  }
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.trail = [];
  player.inSafeZone = true;
}

function showRestartButton() {
  restartButton.style.display = "block";
}

function restartGame() {
  lives = 3;
  stageIndex = 0;
  isGameOver = false;
  timerExpired = false;
  timer = stageTime;
  loadStage(stageIndex);
  startGame();
  restartButton.style.display = "none";
}

function draw() {
  if (!bgReady) return;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

  maskCtx.putImageData(revealedMap, 0, 0);
  ctx.drawImage(maskCanvas, 0, 0);

  // 플레이어 그리기
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fill();

  // 적 그리기
  for (let enemy of enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.rotation);
    ctx.drawImage(enemyImage, -enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size);
    ctx.restore();
  }

  // 플레이어가 안전구역 밖이면 빨간 선 그리기
  if (!player.inSafeZone && player.trail.length > 1) {
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.trail[0].x, player.trail[0].y);
    for (let i = 1; i < player.trail.length; i++) {
      ctx.lineTo(player.trail[i].x, player.trail[i].y);
    }
    ctx.stroke();
  }

  // === 파티클 그리기 ===
  for (let p of particles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // UI 텍스트
  ctx.fillStyle = "white";
  ctx.font = "20px sans-serif";
  ctx.fillText(`스테이지: ${stageIndex + 1}`, 20, 30);
  ctx.fillText(`영역: ${areaRevealed.toFixed(1)}%`, 20, 60);
  ctx.fillText(`목숨: ${lives}`, 20, 90);
  ctx.fillText(`타이머: ${timer.toFixed(1)}`, 20, 120);
}

function gameLoop() {
  update();
  draw();
}

function startGame() {
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 1000 / 60);
}

window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

restartButton.addEventListener("click", restartGame);

loadStage(stageIndex);
startGame();

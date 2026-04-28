import * as THREE from "three";

const canvas = document.getElementById("game");
const hud = document.getElementById("hud");
const mainMenu = document.getElementById("mainMenu");
const pauseMenu = document.getElementById("pauseMenu");
const messageOverlay = document.getElementById("messageOverlay");
const startButton = document.getElementById("startButton");
const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");
const menuButton = document.getElementById("menuButton");
const messageRestartButton = document.getElementById("messageRestartButton");
const messageMenuButton = document.getElementById("messageMenuButton");
const objectiveText = document.getElementById("objectiveText");
const speedValue = document.getElementById("speedValue");
const staminaFill = document.getElementById("staminaFill");
const threatValue = document.getElementById("threatValue");
const distanceValue = document.getElementById("distanceValue");
const messageEyebrow = document.getElementById("messageEyebrow");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const entityAudio = document.getElementById("entityAudio");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a121a);
scene.fog = new THREE.FogExp2(0x071017, 0.03);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const clock = new THREE.Clock();
const keys = {};
const walls = [];
const wallMeshes = [];
const spawnPoint = new THREE.Vector3(0, 0, 12);
const exitPoint = new THREE.Vector3(0, 0, -64);

const player = {
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  radius: 1.1,
  standingHeight: 2.6,
  slideHeight: 1.5,
  currentHeight: 2.6,
  jumpStrength: 10.5,
  gravity: 28,
  moveAcceleration: 44,
  groundFriction: 12,
  airDrag: 1.2,
  airControl: 0.45,
  walkSpeed: 9.5,
  sprintSpeed: 16,
  slideBoost: 21,
  maxAirSpeed: 11,
  grounded: true,
  stamina: 1,
  slideTimer: 0,
  slideCooldown: 0,
  alive: true,
};

const game = {
  state: "menu",
  pointerLocked: false,
  survivedSeconds: 0,
  audioUnlocked: false,
};

const chase = {
  sprite: null,
  light: null,
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  baseSpeed: 8.5,
  attackRange: 3.2,
  audioRange: 18,
  dangerRange: 10,
};

const mouseSensitivity = 0.0022;

function createWorld() {
  const ambient = new THREE.HemisphereLight(0x9ec7ff, 0x081018, 1.1);
  scene.add(ambient);

  const moonLight = new THREE.DirectionalLight(0xa4d5ff, 1.2);
  moonLight.position.set(18, 28, 12);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.near = 0.1;
  moonLight.shadow.camera.far = 120;
  moonLight.shadow.camera.left = -70;
  moonLight.shadow.camera.right = 70;
  moonLight.shadow.camera.top = 70;
  moonLight.shadow.camera.bottom = -70;
  scene.add(moonLight);

  const floorTexture = makeFloorTexture();
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(28, 28);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({
      color: 0x132330,
      roughness: 0.96,
      metalness: 0.04,
      map: floorTexture,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  worldGroup.add(floor);

  const perimeterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a3547,
    roughness: 0.86,
    metalness: 0.08,
  });

  addWall(0, 3, -78, 78, 6, perimeterMaterial);
  addWall(0, 3, 78, 78, 6, perimeterMaterial);
  addWall(-78, 3, 0, 6, 156, perimeterMaterial);
  addWall(78, 3, 0, 6, 156, perimeterMaterial);

  const mazeMaterial = new THREE.MeshStandardMaterial({
    color: 0x24465b,
    roughness: 0.82,
    metalness: 0.1,
  });

  const layout = [
    [0, 3, 38, 54, 6],
    [-32, 3, 18, 6, 50],
    [26, 3, 4, 6, 44],
    [0, 3, -10, 40, 6],
    [-24, 3, -28, 44, 6],
    [30, 3, -36, 6, 48],
    [4, 3, -54, 34, 6],
    [-42, 3, -52, 6, 32],
    [46, 3, -58, 22, 6],
  ];

  layout.forEach(([x, y, z, sx, sz]) => addWall(x, y, z, sx, sz, mazeMaterial));

  const pillarGeometry = new THREE.CylinderGeometry(1.5, 1.5, 6, 16);
  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b566f,
    roughness: 0.78,
    metalness: 0.12,
  });
  const pillarPositions = [
    [-50, 0, 50],
    [50, 0, 50],
    [-54, 0, -12],
    [56, 0, 14],
    [-8, 0, -42],
    [12, 0, -26],
  ];

  pillarPositions.forEach(([x, y, z]) => {
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(x, y + 3, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    worldGroup.add(pillar);
    walls.push({
      minX: x - 2.2,
      maxX: x + 2.2,
      minZ: z - 2.2,
      maxZ: z + 2.2,
    });
  });

  const exitRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.35, 16, 64),
    new THREE.MeshStandardMaterial({
      color: 0xc9ff70,
      emissive: 0x9cd64d,
      emissiveIntensity: 1.3,
      roughness: 0.32,
    })
  );
  exitRing.position.copy(exitPoint).setY(4.2);
  exitRing.rotation.x = Math.PI / 2;
  worldGroup.add(exitRing);

  const exitLight = new THREE.PointLight(0xd9ff9d, 24, 26, 2);
  exitLight.position.copy(exitPoint).setY(4.2);
  worldGroup.add(exitLight);

  const skyGlow = new THREE.Mesh(
    new THREE.SphereGeometry(140, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x163144,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.3,
    })
  );
  worldGroup.add(skyGlow);
}

function makeFloorTexture() {
  const size = 128;
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = size;
  canvasTexture.height = size;
  const ctx = canvasTexture.getContext("2d");

  ctx.fillStyle = "#10202c";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let x = 0; x < size; x += 16) {
    ctx.fillRect(x, 0, 2, size);
  }
  for (let y = 0; y < size; y += 16) {
    ctx.fillRect(0, y, size, 2);
  }
  ctx.fillStyle = "rgba(114, 246, 194, 0.08)";
  for (let i = 0; i < 90; i += 1) {
    ctx.fillRect(
      Math.random() * size,
      Math.random() * size,
      2 + Math.random() * 2,
      2 + Math.random() * 2
    );
  }

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addWall(x, y, z, width, depth, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 6, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  worldGroup.add(mesh);
  wallMeshes.push(mesh);
  walls.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  });
}

function createChaser() {
  const texture = new THREE.TextureLoader().load("./entity1.png");
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  chase.sprite = new THREE.Sprite(material);
  chase.sprite.scale.set(7, 9, 1);
  chase.sprite.position.set(0, 4.5, 54);
  worldGroup.add(chase.sprite);
  chase.position.copy(chase.sprite.position);

  chase.light = new THREE.PointLight(0xff6880, 18, 20, 2);
  chase.light.position.copy(chase.position);
  worldGroup.add(chase.light);
}

function setGameState(nextState) {
  game.state = nextState;
  const showHud = nextState === "playing";
  hud.classList.toggle("hidden", !showHud);
  mainMenu.classList.toggle("hidden", nextState !== "menu");
  pauseMenu.classList.toggle("hidden", nextState !== "paused");

  if (nextState !== "playing") {
    exitPointerLock();
  }

  if (nextState === "menu" || nextState === "finished") {
    stopEntityAudio();
  }
}

function startGame() {
  resetGame();
  hideMessage();
  setGameState("playing");
  requestPointerLock();
  unlockAudio();
}

function resetGame() {
  player.position.copy(spawnPoint);
  player.velocity.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = 0;
  player.currentHeight = player.standingHeight;
  player.stamina = 1;
  player.slideTimer = 0;
  player.slideCooldown = 0;
  player.grounded = true;
  player.alive = true;

  chase.position.set(0, 4.5, 54);
  chase.velocity.set(0, 0, 0);
  if (chase.sprite) {
    chase.sprite.position.copy(chase.position);
  }
  if (chase.light) {
    chase.light.position.copy(chase.position);
  }

  game.survivedSeconds = 0;
  objectiveText.textContent = "Reach the exit";
  updateCameraTransform();
  updateHud(999);
}

function updateCameraTransform() {
  camera.position.copy(player.position);
  camera.position.y = player.position.y + player.currentHeight;
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function requestPointerLock() {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
}

function exitPointerLock() {
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

function unlockAudio() {
  game.audioUnlocked = true;
  entityAudio.volume = 0;
  entityAudio
    .play()
    .then(() => {
      entityAudio.pause();
      entityAudio.currentTime = 0;
    })
    .catch(() => {});
}

function stopEntityAudio() {
  entityAudio.pause();
  entityAudio.currentTime = 0;
}

function update(delta) {
  if (game.state !== "playing") {
    renderer.render(scene, camera);
    return;
  }

  game.survivedSeconds += delta;
  updatePlayer(delta);
  updateChaser(delta);
  updateHud(chase.position.distanceTo(player.position));
  renderer.render(scene, camera);
}

function updatePlayer(delta) {
  const moveInput = new THREE.Vector3();
  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const inputLength = Math.hypot(forward, strafe);
  if (inputLength > 0) {
    moveInput.set(strafe / inputLength, 0, forward / inputLength);
  }

  const wantsSprint = keys.ShiftLeft || keys.ShiftRight;
  const sprinting =
    wantsSprint &&
    player.stamina > 0.08 &&
    player.grounded &&
    moveInput.lengthSq() > 0 &&
    player.slideTimer <= 0;

  if (sprinting) {
    player.stamina = Math.max(0, player.stamina - delta * 0.22);
  } else {
    player.stamina = Math.min(1, player.stamina + delta * 0.15);
  }

  if (player.slideCooldown > 0) {
    player.slideCooldown = Math.max(0, player.slideCooldown - delta);
  }

  if (
    (keys.ControlLeft || keys.ControlRight) &&
    player.slideTimer <= 0 &&
    player.slideCooldown <= 0 &&
    player.grounded &&
    sprinting
  ) {
    player.slideTimer = 0.9;
    player.slideCooldown = 0.35;
    const facing = new THREE.Vector3(
      Math.sin(player.yaw),
      0,
      Math.cos(player.yaw)
    ).normalize();
    player.velocity.x = facing.x * player.slideBoost;
    player.velocity.z = facing.z * player.slideBoost;
  }

  const isSliding = player.slideTimer > 0;
  if (isSliding) {
    player.slideTimer = Math.max(0, player.slideTimer - delta);
  }

  const targetHeight = isSliding ? player.slideHeight : player.standingHeight;
  player.currentHeight += (targetHeight - player.currentHeight) * Math.min(1, delta * 12);

  const yawForward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const yawRight = new THREE.Vector3(yawForward.z, 0, -yawForward.x);
  const desiredDirection = new THREE.Vector3()
    .addScaledVector(yawRight, moveInput.x)
    .addScaledVector(yawForward, moveInput.z);

  if (desiredDirection.lengthSq() > 0) {
    desiredDirection.normalize();
  }

  const targetSpeed = isSliding
    ? player.slideBoost
    : sprinting
      ? player.sprintSpeed
      : player.walkSpeed;

  const accelMultiplier = player.grounded ? 1 : player.airControl;
  if (desiredDirection.lengthSq() > 0) {
    player.velocity.x += desiredDirection.x * player.moveAcceleration * accelMultiplier * delta;
    player.velocity.z += desiredDirection.z * player.moveAcceleration * accelMultiplier * delta;
  }

  const planarVelocity = new THREE.Vector2(player.velocity.x, player.velocity.z);
  const maxSpeed = player.grounded ? targetSpeed : player.maxAirSpeed;
  if (planarVelocity.length() > maxSpeed && !isSliding) {
    planarVelocity.setLength(maxSpeed);
    player.velocity.x = planarVelocity.x;
    player.velocity.z = planarVelocity.y;
  }

  const friction = player.grounded
    ? isSliding
      ? 1.8
      : player.groundFriction
    : player.airDrag;
  const damping = Math.max(0, 1 - friction * delta);
  player.velocity.x *= damping;
  player.velocity.z *= damping;

  player.velocity.y -= player.gravity * delta;

  const nextPosition = player.position.clone().addScaledVector(player.velocity, delta);
  resolvePlayerCollisions(nextPosition);

  if (nextPosition.y <= 0) {
    nextPosition.y = 0;
    player.velocity.y = Math.max(0, player.velocity.y);
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  player.position.copy(nextPosition);
  updateCameraTransform();

  if (player.position.distanceTo(exitPoint) < 6) {
    finishGame(true);
  }
}

function resolvePlayerCollisions(nextPosition) {
  nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -73, 73);
  nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, -73, 73);

  for (const wall of walls) {
    const nearestX = THREE.MathUtils.clamp(nextPosition.x, wall.minX, wall.maxX);
    const nearestZ = THREE.MathUtils.clamp(nextPosition.z, wall.minZ, wall.maxZ);
    const dx = nextPosition.x - nearestX;
    const dz = nextPosition.z - nearestZ;
    const distanceSq = dx * dx + dz * dz;

    if (distanceSq < player.radius * player.radius) {
      const distance = Math.sqrt(distanceSq) || 0.0001;
      const push = player.radius - distance;
      if (Math.abs(dx) > Math.abs(dz)) {
        const sign = Math.sign(dx) || 1;
        nextPosition.x += sign * push;
        player.velocity.x = 0;
      } else {
        const sign = Math.sign(dz) || 1;
        nextPosition.z += sign * push;
        player.velocity.z = 0;
      }
    }
  }
}

function updateChaser(delta) {
  const target = player.position.clone();
  target.y = chase.position.y;

  const toPlayer = target.sub(chase.position);
  const distance = toPlayer.length();
  if (distance > 0.001) {
    toPlayer.normalize();
  }

  const speedBoost = THREE.MathUtils.clamp((20 - distance) * 0.18, 0, 3.4);
  const targetSpeed = chase.baseSpeed + speedBoost;
  chase.velocity.lerp(toPlayer.multiplyScalar(targetSpeed), Math.min(1, delta * 3.5));
  chase.position.addScaledVector(chase.velocity, delta);
  chase.position.y = 4.5 + Math.sin(game.survivedSeconds * 5.2) * 0.4;

  chase.sprite.position.copy(chase.position);
  chase.light.position.copy(chase.position);
  chase.light.intensity = 14 + Math.max(0, 18 - distance) * 0.5;

  if (distance < chase.attackRange) {
    finishGame(false);
  }

  updateAudio(distance);
}

function updateAudio(distance) {
  if (!game.audioUnlocked) {
    return;
  }

  if (distance < chase.audioRange) {
    const targetVolume = THREE.MathUtils.clamp(
      1 - distance / chase.audioRange,
      0.08,
      0.85
    );
    entityAudio.volume += (targetVolume - entityAudio.volume) * 0.15;
    if (entityAudio.paused) {
      entityAudio.play().catch(() => {});
    }
  } else if (!entityAudio.paused) {
    entityAudio.volume *= 0.82;
    if (entityAudio.volume < 0.03) {
      stopEntityAudio();
    }
  }
}

function updateHud(distance) {
  const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  speedValue.textContent = `${horizontalSpeed.toFixed(1)} m/s`;
  staminaFill.style.transform = `scaleX(${player.stamina.toFixed(3)})`;
  distanceValue.textContent = `${Math.max(0, distance).toFixed(1)} m`;

  let threat = "Far";
  if (distance < chase.dangerRange) {
    threat = "Critical";
  } else if (distance < chase.audioRange) {
    threat = "Close";
  } else if (distance < 28) {
    threat = "Tracking";
  }
  threatValue.textContent = threat;
}

function finishGame(won) {
  if (game.state !== "playing") {
    return;
  }

  setGameState("finished");
  showMessage(
    won ? "Run Complete" : "Caught",
    won ? "You escaped." : "The entity reached you.",
    won
      ? "The exit sealed before the footsteps behind you could follow."
      : "Restart the run, use your slide to break line of sight, and keep momentum."
  );
}

function showMessage(eyebrow, title, body) {
  messageEyebrow.textContent = eyebrow;
  messageTitle.textContent = title;
  messageBody.textContent = body;
  messageOverlay.classList.remove("hidden");
}

function hideMessage() {
  messageOverlay.classList.add("hidden");
}

function pauseGame() {
  if (game.state !== "playing") {
    return;
  }
  setGameState("paused");
}

function resumeGame() {
  if (game.state !== "paused") {
    return;
  }
  setGameState("playing");
  requestPointerLock();
}

function returnToMenu() {
  setGameState("menu");
  hideMessage();
  resetGame();
}

function onPointerLockChange() {
  game.pointerLocked = document.pointerLockElement === canvas;
  if (game.state === "playing" && !game.pointerLocked) {
    pauseGame();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  update(delta);
}

function onMouseMove(event) {
  if (!game.pointerLocked || game.state !== "playing") {
    return;
  }

  player.yaw -= event.movementX * mouseSensitivity;
  player.pitch -= event.movementY * mouseSensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.35, 1.35);
  updateCameraTransform();
}

function onKeyDown(event) {
  keys[event.code] = true;

  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Space" && player.grounded && game.state === "playing") {
    player.velocity.y = player.jumpStrength;
    player.grounded = false;
  }

  if (event.code === "Escape") {
    if (game.state === "playing") {
      pauseGame();
    } else if (game.state === "paused") {
      resumeGame();
    }
  }
}

function onKeyUp(event) {
  keys[event.code] = false;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

startButton.addEventListener("click", startGame);
resumeButton.addEventListener("click", resumeGame);
restartButton.addEventListener("click", startGame);
menuButton.addEventListener("click", returnToMenu);
messageRestartButton.addEventListener("click", startGame);
messageMenuButton.addEventListener("click", returnToMenu);
document.addEventListener("pointerlockchange", onPointerLockChange);
document.addEventListener("mousemove", onMouseMove);
document.addEventListener("keydown", onKeyDown);
document.addEventListener("keyup", onKeyUp);
window.addEventListener("resize", onResize);
canvas.addEventListener("click", () => {
  if (game.state === "playing" && !game.pointerLocked) {
    requestPointerLock();
  }
});

createWorld();
createChaser();
resetGame();
animate();

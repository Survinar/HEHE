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

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const worldGroup = new THREE.Group();
scene.add(worldGroup);
const worldLighting = {
  moonLight: null,
  moonTarget: null,
};

const timer = new THREE.Timer();
timer.connect(document);
const keys = {};
const inputState = {
  jumpBuffer: 0,
  slideQueued: false,
};
const walls = [];
const wallMeshes = [];
const spawnPoint = new THREE.Vector3(0, 0, 132);
const exitPoint = new THREE.Vector3(0, 0, -132);

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
  sprintSpeed: 18.5,
  slideBoost: 24,
  maxAirSpeed: 18.5,
  grounded: true,
  coyoteTimer: 0,
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

const entitySwarm = {
  count: 67,
  radius: 1.4,
  baseSpeed: 6.6,
  attackRange: 2.6,
  audioRange: 18,
  dangerRange: 10,
  lightRange: 18,
};
const entities = [];
const entityVisual = {
  material: null,
  nearestLight: null,
  spawnPositions: [],
};

const mouseSensitivity = 0.0022;

function createWorld() {
  const ambient = new THREE.HemisphereLight(0x9ec7ff, 0x081018, 1.1);
  scene.add(ambient);

  const moonLight = new THREE.DirectionalLight(0xa4d5ff, 1.2);
  moonLight.position.set(18, 28, 12);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.near = 0.1;
  moonLight.shadow.camera.far = 120;
  moonLight.shadow.camera.left = -55;
  moonLight.shadow.camera.right = 55;
  moonLight.shadow.camera.top = 55;
  moonLight.shadow.camera.bottom = -55;
  moonLight.shadow.bias = -0.00015;
  scene.add(moonLight);
  const moonTarget = new THREE.Object3D();
  moonTarget.position.set(0, 0, 0);
  scene.add(moonTarget);
  moonLight.target = moonTarget;
  worldLighting.moonLight = moonLight;
  worldLighting.moonTarget = moonTarget;

  const roadTexture = makeRoadTexture();
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.repeat.set(20, 20);

  const cityGround = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.MeshStandardMaterial({
      color: 0x10171f,
      roughness: 0.96,
      metalness: 0.03,
      map: roadTexture,
    })
  );
  cityGround.rotation.x = -Math.PI / 2;
  cityGround.receiveShadow = true;
  worldGroup.add(cityGround);

  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c5c68,
    roughness: 0.98,
    metalness: 0.02,
  });
  const lotMaterialA = new THREE.MeshStandardMaterial({
    color: 0x324758,
    roughness: 0.84,
    metalness: 0.08,
  });
  const lotMaterialB = new THREE.MeshStandardMaterial({
    color: 0x5c3d48,
    roughness: 0.82,
    metalness: 0.06,
  });
  const lotMaterialC = new THREE.MeshStandardMaterial({
    color: 0x455b45,
    roughness: 0.86,
    metalness: 0.07,
  });
  const perimeterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a2a36,
    roughness: 0.92,
    metalness: 0.04,
  });

  const decorativeEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x20323f,
    roughness: 0.92,
    metalness: 0.03,
  });

  const sidewalks = [
    [0, 0.6, -156, 320, 4, 1.2],
    [0, 0.6, 156, 320, 4, 1.2],
    [-156, 0.6, 0, 4, 320, 1.2],
    [156, 0.6, 0, 4, 320, 1.2],
    [0, 0.45, 70, 320, 3, 0.9],
    [0, 0.45, 0, 320, 3, 0.9],
    [0, 0.45, -70, 320, 3, 0.9],
    [-70, 0.45, 0, 3, 320, 0.9],
    [70, 0.45, 0, 3, 320, 0.9],
  ];
  sidewalks.forEach(([x, y, z, sx, sz, h]) => {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(sx, h, sz),
      sidewalkMaterial
    );
    sidewalk.position.set(x, y, z);
    worldGroup.add(sidewalk);
  });

  const edgeDecor = [
    [0, 3, -172, 340, 8, 6],
    [0, 3, 172, 340, 8, 6],
    [-172, 3, 0, 8, 340, 6],
    [172, 3, 0, 8, 340, 6],
  ];
  edgeDecor.forEach(([x, y, z, sx, sz, h]) => {
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(sx, h, sz),
      decorativeEdgeMaterial
    );
    border.position.set(x, y, z);
    worldGroup.add(border);
  });

  const cityBlocks = [
    [-122, 0, 122, 34, 34, 22, lotMaterialA],
    [-86, 0, 122, 30, 34, 28, lotMaterialB],
    [-16, 0, 122, 44, 34, 20, lotMaterialC],
    [18, 0, 122, 20, 34, 26, lotMaterialA],
    [86, 0, 122, 30, 34, 18, lotMaterialB],
    [122, 0, 122, 34, 34, 24, lotMaterialC],
    [-122, 0, 86, 34, 20, 16, lotMaterialB],
    [-86, 0, 86, 30, 20, 21, lotMaterialC],
    [-16, 0, 86, 44, 20, 17, lotMaterialA],
    [18, 0, 86, 20, 20, 15, lotMaterialB],
    [86, 0, 86, 30, 20, 22, lotMaterialC],
    [122, 0, 86, 34, 20, 18, lotMaterialA],
    [-122, 0, 18, 34, 44, 27, lotMaterialC],
    [-86, 0, 18, 30, 44, 19, lotMaterialA],
    [-16, 0, 18, 44, 44, 25, lotMaterialB],
    [18, 0, 18, 20, 44, 17, lotMaterialC],
    [86, 0, 18, 30, 44, 30, lotMaterialA],
    [122, 0, 18, 34, 44, 21, lotMaterialB],
    [-122, 0, -18, 34, 20, 20, lotMaterialA],
    [-86, 0, -18, 30, 20, 15, lotMaterialB],
    [-16, 0, -18, 44, 20, 18, lotMaterialC],
    [18, 0, -18, 20, 20, 24, lotMaterialA],
    [86, 0, -18, 30, 20, 16, lotMaterialB],
    [122, 0, -18, 34, 20, 26, lotMaterialC],
    [-122, 0, -86, 34, 44, 18, lotMaterialB],
    [-86, 0, -86, 30, 44, 24, lotMaterialC],
    [-16, 0, -86, 44, 44, 28, lotMaterialA],
    [18, 0, -86, 20, 44, 19, lotMaterialB],
    [86, 0, -86, 30, 44, 23, lotMaterialC],
    [122, 0, -86, 34, 44, 17, lotMaterialA],
    [-122, 0, -122, 34, 34, 25, lotMaterialC],
    [-86, 0, -122, 30, 34, 18, lotMaterialA],
    [-16, 0, -122, 44, 34, 21, lotMaterialB],
    [18, 0, -122, 20, 34, 16, lotMaterialC],
    [86, 0, -122, 30, 34, 27, lotMaterialA],
    [122, 0, -122, 34, 34, 22, lotMaterialB],
  ];

  cityBlocks.forEach(([x, y, z, sx, sz, h, material]) => {
    addWall(x, y + h / 2, z, sx, sz, material, h);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(sx * 0.74, 0.8, sz * 0.74),
      new THREE.MeshStandardMaterial({
        color: 0x91a8bb,
        roughness: 0.72,
        metalness: 0.14,
      })
    );
    roof.position.set(x, h + 0.4, z);
    worldGroup.add(roof);
  });

  const barrierMaterial = new THREE.MeshStandardMaterial({
    color: 0xd77d4a,
    roughness: 0.72,
    metalness: 0.08,
  });
  const barriers = [
    [0, 1.2, 48, 12, 2.5, 2.4],
    [70, 1.2, -12, 2.5, 12, 2.4],
    [-70, 1.2, -60, 2.5, 12, 2.4],
    [0, 1.2, -108, 12, 2.5, 2.4],
  ];
  barriers.forEach(([x, y, z, sx, sz, h]) => addWall(x, y, z, sx, sz, barrierMaterial, h));

  const lightPoleGeometry = new THREE.CylinderGeometry(0.28, 0.34, 8, 10);
  const lightPoleMaterial = new THREE.MeshStandardMaterial({
    color: 0x8799a8,
    roughness: 0.55,
    metalness: 0.48,
  });
  const lampPositions = [
    [-70, 0, 140],
    [0, 0, 140],
    [70, 0, 140],
    [-140, 0, 70],
    [140, 0, 70],
    [-70, 0, 70],
    [70, 0, 70],
    [-140, 0, 0],
    [140, 0, 0],
    [-70, 0, 0],
    [70, 0, 0],
    [-140, 0, -70],
    [140, 0, -70],
    [-70, 0, -70],
    [70, 0, -70],
    [-70, 0, -140],
    [0, 0, -140],
    [70, 0, -140],
  ];

  lampPositions.forEach(([x, y, z]) => {
    const pole = new THREE.Mesh(lightPoleGeometry, lightPoleMaterial);
    pole.position.set(x, y + 4, z);
    worldGroup.add(pole);

    const lampBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdf9a })
    );
    lampBulb.position.set(x, 7.5, z);
    worldGroup.add(lampBulb);

    if (Math.abs(x) < 80 || Math.abs(z) < 80) {
      const lampGlow = new THREE.PointLight(0xffdf9a, 3.2, 14, 2);
      lampGlow.position.set(x, 7.5, z);
      worldGroup.add(lampGlow);
    }
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
    new THREE.SphereGeometry(260, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x163144,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.3,
    })
  );
  worldGroup.add(skyGlow);
}

function makeRoadTexture() {
  const size = 128;
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = size;
  canvasTexture.height = size;
  const ctx = canvasTexture.getContext("2d");

  ctx.fillStyle = "#1b2229";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  for (let i = 0; i < 160; i += 1) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }

  ctx.strokeStyle = "rgba(255, 229, 112, 0.75)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let x = 6; x <= size - 18; x += 20) {
    ctx.fillRect(x, size / 2 - 16, 10, 4);
    ctx.fillRect(x, size / 2 + 12, 10, 4);
  }
  for (let y = 6; y <= size - 18; y += 20) {
    ctx.fillRect(size / 2 - 16, y, 4, 10);
    ctx.fillRect(size / 2 + 12, y, 4, 10);
  }

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addWall(x, y, z, width, depth, material, height = 6) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = height > 3;
  mesh.receiveShadow = false;
  worldGroup.add(mesh);
  wallMeshes.push(mesh);
  walls.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  });
}

function getEntitySpawnPositions(count) {
  const laneValues = [-140, -70, 0, 70, 140];
  const streetSteps = [-140, -112, -84, -56, -28, 0, 28, 56, 84, 112, 140];
  const candidates = [];
  const seen = new Set();

  laneValues.forEach((x) => {
    streetSteps.forEach((z) => {
      const key = `${x}:${z}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(new THREE.Vector3(x, 4.5, z));
      }
    });
  });

  laneValues.forEach((z) => {
    streetSteps.forEach((x) => {
      const key = `${x}:${z}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(new THREE.Vector3(x, 4.5, z));
      }
    });
  });

  candidates.sort((a, b) => {
    const aDistance = a.distanceTo(spawnPoint);
    const bDistance = b.distanceTo(spawnPoint);
    return bDistance - aDistance;
  });

  return candidates.filter((position) => position.distanceTo(spawnPoint) > 26).slice(0, count);
}

function createChasers() {
  const texture = new THREE.TextureLoader().load("./entity1.png");
  texture.colorSpace = THREE.SRGBColorSpace;

  entityVisual.material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  entityVisual.spawnPositions = getEntitySpawnPositions(entitySwarm.count);

  entityVisual.spawnPositions.forEach((spawnPosition, index) => {
    const sprite = new THREE.Sprite(entityVisual.material);
    const scale = 6 + (index % 5) * 0.35;
    sprite.scale.set(scale, scale * 1.28, 1);
    sprite.position.copy(spawnPosition);
    worldGroup.add(sprite);

    entities.push({
      sprite,
      position: spawnPosition.clone(),
      velocity: new THREE.Vector3(),
      bobOffset: index * 0.37,
      speedOffset: (index % 7) * 0.12,
    });
  });

  entityVisual.nearestLight = new THREE.PointLight(0xff6880, 0, entitySwarm.lightRange, 2);
  entityVisual.nearestLight.position.set(0, 4.5, 0);
  worldGroup.add(entityVisual.nearestLight);
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
  Object.keys(keys).forEach((code) => {
    keys[code] = false;
  });
  inputState.jumpBuffer = 0;
  inputState.slideQueued = false;

  player.position.copy(spawnPoint);
  player.velocity.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = 0;
  player.currentHeight = player.standingHeight;
  player.coyoteTimer = 0;
  player.stamina = 1;
  player.slideTimer = 0;
  player.slideCooldown = 0;
  player.grounded = true;
  player.alive = true;

  entities.forEach((entity, index) => {
    const spawnPosition = entityVisual.spawnPositions[index];
    entity.position.copy(spawnPosition);
    entity.velocity.set(0, 0, 0);
    entity.sprite.position.copy(entity.position);
  });
  if (entityVisual.nearestLight) {
    entityVisual.nearestLight.intensity = 0;
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
  const nearestDistance = updateChasers(delta);
  updateShadowFocus();
  updateHud(nearestDistance);
  renderer.render(scene, camera);
}

function updateShadowFocus() {
  if (!worldLighting.moonLight || !worldLighting.moonTarget) {
    return;
  }

  worldLighting.moonTarget.position.set(player.position.x, 0, player.position.z);
  worldLighting.moonLight.position.set(
    player.position.x + 18,
    28,
    player.position.z + 12
  );
  worldLighting.moonLight.target.updateMatrixWorld();
}

function applyPlanarFriction(amount, delta) {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  if (speed < 0.0001) {
    player.velocity.x = 0;
    player.velocity.z = 0;
    return;
  }

  const drop = speed * amount * delta;
  const nextSpeed = Math.max(0, speed - drop);
  const scale = nextSpeed / speed;
  player.velocity.x *= scale;
  player.velocity.z *= scale;
}

function acceleratePlanar(direction, wishSpeed, acceleration, delta) {
  if (direction.lengthSq() === 0) {
    return;
  }

  const currentSpeed = player.velocity.x * direction.x + player.velocity.z * direction.z;
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) {
    return;
  }

  const accelSpeed = Math.min(addSpeed, acceleration * wishSpeed * delta);
  player.velocity.x += direction.x * accelSpeed;
  player.velocity.z += direction.z * accelSpeed;
}

function updatePlayer(delta) {
  if (inputState.jumpBuffer > 0) {
    inputState.jumpBuffer = Math.max(0, inputState.jumpBuffer - delta);
  }

  if (player.grounded) {
    player.coyoteTimer = 0.12;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - delta);
  }

  const moveInput = new THREE.Vector3();
  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const inputLength = Math.hypot(forward, strafe);
  if (inputLength > 0) {
    moveInput.set(strafe / inputLength, 0, forward / inputLength);
  }

  const wantsSprint = keys.ShiftLeft || keys.ShiftRight;
  const canSprint =
    wantsSprint &&
    player.stamina > 0.08 &&
    moveInput.lengthSq() > 0 &&
    player.slideTimer <= 0;
  const sprinting = canSprint && player.grounded;

  if (sprinting) {
    player.stamina = Math.max(0, player.stamina - delta * 0.22);
  } else {
    player.stamina = Math.min(1, player.stamina + delta * 0.15);
  }

  if (player.slideCooldown > 0) {
    player.slideCooldown = Math.max(0, player.slideCooldown - delta);
  }

  if (
    inputState.slideQueued &&
    player.slideTimer <= 0 &&
    player.slideCooldown <= 0 &&
    player.grounded &&
    sprinting
  ) {
    player.slideTimer = 0.9;
    player.slideCooldown = 0.35;
    const facing = new THREE.Vector3(
      -Math.sin(player.yaw),
      0,
      -Math.cos(player.yaw)
    ).normalize();
    player.velocity.x = facing.x * player.slideBoost;
    player.velocity.z = facing.z * player.slideBoost;
  }
  inputState.slideQueued = false;

  if (inputState.jumpBuffer > 0 && player.coyoteTimer > 0 && game.state === "playing") {
    player.velocity.y = player.jumpStrength;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.slideTimer = 0;
    inputState.jumpBuffer = 0;
  }

  const isSliding = player.slideTimer > 0;
  if (isSliding) {
    player.slideTimer = Math.max(0, player.slideTimer - delta);
  }

  const targetHeight = isSliding ? player.slideHeight : player.standingHeight;
  player.currentHeight += (targetHeight - player.currentHeight) * Math.min(1, delta * 12);

  const yawForward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const yawRight = new THREE.Vector3(-yawForward.z, 0, yawForward.x);
  const desiredDirection = new THREE.Vector3()
    .addScaledVector(yawRight, moveInput.x)
    .addScaledVector(yawForward, moveInput.z);

  if (desiredDirection.lengthSq() > 0) {
    desiredDirection.normalize();
  }

  const targetSpeed = isSliding
    ? player.slideBoost
    : canSprint
      ? player.sprintSpeed
      : player.walkSpeed;

  if (player.grounded) {
    applyPlanarFriction(isSliding ? 1.8 : player.groundFriction, delta);
  } else {
    applyPlanarFriction(player.airDrag, delta);
  }

  if (!isSliding && desiredDirection.lengthSq() > 0) {
    const wishSpeed = player.grounded ? targetSpeed : Math.min(targetSpeed, player.maxAirSpeed);
    const accel = player.grounded ? player.moveAcceleration : player.moveAcceleration * player.airControl;
    acceleratePlanar(desiredDirection, wishSpeed, accel, delta);
  }

  const planarSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  const maxPlanarSpeed = isSliding
    ? player.slideBoost
    : player.grounded
      ? targetSpeed
      : player.maxAirSpeed;
  if (planarSpeed > maxPlanarSpeed) {
    const scale = maxPlanarSpeed / planarSpeed;
    player.velocity.x *= scale;
    player.velocity.z *= scale;
  }

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

function resolveWorldCollisions(nextPosition, radius, velocity) {
  for (const wall of walls) {
    const nearestX = THREE.MathUtils.clamp(nextPosition.x, wall.minX, wall.maxX);
    const nearestZ = THREE.MathUtils.clamp(nextPosition.z, wall.minZ, wall.maxZ);
    const dx = nextPosition.x - nearestX;
    const dz = nextPosition.z - nearestZ;
    const distanceSq = dx * dx + dz * dz;

    if (distanceSq < radius * radius) {
      const distance = Math.sqrt(distanceSq) || 0.0001;
      const push = radius - distance;
      if (Math.abs(dx) > Math.abs(dz)) {
        const sign = Math.sign(dx) || 1;
        nextPosition.x += sign * push;
        velocity.x = 0;
      } else {
        const sign = Math.sign(dz) || 1;
        nextPosition.z += sign * push;
        velocity.z = 0;
      }
    }
  }
}

function resolvePlayerCollisions(nextPosition) {
  resolveWorldCollisions(nextPosition, player.radius, player.velocity);
}

function resolveChaserCollisions(nextPosition, velocity) {
  resolveWorldCollisions(nextPosition, entitySwarm.radius, velocity);
}

function updateChasers(delta) {
  let nearestDistance = Infinity;
  let nearestEntity = null;
  let playerCaught = false;

  for (const entity of entities) {
    const target = player.position.clone();
    target.y = entity.position.y;

    const toPlayer = target.sub(entity.position);
    const distance = toPlayer.length();
    if (distance > 0.001) {
      toPlayer.normalize();
    }

    const speedBoost = THREE.MathUtils.clamp((18 - distance) * 0.08, 0, 1.4);
    const targetSpeed = entitySwarm.baseSpeed + speedBoost + entity.speedOffset;
    entity.velocity.lerp(
      toPlayer.multiplyScalar(targetSpeed),
      Math.min(1, delta * 2.7)
    );

    const nextPosition = entity.position.clone().addScaledVector(entity.velocity, delta);
    resolveChaserCollisions(nextPosition, entity.velocity);
    entity.position.copy(nextPosition);
    entity.position.y = 4.5 + Math.sin(game.survivedSeconds * 5.2 + entity.bobOffset) * 0.4;
    entity.sprite.position.copy(entity.position);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEntity = entity;
    }

    if (distance < entitySwarm.attackRange) {
      playerCaught = true;
    }
  }

  if (entityVisual.nearestLight && nearestEntity) {
    entityVisual.nearestLight.position.copy(nearestEntity.position);
    const lightStrength = 1 - nearestDistance / entitySwarm.lightRange;
    entityVisual.nearestLight.intensity = THREE.MathUtils.clamp(lightStrength, 0, 1) * 12;
  }

  if (playerCaught) {
    finishGame(false);
  }

  updateAudio(nearestDistance);
  return nearestDistance;
}

function updateAudio(distance) {
  if (!game.audioUnlocked) {
    return;
  }

  if (distance < entitySwarm.audioRange) {
    const targetVolume = THREE.MathUtils.clamp(
      1 - distance / entitySwarm.audioRange,
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
  if (distance < entitySwarm.dangerRange) {
    threat = "Critical";
  } else if (distance < entitySwarm.audioRange) {
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
  inputState.jumpBuffer = 0;
  inputState.slideQueued = false;
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

function animate(timestamp) {
  requestAnimationFrame(animate);
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
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

  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Space") {
    inputState.jumpBuffer = 0.15;
  }

  if (event.code === "ControlLeft" || event.code === "ControlRight") {
    inputState.slideQueued = true;
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
createChasers();
resetGame();
animate();

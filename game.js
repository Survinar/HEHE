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
const healthValue = document.getElementById("healthValue");
const messageEyebrow = document.getElementById("messageEyebrow");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const entityAudio = document.getElementById("entityAudio");
const hitAudio = document.getElementById("hitAudio");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ed0ff);
scene.fog = new THREE.FogExp2(0xcfe6ff, 0.008);

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
  maxHealth: 3,
  health: 3,
  hitCooldown: 0,
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
const audioSystem = {
  initialized: false,
  entityTracks: [],
  hitAudioPrimed: false,
};

const ambientTrackSettings = [0.05, 0.035, 0.022];

const mouseSensitivity = 0.0022;

// --- OPTIMIZATION START: Constants and Asset Management ---
const textureLoader = new THREE.TextureLoader();
const roadTexture = makeRoadTexture();
roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(20, 20);

// Pool for common materials to avoid duplicates
const materials = {
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xb8c1c8, roughness: 0.98, metalness: 0.02 }),
  lotA: new THREE.MeshStandardMaterial({ color: 0x7e97aa, roughness: 0.84, metalness: 0.08 }),
  lotB: new THREE.MeshStandardMaterial({ color: 0xb1857f, roughness: 0.82, metalness: 0.06 }),
  lotC: new THREE.MeshStandardMaterial({ color: 0x89a284, roughness: 0.86, metalness: 0.07 }),
  perimeter: new THREE.MeshStandardMaterial({ color: 0x8fa0ad, roughness: 0.92, metalness: 0.04 }),
  decorative: new THREE.MeshStandardMaterial({ color: 0xa5b4c0, roughness: 0.92, metalness: 0.03 }),
  roof: new THREE.MeshStandardMaterial({ color: 0xdce6ee, roughness: 0.72, metalness: 0.14 }),
  barrier: new THREE.MeshStandardMaterial({ color: 0xe08d4e, roughness: 0.72, metalness: 0.08 }),
  lightPole: new THREE.MeshStandardMaterial({ color: 0x97a5af, roughness: 0.55, metalness: 0.48 }),
};

function createWorld() {
  const ambient = new THREE.HemisphereLight(0xdff1ff, 0x8fa37d, 1.8);
  scene.add(ambient);

  const sunLight = new THREE.DirectionalLight(0xfff4cf, 1.9);
  sunLight.position.set(24, 34, 18);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = 120;
  sunLight.shadow.camera.left = -55;
  sunLight.shadow.camera.right = 55;
  sunLight.shadow.camera.top = 55;
  sunLight.shadow.camera.bottom = -55;
  sunLight.shadow.bias = -0.00015;
  scene.add(sunLight);
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(0, 0, 0);
  scene.add(sunTarget);
  sunLight.target = sunTarget;
  worldLighting.moonLight = sunLight;
  worldLighting.moonTarget = sunTarget;

  const cityGround = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.MeshStandardMaterial({
      color: 0x4d5963,
      roughness: 0.94,
      metalness: 0.03,
      map: roadTexture,
    })
  );
  cityGround.rotation.x = -Math.PI / 2;
  cityGround.receiveShadow = true;
  worldGroup.add(cityGround);

  // --- Optimization: Grouped Sidewalks ---
  const sidewalks = [
    [0, 0.6, -156, 320, 4, 1.2], [0, 0.6, 156, 320, 4, 1.2],
    [-156, 0.6, 0, 4, 320, 1.2], [156, 0.6, 0, 4, 320, 1.2],
    [0, 0.45, 70, 320, 3, 0.9], [0, 0.45, 0, 320, 3, 0.9],
    [0, 0.45, -70, 320, 3, 0.9], [-70, 0.45, 0, 3, 320, 0.9],
    [70, 0.45, 0, 3, 320, 0.9],
  ];
  
  sidewalks.forEach(([x, y, z, sx, sz, h]) => {
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), materials.sidewalk);
    sidewalk.position.set(x, y, z);
    worldGroup.add(sidewalk);
  });

  const cityBlocks = [
    [-122, 0, 122, 34, 34, 22, materials.lotA], [-86, 0, 122, 30, 34, 28, materials.lotB],
    [-16, 0, 122, 44, 34, 20, materials.lotC], [18, 0, 122, 20, 34, 26, materials.lotA],
    [86, 0, 122, 30, 34, 18, materials.lotB], [122, 0, 122, 34, 34, 24, materials.lotC],
    [-122, 0, 86, 34, 20, 16, materials.lotB], [-86, 0, 86, 30, 20, 21, materials.lotC],
    [-16, 0, 86, 44, 20, 17, materials.lotA], [18, 0, 86, 20, 20, 15, materials.lotB],
    [86, 0, 86, 30, 20, 22, materials.lotC], [122, 0, 86, 34, 20, 18, materials.lotA],
    [-122, 0, 18, 34, 44, 27, materials.lotC], [-86, 0, 18, 30, 44, 19, materials.lotA],
    [-16, 0, 18, 44, 44, 25, materials.lotB], [18, 0, 18, 20, 44, 17, materials.lotC],
    [86, 0, 18, 30, 44, 30, materials.lotA], [122, 0, 18, 34, 44, 21, materials.lotB],
    [-122, 0, -18, 34, 20, 20, materials.lotA], [-86, 0, -18, 30, 20, 15, materials.lotB],
    [-16, 0, -18, 44, 20, 18, materials.lotC], [18, 0, -18, 20, 20, 24, materials.lotA],
    [86, 0, -18, 30, 20, 16, materials.lotB], [122, 0, -18, 34, 20, 26, materials.lotC],
    [-122, 0, -86, 34, 44, 18, materials.lotB], [-86, 0, -86, 30, 44, 24, materials.lotC],
    [-16, 0, -86, 44, 44, 28, materials.lotA], [18, 0, -86, 20, 44, 19, materials.lotB],
    [86, 0, -86, 30, 44, 23, materials.lotC], [122, 0, -86, 34, 44, 17, materials.lotA],
    [-122, 0, -122, 34, 34, 25, materials.lotC], [-86, 0, -122, 30, 34, 18, materials.lotA],
    [-16, 0, -122, 44, 34, 21, materials.lotB], [18, 0, -122, 20, 34, 16, materials.lotC],
    [86, 0, -122, 30, 34, 27, materials.lotA], [122, 0, -122, 34, 34, 22, materials.lotB],
  ];

  cityBlocks.forEach(([x, y, z, sx, sz, h, material]) => {
    addWall(x, y + h / 2, z, sx, sz, material, h);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.74, 0.8, sz * 0.74), materials.roof);
    roof.position.set(x, h + 0.4, z);
    worldGroup.add(roof);
  });

  const barriers = [[0, 1.2, 48, 12, 2.5, 2.4], [70, 1.2, -12, 2.5, 12, 2.4], [-70, 1.2, -60, 2.5, 12, 2.4], [0, 1.2, -108, 12, 2.5, 2.4]];
  barriers.forEach(([x, y, z, sx, sz, h]) => addWall(x, y, z, sx, sz, materials.barrier, h));

  // --- Optimization: InstancedMesh for Lamp Poles ---
  const lampPositions = [
    [-70, 0, 140], [0, 0, 140], [70, 0, 140], [-140, 0, 70], [140, 0, 70],
    [-70, 0, 70], [70, 0, 70], [-140, 0, 0], [140, 0, 0], [-70, 0, 0],
    [70, 0, 0], [-140, 0, -70], [140, 0, -70], [-70, 0, -70], [70, 0, -70],
    [-70, 0, -140], [0, 0, -140], [70, 0, -140]
  ];

  const poleGeo = new THREE.CylinderGeometry(0.28, 0.34, 8, 8); // Reduced segments
  const instancedPoles = new THREE.InstancedMesh(poleGeo, materials.lightPole, lampPositions.length);
  const dummy = new THREE.Object3D();
  lampPositions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y + 4, z);
    dummy.updateMatrix();
    instancedPoles.setMatrixAt(i, dummy.matrix);
  });
  worldGroup.add(instancedPoles);

  lampPositions.forEach(([x, y, z]) => {
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 6), new THREE.MeshBasicMaterial({ color: 0xf3f3f1 }));
    lampBulb.position.set(x, 7.5, z);
    worldGroup.add(lampBulb);
  });

  const exitRing = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.35, 12, 32), new THREE.MeshStandardMaterial({
    color: 0xc9ff70, emissive: 0x9cd64d, emissiveIntensity: 0.9, roughness: 0.32,
  }));
  exitRing.position.copy(exitPoint).setY(4.2);
  exitRing.rotation.x = Math.PI / 2;
  worldGroup.add(exitRing);

  const exitLight = new THREE.PointLight(0xd9ff9d, 12, 22, 2);
  exitLight.position.copy(exitPoint).setY(4.2);
  worldGroup.add(exitLight);
  // --- Optimization: InstancedMesh for Edge Decorations ---
  const edgeDecor = [
    [0, 8, -160, 332, 12, 16], [0, 8, 160, 332, 12, 16],
    [-160, 8, 0, 12, 332, 16], [160, 8, 0, 12, 332, 16],
  ];
  
  const dummy = new THREE.Object3D();
  const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
  const instancedEdges = new THREE.InstancedMesh(edgeGeo, materials.decorative, edgeDecor.length);
  edgeDecor.forEach(([x, y, z, sx, sz, h], i) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, h, sz);
    dummy.updateMatrix();
    instancedEdges.setMatrixAt(i, dummy.matrix);
    addWall(x, y, z, sx, sz, null, h);
  });
  worldGroup.add(instancedEdges);

  const skyGlow = new THREE.Mesh(
    new THREE.SphereGeometry(260, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xd7edff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.65,
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
  if (material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = height > 3;
    mesh.receiveShadow = false;
    worldGroup.add(mesh);
    wallMeshes.push(mesh);
  }
  
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
  player.health = player.maxHealth;
  player.hitCooldown = 0;
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
  objectiveText.textContent = "reach the exit";
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
  primeHitAudio();

  if (audioSystem.initialized) {
    audioSystem.entityTracks.forEach(({ audio, phase }) => {
      audio.currentTime = phase % Math.max(audio.duration || 1, 0.001);
      audio.play().catch(() => {});
    });
    return;
  }

  audioSystem.entityTracks = ambientTrackSettings.map((maxVolume, index) => {
    const audio = entityAudio.cloneNode(true);
    audio.loop = true;
    audio.volume = 0;
    audio.muted = false;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);

    const phase = (index * 0.17) % 1;
    const primePlayback = () => {
      if (!Number.isNaN(audio.duration) && audio.duration > 0) {
        audio.currentTime = phase * audio.duration;
      }
      audio.play().catch(() => {});
    };

    if (audio.readyState >= 1) {
      primePlayback();
    } else {
      audio.addEventListener("loadedmetadata", primePlayback, { once: true });
      audio.load();
    }

    return { audio, phase, maxVolume };
  });
  audioSystem.initialized = true;
}

function primeHitAudio() {
  if (audioSystem.hitAudioPrimed) {
    return;
  }

  const activate = () => {
    const previousMuted = hitAudio.muted;
    const previousVolume = hitAudio.volume;

    hitAudio.muted = true;
    hitAudio.volume = 0;
    hitAudio.currentTime = 0;

    hitAudio.play().then(() => {
      hitAudio.pause();
      hitAudio.currentTime = 0;
      hitAudio.muted = previousMuted;
      hitAudio.volume = previousVolume;
      audioSystem.hitAudioPrimed = true;
    }).catch(() => {
      hitAudio.muted = previousMuted;
      hitAudio.volume = previousVolume;
    });
  };

  if (hitAudio.readyState >= 2) {
    activate();
  } else {
    hitAudio.addEventListener("canplay", activate, { once: true });
    hitAudio.load();
  }
}

function stopEntityAudio() {
  audioSystem.entityTracks.forEach(({ audio }) => {
    audio.volume = 0;
    audio.pause();
  });
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
  if (player.hitCooldown > 0) {
    player.hitCooldown = Math.max(0, player.hitCooldown - delta);
  }

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

const _tempVector = new THREE.Vector3();
const _tempTarget = new THREE.Vector3();

function updateChasers(delta) {
  let nearestDistance = Infinity;
  let nearestEntity = null;
  let playerHit = false;

  for (const entity of entities) {
    _tempTarget.copy(player.position);
    _tempTarget.y = entity.position.y;

    _tempVector.subVectors(_tempTarget, entity.position);
    const distance = _tempVector.length();
    if (distance > 0.001) {
      _tempVector.normalize();
    }

    const speedBoost = THREE.MathUtils.clamp((18 - distance) * 0.08, 0, 1.4);
    const targetSpeed = entitySwarm.baseSpeed + speedBoost + entity.speedOffset;
    
    _tempVector.multiplyScalar(targetSpeed);
    entity.velocity.lerp(_tempVector, Math.min(1, delta * 2.7));

    entity.position.addScaledVector(entity.velocity, delta);
    resolveChaserCollisions(entity.position, entity.velocity);
    entity.position.y = 4.5 + Math.sin(game.survivedSeconds * 5.2 + entity.bobOffset) * 0.4;
    entity.sprite.position.copy(entity.position);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEntity = entity;
    }

    if (distance < entitySwarm.attackRange) {
      playerHit = true;
    }
  }

  if (entityVisual.nearestLight && nearestEntity) {
    entityVisual.nearestLight.position.copy(nearestEntity.position);
    const lightStrength = 1 - nearestDistance / entitySwarm.lightRange;
    entityVisual.nearestLight.intensity = THREE.MathUtils.clamp(lightStrength, 0, 1) * 12;
  }

  if (playerHit) {
    handlePlayerHit();
  }

  updateAudio(delta);
  return nearestDistance;
}

function updateAudio(delta) {
  if (!game.audioUnlocked || !audioSystem.initialized) {
    return;
  }

  let nearestDistance = Infinity;
  let nearbyCount = 0;

  entities.forEach((entity) => {
    const entityDistance = entity.position.distanceTo(player.position);
    nearestDistance = Math.min(nearestDistance, entityDistance);

    if (entityDistance < entitySwarm.audioRange) {
      nearbyCount += 1;
    }
  });

  const nearestPresence = THREE.MathUtils.clamp(
    1 - nearestDistance / entitySwarm.audioRange,
    0,
    1
  );
  const densityPresence = THREE.MathUtils.clamp(nearbyCount / 12, 0, 1);
  const swarmPresence = THREE.MathUtils.clamp(
    nearestPresence * 0.78 + densityPresence * 0.34,
    0,
    1
  );

  const lerpFactor = 1 - Math.exp(-12 * delta);

  audioSystem.entityTracks.forEach(({ audio, maxVolume }, index) => {
    const layerOffset = index * 0.22;
    const layerPresence = THREE.MathUtils.clamp(
      (swarmPresence - layerOffset) / Math.max(0.01, 1 - layerOffset),
      0,
      1
    );
    const targetVolume = layerPresence * layerPresence * maxVolume;

    if (audio.paused) {
      audio.play().catch(() => {});
    }

    audio.volume += (targetVolume - audio.volume) * lerpFactor;
  });
}

function updateHud(distance) {
  const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  healthValue.textContent = `${player.health} / ${player.maxHealth}`;
  speedValue.textContent = `${horizontalSpeed.toFixed(1)} m/s`;
  staminaFill.style.transform = `scaleX(${player.stamina.toFixed(3)})`;
  distanceValue.textContent = `${Math.max(0, distance).toFixed(1)} m`;

  let threat = "far";
  if (distance < entitySwarm.dangerRange) {
    threat = "critical";
  } else if (distance < entitySwarm.audioRange) {
    threat = "close";
  } else if (distance < 28) {
    threat = "tracking";
  }
  threatValue.textContent = threat;
}

function playHitSound() {
  hitAudio.pause();
  try {
    hitAudio.currentTime = 0;
  } catch (error) {
    hitAudio.load();
  }
  hitAudio.play().catch(() => {});
}

function handlePlayerHit() {
  if (game.state !== "playing" || player.hitCooldown > 0) {
    return;
  }

  player.health = Math.max(0, player.health - 1);
  player.hitCooldown = 0.9;
  playHitSound();

  if (player.health <= 0) {
    finishGame(false);
  }
}

function finishGame(won) {
  if (game.state !== "playing") {
    return;
  }

  setGameState("finished");
  showMessage(
    won ? "run complete" : "caught",
    won ? "you escaped." : "the entity reached you.",
    won
      ? "the exit sealed before the footsteps behind you could follow."
      : "restart the run, use your slide to break line of sight, and keep momentum."
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
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
}

window.addEventListener("blur", () => {
  Object.keys(keys).forEach((code) => {
    keys[code] = false;
  });
  if (game.state === "playing") {
    pauseGame();
  }
});

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

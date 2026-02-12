import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.createElement("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f12);
scene.fog = new THREE.Fog(0x0b0f12, 20, 220);

const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(40, 60, 20);
scene.add(sun);

const textureLoader = new THREE.TextureLoader();
function makeTiledTexture(url, repeatX, repeatY, colorSpace = THREE.NoColorSpace) {
  const tex = textureLoader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = colorSpace;
  return tex;
}

const ui = {
  health: document.getElementById("health"),
  food: document.getElementById("food"),
  storage: document.getElementById("storage"),
  location: document.getElementById("location"),
  objective: document.getElementById("objective"),
  noiseFill: document.getElementById("noise-fill"),
  hint: document.getElementById("hint"),
  mapModal: document.getElementById("map-modal"),
  mapClose: document.getElementById("close-map"),
  mapButtons: document.querySelectorAll(".map-buttons button"),
  outskirtsBtn: document.getElementById("outskirts-btn"),
  mobileControls: document.getElementById("mobile-controls"),
  shootBtn: document.getElementById("shoot-btn"),
  mapBtn: document.getElementById("map-btn"),
  moveStick: document.getElementById("move-stick"),
  moveKnob: document.querySelector(".stick-knob"),
};

const isMobile = /Mobi|Android/i.test(navigator.userAgent);
if (isMobile) {
  ui.mobileControls.classList.remove("hidden");
}

const player = {
  object: new THREE.Object3D(),
  health: 100,
  food: 0,
  storage: 0,
  speed: 6,
  runSpeed: 9,
  noise: 0,
  inGarage: true,
  exploredStore: false,
  returnedToBase: false,
  objectiveComplete: false,
  canShoot: true,
};

player.object.position.set(0, 1.6, 0);
player.object.add(camera);
scene.add(player.object);

let yaw = 0;
let pitch = 0;
const pitchLimit = 1.2;

const input = {
  forward: 0,
  right: 0,
  run: false,
};

const locations = {
  garage: {
    name: "Garage",
    center: new THREE.Vector3(0, 0, 0),
    size: new THREE.Vector3(18, 6, 18),
  },
  neighborhood: {
    name: "Neighborhood",
    center: new THREE.Vector3(80, 0, 0),
    size: new THREE.Vector3(90, 6, 90),
  },
  outskirts: {
    name: "Outskirts",
    center: new THREE.Vector3(200, 0, 0),
    size: new THREE.Vector3(100, 6, 100),
  },
};

let currentLocation = "garage";
function setGaragePropsVisible(visible) {
  for (const prop of garageProps) {
    prop.visible = visible;
  }
}

const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2227 });
const groundGeo = new THREE.PlaneGeometry(600, 600);
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const garageWallMat = new THREE.MeshStandardMaterial({
  map: makeTiledTexture(
    "assets/textures/garage/concrete_wall_diff_2k.jpg",
    2,
    1,
    THREE.SRGBColorSpace
  ),
  roughnessMap: makeTiledTexture("assets/textures/garage/concrete_wall_rough_2k.jpg", 2, 1),
  normalMap: makeTiledTexture("assets/textures/garage/concrete_wall_nor_gl_2k.jpg", 2, 1),
  roughness: 1,
});
garageWallMat.side = THREE.BackSide;

const garage = new THREE.Mesh(
  new THREE.BoxGeometry(18, 6, 18),
  garageWallMat
);
garage.position.set(0, 3, 0);
scene.add(garage);

const garageDoor = new THREE.Mesh(
  new THREE.BoxGeometry(6, 3, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x1f252a })
);
garageDoor.position.set(0, 1.5, 9);
scene.add(garageDoor);

const garageFloorMat = new THREE.MeshStandardMaterial({
  map: makeTiledTexture(
    "assets/textures/garage/garage_floor_diff_2k.jpg",
    3,
    3,
    THREE.SRGBColorSpace
  ),
  roughnessMap: makeTiledTexture("assets/textures/garage/garage_floor_rough_2k.jpg", 3, 3),
  normalMap: makeTiledTexture("assets/textures/garage/garage_floor_nor_gl_2k.jpg", 3, 3),
  roughness: 1,
});
const garageFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), garageFloorMat);
garageFloor.rotation.x = -Math.PI / 2;
garageFloor.position.set(0, 0.02, 0);
scene.add(garageFloor);

const garageLight = new THREE.PointLight(0xffe7cc, 0.9, 30, 2);
garageLight.position.set(0, 4.5, -2);
scene.add(garageLight);

function makeLabelSprite(text, bgColor, textColor = "#f0f4f8") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);
  ctx.fillStyle = textColor;
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  return new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
}

const garageProps = [];
function addGarageProp(label, color, position, scale = [2.2, 2.2, 1]) {
  const material = makeLabelSprite(label, color);
  const sprite = new THREE.Sprite(material);
  sprite.position.set(position.x, position.y, position.z);
  sprite.scale.set(scale[0], scale[1], scale[2]);
  scene.add(sprite);
  garageProps.push(sprite);
}

addGarageProp("WORKBENCH", "#4b5561", new THREE.Vector3(-4.5, 1.2, -6), [3.2, 2.2, 1]);
addGarageProp("TOOLS", "#2f4858", new THREE.Vector3(-6.5, 2.0, -4), [2.2, 1.8, 1]);
addGarageProp("SHELVES", "#3f3a30", new THREE.Vector3(5.8, 1.8, -5.5), [2.6, 2.6, 1]);
addGarageProp("SUPPLIES", "#4a3f2f", new THREE.Vector3(6.5, 0.9, -2.5), [2.0, 1.6, 1]);
addGarageProp("CRATES", "#5a4630", new THREE.Vector3(4.5, 0.8, 4.5), [2.0, 1.6, 1]);
addGarageProp("GAUGES", "#3b4f4a", new THREE.Vector3(-5.5, 2.2, 3.5), [1.6, 1.6, 1]);
setGaragePropsVisible(true);

const store = new THREE.Mesh(
  new THREE.BoxGeometry(16, 5, 12),
  new THREE.MeshStandardMaterial({ color: 0x4c4a3f })
);
store.position.set(90, 2.5, -8);
scene.add(store);

const storeSign = new THREE.Mesh(
  new THREE.BoxGeometry(6, 1.2, 0.2),
  new THREE.MeshStandardMaterial({ color: 0xe7b866 })
);
storeSign.position.set(90, 5.2, -14);
scene.add(storeSign);

const scientist = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.5, 1.2, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0x99d3ff })
);
scientist.position.set(200, 1.6, 0);
scientist.visible = false;
scene.add(scientist);

const pickups = [];
function addPickup(type, position, amount = 1) {
  const color = type === "food" ? 0x7dd56f : 0x6fb1d5;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.copy(position);
  scene.add(mesh);
  pickups.push({ type, amount, mesh, taken: false });
}

for (let i = 0; i < 6; i += 1) {
  addPickup("food", new THREE.Vector3(78 + i * 2, 0.5, 6 - i * 2));
}
addPickup("med", new THREE.Vector3(92, 0.5, -12));

const zombies = [];
const zombieFrontTexture = new THREE.TextureLoader().load("assets/zombies/zombie_front.webp");
const zombieBackTexture = new THREE.TextureLoader().load("assets/zombies/zombie_back.jpg");
const zombieSideTexture = new THREE.TextureLoader().load("assets/zombies/zombie_side.jpg");
zombieFrontTexture.flipY = false;
zombieBackTexture.flipY = false;
zombieSideTexture.flipY = false;

function addZombie(position, location) {
  const material = new THREE.SpriteMaterial({ map: zombieFrontTexture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.position.y = 1.6;
  sprite.scale.set(2.2, 3.2, 1);
  scene.add(sprite);
  zombies.push({
    mesh: sprite,
    material,
    health: 40,
    speed: 1.4,
    state: "idle",
    attackCooldown: 0,
    location,
    visionRange: 14,
    fov: Math.PI * 0.55,
    bobTime: Math.random() * Math.PI * 2,
    facing: new THREE.Vector3(0, 0, 1),
  });
}

for (let i = 0; i < 7; i += 1) {
  addZombie(new THREE.Vector3(70 + i * 4, 1.6, 6 - i * 3), "neighborhood");
}
for (let i = 0; i < 6; i += 1) {
  addZombie(new THREE.Vector3(195 + i * 4, 1.6, -10 + i * 2), "outskirts");
}

const raycaster = new THREE.Raycaster();

function setLocation(name) {
  currentLocation = name;
  const loc = locations[name];
  player.object.position.set(loc.center.x, 1.6, loc.center.z + 2);
  ui.location.textContent = `Location: ${loc.name}`;
  setGaragePropsVisible(name === "garage");

  if (name === "outskirts") {
    scientist.visible = true;
  }
}

function clampToLocation(pos) {
  const loc = locations[currentLocation];
  const half = loc.size.clone().multiplyScalar(0.5);
  pos.x = THREE.MathUtils.clamp(pos.x, loc.center.x - half.x + 1, loc.center.x + half.x - 1);
  pos.z = THREE.MathUtils.clamp(pos.z, loc.center.z - half.z + 1, loc.center.z + half.z - 1);
  return pos;
}

function updateUI() {
  ui.health.textContent = `Health: ${Math.max(0, Math.floor(player.health))}`;
  ui.food.textContent = `Food: ${player.food}`;
  ui.storage.textContent = `Storage: ${player.storage}`;
  ui.noiseFill.style.width = `${Math.min(100, player.noise * 100)}%`;
  if (player.objectiveComplete) {
    ui.objective.textContent = "Objective: Scientist found. Get back to base.";
  } else if (!player.exploredStore) {
    ui.objective.textContent = "Objective: Raid the store for supplies.";
  } else if (!player.returnedToBase) {
    ui.objective.textContent = "Objective: Return to the garage.";
  } else {
    ui.objective.textContent = "Objective: Find the scientist.";
  }
}

function shoot() {
  if (!player.canShoot || player.health <= 0) return;
  player.canShoot = false;
  setTimeout(() => {
    player.canShoot = true;
  }, 300);

  player.noise = Math.min(1, player.noise + 0.7);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), direction);
  const targets = zombies.map((z) => z.mesh);
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length > 0) {
    const hit = hits[0].object;
    const zombie = zombies.find((z) => z.mesh === hit);
    if (zombie) {
      zombie.health -= 25;
      if (zombie.health <= 0) {
        zombie.mesh.visible = false;
        zombie.state = "dead";
      }
    }
  }
}

const keyMap = {
  KeyW: () => (input.forward = 1),
  KeyS: () => (input.forward = -1),
  KeyA: () => (input.right = -1),
  KeyD: () => (input.right = 1),
  ShiftLeft: () => (input.run = true),
  ShiftRight: () => (input.run = true),
};

const keyUpMap = {
  KeyW: () => (input.forward = input.forward === 1 ? 0 : input.forward),
  KeyS: () => (input.forward = input.forward === -1 ? 0 : input.forward),
  KeyA: () => (input.right = input.right === -1 ? 0 : input.right),
  KeyD: () => (input.right = input.right === 1 ? 0 : input.right),
  ShiftLeft: () => (input.run = false),
  ShiftRight: () => (input.run = false),
};

window.addEventListener("keydown", (event) => {
  if (keyMap[event.code]) keyMap[event.code]();
  if (event.code === "KeyM") openMap();
});

window.addEventListener("keyup", (event) => {
  if (keyUpMap[event.code]) keyUpMap[event.code]();
});

let isMouseLooking = false;
renderer.domElement.addEventListener("mousedown", (event) => {
  if (isMobile) return;
  if (event.button === 0) {
    isMouseLooking = true;
  }
});

window.addEventListener("mouseup", (event) => {
  if (isMobile) return;
  if (event.button === 0) {
    isMouseLooking = false;
  }
});

window.addEventListener("mousemove", (event) => {
  if (isMobile || !isMouseLooking) return;
  yaw -= event.movementX * 0.002;
  pitch -= event.movementY * 0.002;
  pitch = THREE.MathUtils.clamp(pitch, -pitchLimit, pitchLimit);
  player.object.rotation.y = yaw;
  camera.rotation.x = pitch;
});

ui.shootBtn.addEventListener("click", shoot);
ui.mapBtn.addEventListener("click", openMap);

let stickActive = false;
let stickOrigin = { x: 0, y: 0 };
let stickValue = { x: 0, y: 0 };

ui.moveStick.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  stickActive = true;
  stickOrigin = { x: touch.clientX, y: touch.clientY };
});

ui.moveStick.addEventListener("touchmove", (event) => {
  if (!stickActive) return;
  const touch = event.touches[0];
  const dx = touch.clientX - stickOrigin.x;
  const dy = touch.clientY - stickOrigin.y;
  const max = 40;
  const clampX = THREE.MathUtils.clamp(dx, -max, max);
  const clampY = THREE.MathUtils.clamp(dy, -max, max);
  stickValue = { x: clampX / max, y: clampY / max };
  ui.moveKnob.style.transform = `translate(${clampX}px, ${clampY}px)`;
});

ui.moveStick.addEventListener("touchend", () => {
  stickActive = false;
  stickValue = { x: 0, y: 0 };
  ui.moveKnob.style.transform = "translate(0, 0)";
});

let lookTouch = null;
window.addEventListener("touchstart", (event) => {
  if (!isMobile) return;
  const touch = event.touches[0];
  if (touch.clientX > window.innerWidth * 0.45) {
    lookTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }
});

window.addEventListener("touchmove", (event) => {
  if (!isMobile || lookTouch === null) return;
  for (const touch of event.touches) {
    if (touch.identifier === lookTouch.id) {
      const dx = touch.clientX - lookTouch.x;
      const dy = touch.clientY - lookTouch.y;
      lookTouch.x = touch.clientX;
      lookTouch.y = touch.clientY;
      yaw -= dx * 0.004;
      pitch -= dy * 0.004;
      pitch = THREE.MathUtils.clamp(pitch, -pitchLimit, pitchLimit);
      player.object.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
  }
});

window.addEventListener("touchend", (event) => {
  if (!isMobile || lookTouch === null) return;
  for (const touch of event.changedTouches) {
    if (touch.identifier === lookTouch.id) {
      lookTouch = null;
    }
  }
});

function openMap() {
  if (!player.returnedToBase || currentLocation !== "garage") return;
  ui.mapModal.classList.remove("hidden");
  if (document.pointerLockElement === document.body) {
    document.exitPointerLock();
  }
}

ui.mapClose.addEventListener("click", () => {
  ui.mapModal.classList.add("hidden");
});

ui.mapButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const loc = btn.dataset.loc;
    if (btn.disabled) return;
    setLocation(loc);
    ui.mapModal.classList.add("hidden");
  });
});

function updatePlayer(dt) {
  const speed = input.run ? player.runSpeed : player.speed;
  const moveX = isMobile ? stickValue.x : input.right;
  const moveZ = isMobile ? -stickValue.y : input.forward;

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.object.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(player.object.quaternion);
  const moveDir = new THREE.Vector3();
  moveDir.addScaledVector(forward, moveZ);
  moveDir.addScaledVector(right, moveX);
  if (moveDir.lengthSq() > 0.001) {
    moveDir.normalize();
    player.object.position.addScaledVector(moveDir, speed * dt);
    player.noise = Math.min(1, player.noise + (input.run ? 0.02 : 0.008));
  }

  player.object.position.y = 1.6;
  clampToLocation(player.object.position);

  player.noise = Math.max(0, player.noise - dt * 0.25);

  player.inGarage = currentLocation === "garage";
}

function updatePickups() {
  for (const pickup of pickups) {
    if (pickup.taken) continue;
    if (pickup.mesh.position.distanceTo(player.object.position) < 1.6) {
      pickup.taken = true;
      pickup.mesh.visible = false;
      if (pickup.type === "food") player.food += pickup.amount;
      if (pickup.type === "med") player.health = Math.min(100, player.health + 25);
    }
  }
}

function updateZombies(dt) {
  for (const zombie of zombies) {
    if (zombie.state === "dead" || zombie.location !== currentLocation) continue;

    const toPlayer = new THREE.Vector3().subVectors(player.object.position, zombie.mesh.position);
    const dist = toPlayer.length();
    const noiseRadius = 6 + player.noise * 18;
    const canHear = dist < noiseRadius;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(zombie.mesh.quaternion);
    const toPlayerDir = toPlayer.clone().normalize();
    const angle = forward.angleTo(toPlayerDir);
    const canSee = dist < zombie.visionRange && angle < zombie.fov * 0.5;

    if ((canHear || canSee) && !player.inGarage) {
      zombie.state = "chase";
    } else if (dist > zombie.visionRange * 1.2) {
      zombie.state = "idle";
    }

    if (zombie.state === "chase") {
      const move = toPlayerDir.multiplyScalar(zombie.speed * dt);
      zombie.mesh.position.add(move);
      zombie.facing.copy(toPlayerDir);
    }

    zombie.bobTime += dt * 6;
    zombie.mesh.position.y = 1.6 + Math.sin(zombie.bobTime) * 0.05;
    const viewDot = zombie.facing.dot(toPlayerDir);
    if (Math.abs(viewDot) < 0.35) {
      zombie.material.map = zombieSideTexture;
    } else {
      zombie.material.map = viewDot < 0 ? zombieBackTexture : zombieFrontTexture;
    }

    zombie.attackCooldown -= dt;
    if (dist < 1.4 && zombie.attackCooldown <= 0 && !player.inGarage) {
      zombie.attackCooldown = 1.2;
      player.health = Math.max(0, player.health - 10);
    }
  }
}

function updateProgression() {
  const storeDist = player.object.position.distanceTo(store.position);
  if (storeDist < 6) {
    player.exploredStore = true;
  }

  if (player.inGarage && player.exploredStore) {
    player.returnedToBase = true;
    if (player.food > 0) {
      player.storage += player.food;
      player.food = 0;
    }
  }

  if (player.returnedToBase) {
    ui.outskirtsBtn.disabled = false;
  }

  if (scientist.visible && player.object.position.distanceTo(scientist.position) < 2) {
    player.objectiveComplete = true;
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

let lastTime = performance.now();
function animate(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  updatePlayer(dt);
  updateZombies(dt);
  updatePickups();
  updateProgression();
  updateUI();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

ui.hint.textContent = isMobile
  ? "Use the joystick to move. Drag right side to look. Tap Shoot."
  : "Hold left mouse to look. WASD to move. Shift to sprint. M for map.";

requestAnimationFrame(animate);

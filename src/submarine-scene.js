import * as THREE from "three/webgpu";
import { color, uv, vec2 } from "three/tsl";
import { createPorcelainBrassSubmarine } from
  "./submarine/submarine-model.js";
import { createHudPanel } from "./bot/hud-panel.js";
import { createBubbles } from "./bot/underwater-bubbles.js";

const GROUND_Y = -1.34;
const TAU = Math.PI * 2;

function smooth01(value) {
  return value * value * (3 - 2 * value);
}

function buildStudioEnvironment() {
  const width = 384;
  const height = 192;
  const data = new Float32Array(width * height * 4);
  const softboxes = [
    { direction: new THREE.Vector3(0.45, 0.85, 0.35), intensity: 5.2, exponent: 16, color: [1, 0.98, 0.94] },
    { direction: new THREE.Vector3(-0.85, 0.25, 0.15), intensity: 1.5, exponent: 7, color: [0.82, 0.9, 1] },
    { direction: new THREE.Vector3(0.15, 0.35, -0.95), intensity: 2.6, exponent: 12, color: [1, 0.86, 0.66] },
    { direction: new THREE.Vector3(0.95, 0.05, 0.3), intensity: 0.9, exponent: 9, color: [1, 0.95, 0.85] },
    { direction: new THREE.Vector3(0, -1, 0), intensity: 0.5, exponent: 4, color: [1, 0.93, 0.82] },
  ];
  for (const softbox of softboxes) softbox.direction.normalize();
  const direction = new THREE.Vector3();
  for (let y = 0; y < height; y += 1) {
    const phi = (y + 0.5) / height * Math.PI;
    for (let x = 0; x < width; x += 1) {
      const theta = (x + 0.5) / width * TAU;
      direction.set(
        -Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
        -Math.sin(phi) * Math.cos(theta),
      );
      const up = direction.y * 0.5 + 0.5;
      let red = THREE.MathUtils.lerp(0.32, 1.05, smooth01(up)) * 0.9;
      let green = red * 0.985;
      let blue = red * 0.94;
      for (const softbox of softboxes) {
        const weight = softbox.intensity * Math.pow(
          Math.max(direction.dot(softbox.direction), 0),
          softbox.exponent,
        );
        red += weight * softbox.color[0];
        green += weight * softbox.color[1];
        blue += weight * softbox.color[2];
      }
      const index = (y * width + x) * 4;
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = 1;
    }
  }
  const environment = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.magFilter = THREE.LinearFilter;
  environment.minFilter = THREE.LinearFilter;
  environment.needsUpdate = true;
  return environment;
}

/* —— 深海发光浮游孢子粒子系统（丰富场景空间感） —— */
function createBioluminescentSpores(count = 72) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const data = [];
  const palette = [0x79e2d0, 0x5df5e0, 0xffd84d, 0xff5d9e, 0x82b4ff];

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const r = 1.2 + Math.random() * 3.8;
    const y = -0.8 + Math.random() * 2.8;
    const z = Math.sin(angle) * r;
    const x = Math.cos(angle) * r;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const c = new THREE.Color(palette[i % palette.length]);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    data.push({
      x, y, z,
      phase: Math.random() * TAU,
      speedX: (Math.random() - 0.5) * 0.08,
      speedY: 0.04 + Math.random() * 0.08,
      wobbleSpeed: 0.5 + Math.random() * 1.5,
    });
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.038,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);

  return {
    object: points,
    update(now, dt) {
      const pos = geo.attributes.position;
      for (let i = 0; i < count; i += 1) {
        const d = data[i];
        d.y += d.speedY * dt;
        if (d.y > 2.2) d.y = -0.8;
        const wx = Math.sin(now * 0.001 * d.wobbleSpeed + d.phase) * 0.12;
        const wz = Math.cos(now * 0.001 * d.wobbleSpeed + d.phase) * 0.12;
        pos.setXYZ(i, d.x + wx, d.y, d.z + wz);
      }
      pos.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createPorcelainBrassSubmarineScene({
  renderer,
  scene,
  camera,
  controls,
  dom = document.body,
}) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.background = new THREE.Color(0xb8b1a7);
  const environment = buildStudioEnvironment();
  scene.environment = environment;
  scene.environmentIntensity = 0.36;

  const submarine = createPorcelainBrassSubmarine();
  scene.add(submarine.object);

  /* —— 舰载 AI 面板：moodie bot 植入潜水仓（玻璃穹顶内） —— */
  const hud = createHudPanel({
    scene,
    camera,
    dom,
    position: new THREE.Vector3(0, 0.56, 0.72),
    radius: 0.32,
  });
  const hudLight = new THREE.PointLight(0xffd9a4, 1.1, 2.8, 2);
  hudLight.position.set(0, 0.56, 0.9);
  scene.add(hudLight);

  // 包装 setColor 联动舱内点光源
  const originalSetColor = hud.setColor.bind(hud);
  hud.setColor = (hex) => {
    originalSetColor(hex);
    if (hex) hudLight.color.set(hex);
  };

  /* —— 海洋气泡 —— */
  const bubbles = createBubbles({
    count: 140,
    center: new THREE.Vector3(0, -0.35, 0),
    radius: 3.6,
    height: 4.6,
  });
  scene.add(bubbles.object);

  /* —— 深海生物发光游弋孢子群 —— */
  const spores = createBioluminescentSpores(72);
  scene.add(spores.object);

  const key = new THREE.DirectionalLight(0xffead4, 1.85);
  key.position.set(4.2, 5.4, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3.2;
  key.shadow.camera.bottom = -3.2;
  key.shadow.camera.right = 3.2;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 16;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcadcf2, 0.32);
  fill.position.set(-4.5, 2.2, 2.1);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc98f, 0.58);
  rim.position.set(-1.8, 2.8, -4.8);
  scene.add(rim);

  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.22 });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(30, 48),
    groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  ground.receiveShadow = true;
  scene.add(ground);

  const blushMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  blushMaterial.colorNode = color(0x6b5c44);
  blushMaterial.opacityNode = uv()
    .sub(vec2(0.5, 0.5))
    .length()
    .mul(2)
    .oneMinus()
    .clamp(0, 1)
    .pow(1.7)
    .mul(0.3);
  const blush = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 3.4),
    blushMaterial,
  );
  blush.rotation.x = -Math.PI / 2;
  blush.position.set(0, GROUND_Y + 0.004, -0.1);
  blush.renderOrder = -2;
  scene.add(blush);

  const meshVisibility = new Map();
  submarine.object.traverse((object) => {
    if (object.isMesh) meshVisibility.set(object, object.visible);
  });

  return {
    setDebugMode(mode) {
      const hullOnly = mode === "hull-loft";
      const withoutGlass = mode === "no-glass";
      for (const [mesh, visible] of meshVisibility) {
        mesh.visible = hullOnly
          ? mesh.name === "hull"
          : visible && !(
            withoutGlass &&
            (mesh.material === submarine.materials.glass ||
              mesh.material === submarine.materials.lampGlass)
          );
      }
      for (const material of Object.values(submarine.materials)) {
        material.wireframe = mode === "topology" || hullOnly;
        material.needsUpdate = true;
      }
    },
    update({ delta, elapsed }) {
      const now = performance.now();
      submarine.update({ delta, elapsed });
      bubbles.update({ delta });
      spores.update(now, delta);
      hud.update(now, elapsed);
      if (controls) {
        controls.target.y = Math.max(GROUND_Y + 0.25, controls.target.y);
        camera.position.y = Math.max(GROUND_Y + 0.12, camera.position.y);
      }
    },
    bot() {
      return hud;
    },
    metrics() {
      return {
        sculptedParts: submarine.stats.length,
        referenceTriangles: submarine.totalTriangles,
        hullRings: 56,
        hullSegments: 128,
      };
    },
    dispose() {
      scene.environment = null;
      environment.dispose();
      submarine.dispose();
      hud.dispose();
      hudLight.dispose();
      bubbles.dispose();
      spores.dispose();
      ground.geometry.dispose();
      groundMaterial.dispose();
      blush.geometry.dispose();
      blushMaterial.dispose();
    },
  };
}

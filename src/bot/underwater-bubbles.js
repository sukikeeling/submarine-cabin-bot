/* ============================================================
   underwater-bubbles.js —— 海洋气泡（移植自 D:\vibe-submarine
   的 particle-system.js，feat/deep-sea-enhancement c75459b）
   InstancedMesh 单次绘制，气泡上升 + 摆动 + 缩放脉动。
   ============================================================ */
import * as THREE from "three/webgpu";

const TAU = Math.PI * 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBubbles({
  count = 140,
  center = new THREE.Vector3(0, -0.35, 0),
  radius = 3.6,
  height = 4.6,
} = {}) {
  const group = new THREE.Group();
  group.name = "ocean-bubbles";
  const rand = mulberry32(20260816);

  const bubbleGeo = new THREE.SphereGeometry(1, 8, 6);
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: 0xd4eef8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, count);
  bubbles.name = "bubbles";
  bubbles.frustumCulled = false;

  const bData = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * TAU;
    const r = rand() * radius;
    const x = center.x + Math.cos(angle) * r;
    const z = center.z + Math.sin(angle) * r;
    const y = center.y - height / 2 + rand() * height;
    const scale = 0.012 + rand() * 0.03; // 12-42mm
    const speed = 0.16 + rand() * 0.42; // m/s 上升
    const wobblePhase = rand() * TAU;
    const wobbleFreq = 0.6 + rand() * 1.2;
    const wobbleAmp = 0.03 + rand() * 0.07;
    bData.push({ x, y, z, scale, speed, wobblePhase, wobbleFreq, wobbleAmp, origX: x, origZ: z });
    dummy.position.set(x, y, z);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    bubbles.setMatrixAt(i, dummy.matrix);
  }
  bubbles.instanceMatrix.needsUpdate = true;
  group.add(bubbles);

  let elapsed = 0;

  function update({ delta }) {
    if (!delta) return;
    elapsed += delta;
    for (let i = 0; i < count; i += 1) {
      const b = bData[i];
      b.y += b.speed * delta;
      if (b.y > center.y + height / 2) {
        b.y = center.y - height / 2;
        const angle = rand() * TAU;
        const r = rand() * radius;
        b.origX = center.x + Math.cos(angle) * r;
        b.origZ = center.z + Math.sin(angle) * r;
      }
      const wobble = Math.sin(elapsed * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
      dummy.position.set(b.origX + wobble, b.y, b.origZ);
      dummy.scale.setScalar(b.scale * (1 + Math.sin(elapsed * 1.5 + i) * 0.15));
      dummy.updateMatrix();
      bubbles.setMatrixAt(i, dummy.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    bubbleGeo.dispose();
    bubbleMat.dispose();
    bubbles.dispose();
  }

  return { object: group, update, dispose };
}

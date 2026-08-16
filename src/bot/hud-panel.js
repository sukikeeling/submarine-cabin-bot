/* ============================================================
   hud-panel.js —— 潜水舱内的舰载 AI 全息面板
   - FaceEngine（自动轮询） + FaceCanvas（表情绘制）
   - CanvasTexture 贴到驾驶舱玻璃穹顶内的圆形面板
   - 黄铜边框 + 状态光环 + 台词气泡（DOM 投影）
   - 点击摸头 / 换心情 / 暂停 / 换色
   ============================================================ */
import * as THREE from "three/webgpu";
import { FaceEngine } from "./face-engine.js";
import { FaceCanvas } from "./face-canvas.js";

const TAU = Math.PI * 2;

export function createHudPanel({ scene, camera, dom, position, radius = 0.3 }) {
  const group = new THREE.Group();
  group.position.copy(position);

  /* —— 表情引擎 + 画布 —— */
  const canvas = document.createElement("canvas");
  const face = new FaceCanvas(canvas, { scale: 3 });
  const engine = new FaceEngine({
    onFx: (type, payload) => face.handleFx(type, payload),
  });

  /* —— 面板纹理 —— */
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  /* —— 面板 mesh（全息球：小脸包在立体球面上，告别平面贴片感） —— */
  const panelGeometry = new THREE.SphereGeometry(radius, 48, 32);
  // 预计算 UV：正面(+z)平面投影采样画布中央(小脸)；背面顶点 UV 强制 (0,0)
  // 深色底角落——既消除"背后镜像眼睛"，又避开 WebGPU 下 TSL 材质的渲染问题
  {
    const uv = panelGeometry.attributes.uv;
    const pos = panelGeometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const d = Math.sqrt(x * x + y * y + z * z) || 1;
      if (z / d < 0) {
        uv.setXY(i, 0, 0); // 背面 → 深色底角落
      } else {
        uv.setXY(i, 0.5 + (x / d) * 0.5, 0.5 + (y / d) * 0.5);
      }
    }
    uv.needsUpdate = true;
  }
  // 不透明材质 + 深色底纹理（WebGPU 下透明纹理渲染不可靠，高对比方案）
  const panelMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.FrontSide,
  });
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  panel.name = "botPanel";
  panel.frustumCulled = false; // WebGPU 渲染器对旋转球体的视锥剔除有误杀，关闭
  group.add(panel);

  /* —— 黄铜赤道环 + 顶部支架（学主项目 sweepTube 环管思路） —— */
  const rimPoints = [];
  for (let i = 0; i <= 72; i += 1) {
    const a = (i / 72) * TAU;
    rimPoints.push(new THREE.Vector3(Math.cos(a) * (radius + 0.045), Math.sin(a) * (radius + 0.045), 0));
  }
  const rimGeometry = tubeFromPoints(rimPoints, 0.016, 10);
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xc7973f,
    metalness: 1,
    roughness: 0.32,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.8,
  });
  const rim = new THREE.Mesh(rimGeometry, brass);
  rim.rotation.x = Math.PI / 2; // 赤道环（绕 y 轴）
  group.add(rim);

  // 经线装饰（2 条正交弧，学主项目经纬笼架）
  const meridianGeometry = tubeFromPoints(
    meridianPoints(radius + 0.045),
    0.01,
    8,
  );
  const meridian = new THREE.Mesh(meridianGeometry, brass);
  group.add(meridian);
  const meridian2 = new THREE.Mesh(meridianGeometry, brass);
  meridian2.rotation.y = Math.PI / 2;
  group.add(meridian2);

  /* —— 支架：从舱顶垂下的黄铜杆 —— */
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10),
    brass,
  );
  pole.position.set(0, radius + 0.2, 0);
  group.add(pole);
  const mount = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 12),
    brass,
  );
  mount.position.set(0, radius + 0.38, 0);
  group.add(mount);

  /* —— 状态光环（特效状态时绕全息球发光，赤道 + 纬线双环） —— */
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x79e2d0,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.05, 0.012, 8, 64),
    haloMaterial,
  );
  halo.rotation.x = Math.PI / 2; // 赤道光环
  group.add(halo);

  /* —— 台词气泡（DOM overlay + 3D 投影） —— */
  const bubble = document.createElement("div");
  bubble.className = "bot-bubble";
  bubble.hidden = true;
  dom.appendChild(bubble);
  let bubbleTimer = null;
  engine.onLine = (line) => {
    bubble.textContent = line;
    bubble.classList.remove("show");
    void bubble.offsetWidth; // 重新触发过渡
    bubble.classList.add("show");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), 3400);
  };

  /* —— 点击摸头（Raycaster 由 main 调用） —— */
  const panelWorldPos = new THREE.Vector3();
  const bubbleAnchor = new THREE.Vector3();

  const api = {
    group,
    engine,
    texture,
    halo,
    haloMaterial,

    update(now, elapsed) {
      const snapshot = engine.frame(now);
      face.draw(snapshot, now, 0.016);
      texture.needsUpdate = true;

      // 光环：特效状态时呼吸发光
      const ringActive = face.ringFx && now - face.ringFx.start < 9000;
      haloMaterial.opacity = ringActive ? 0.28 + 0.12 * Math.sin(now * 0.006) : 0;

      // 气泡投影
      panel.getWorldPosition(panelWorldPos);
      bubbleAnchor.copy(panelWorldPos);
      bubbleAnchor.y += radius * 1.5;
      bubbleAnchor.project(camera);
      if (bubbleAnchor.z < 1 && bubbleAnchor.z > -1) {
        bubble.style.left = `${((bubbleAnchor.x * 0.5 + 0.5) * window.innerWidth).toFixed(0)}px`;
        bubble.style.top = `${((-bubbleAnchor.y * 0.5 + 0.5) * window.innerHeight).toFixed(0)}px`;
        bubble.hidden = false;
      } else {
        bubble.hidden = true;
      }
    },

    hitTest(raycaster) {
      const hit = raycaster.intersectObject(panel, false);
      if (hit.length > 0) {
        engine.boop();
        return true;
      }
      return false;
    },

    togglePause() { return engine.togglePause(); },
    nextMood() { engine.nextMood(); },
    setColor(hex) { engine.setColor(hex); },

    dispose() {
      engine.dispose();
      texture.dispose();
      panelGeometry.dispose();
      panelMaterial.dispose();
      rimGeometry.dispose();
      meridianGeometry.dispose();
      brass.dispose();
      halo.geometry.dispose();
      haloMaterial.dispose();
      bubble.remove();
    },
  };

  scene.add(group);
  return api;
}

/* 子午线（绕 z 轴的圆，用于经纬笼架） */
function meridianPoints(radius) {
  const points = [];
  for (let i = 0; i <= 48; i += 1) {
    const a = (i / 48) * TAU;
    points.push(new THREE.Vector3(Math.sin(a) * radius, Math.cos(a) * radius, 0));
  }
  return points;
}

/* 简易 sweepTube：沿点列的管状几何（移植自主项目 mesh-kit 思路） */
function tubeFromPoints(points, radius, radialSegments = 10) {  const count = points.length;
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i < count; i += 1) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(count - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    let up = Math.abs(tangent.y) < 0.94 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
    up = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
    for (let j = 0; j < radialSegments; j += 1) {
      const a = (j / radialSegments) * TAU;
      const offset = new THREE.Vector3()
        .addScaledVector(up, Math.cos(a) * radius)
        .addScaledVector(binormal, Math.sin(a) * radius);
      const v = new THREE.Vector3().copy(p).add(offset);
      positions.push(v.x, v.y, v.z);
      normals.push(offset.x / radius, offset.y / radius, offset.z / radius);
    }
  }
  for (let i = 0; i < count - 1; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * radialSegments + j;
      const b = a + radialSegments;
      const c = (j + 1) % radialSegments;
      const a2 = a + (c - j);
      const b2 = b + (c - j);
      indices.push(a, b, a2, a2, b, b2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

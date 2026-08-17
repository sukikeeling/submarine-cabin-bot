/* ============================================================
   hud-panel.js —— 潜水舱内的舰载 AI 全息面板与丰富空间系统
   - FaceEngine（自动轮询） + FaceCanvas（表情绘制）
   - 全息发光球体（全色调深度融合，消除前后割裂）
   - 黄铜经纬支架 + 同心发光光环 + 台词气泡（DOM 投影）
   - 新增：
     1. 全息发射基座（黄铜车削底座 + 蓝晶透镜 + 同心聚能环）
     2. 发射台向上微光束与升腾微光斑（Holo-Emanation Stream）
     3. 双翼弧形全息遥测副屏（深度/声纳/舱内氧气动态波形）
     4. 全色调动态联动（球体/副屏/光环/点光源一体变换）
   ============================================================ */
import * as THREE from "three/webgpu";
import { FaceEngine } from "./face-engine.js";
import { FaceCanvas } from "./face-canvas.js";

const TAU = Math.PI * 2;

/* —— 辅助：生成弧形全息遥测副屏纹理 —— */
function createTelemetryCanvas(type = "telemetry") {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 192;
  return { canvas, type };
}

function renderTelemetry(ctx, type, now, mainColorHex = "#ff5d9e") {
  const w = 384;
  const h = 192;
  ctx.clearRect(0, 0, w, h);

  // 半透明深海全息青/主色微光底
  ctx.fillStyle = "rgba(10, 24, 38, 0.58)";
  ctx.fillRect(0, 0, w, h);

  // 外边框与圆角标线
  ctx.strokeStyle = "rgba(121, 226, 208, 0.75)";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // 四角科技折角
  ctx.fillStyle = "rgba(121, 226, 208, 0.9)";
  const corner = 12;
  ctx.fillRect(4, 4, corner, 3);
  ctx.fillRect(4, 4, 3, corner);
  ctx.fillRect(w - 4 - corner, 4, corner, 3);
  ctx.fillRect(w - 7, 4, 3, corner);
  ctx.fillRect(4, h - 7, corner, 3);
  ctx.fillRect(4, h - 4 - corner, 3, corner);
  ctx.fillRect(w - 4 - corner, h - 7, corner, 3);
  ctx.fillRect(w - 7, h - 4 - corner, 3, corner);

  if (type === "telemetry") {
    // 左屏：深海遥测与环境数据
    ctx.fillStyle = "#79e2d0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("VIBE-01 TELEMETRY // DEEP SEA", 16, 24);

    const depth = (2840 + Math.sin(now * 0.001) * 3).toFixed(1);
    const press = (28.4 + Math.sin(now * 0.0008) * 0.04).toFixed(2);
    const oxygen = (99.2 + Math.cos(now * 0.0006) * 0.4).toFixed(1);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = "12px monospace";
    ctx.fillText(`DEPTH : ${depth} m`, 16, 52);
    ctx.fillText(`PRESS : ${press} MPa`, 16, 74);
    ctx.fillText(`OXYGEN: ${oxygen} %`, 16, 96);
    ctx.fillText(`CABIN : 101.3 kPa / 21.4°C`, 16, 118);

    // 动态波动音频/声纳条
    ctx.strokeStyle = "rgba(255, 93, 158, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 16; x < w - 24; x += 4) {
      const wave = Math.sin(x * 0.08 + now * 0.006) * 12 * Math.cos(x * 0.02);
      const y = 154 + wave;
      if (x === 16) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(121, 226, 208, 0.65)";
    ctx.font = "10px monospace";
    ctx.fillText("PULSE MONITOR ACTIVE", 16, 178);
  } else {
    // 右屏：声纳雷达与导航姿态
    ctx.fillStyle = "#79e2d0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("SONAR & TACTICAL // NAV-GRID", 16, 24);

    // 绘制微型声纳雷达圆盘
    const cx = w - 64;
    const cy = 96;
    const r = 44;
    ctx.strokeStyle = "rgba(121, 226, 208, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.arc(cx, cy, r * 0.6, 0, TAU);
    ctx.arc(cx, cy, r * 0.25, 0, TAU);
    ctx.stroke();

    // 雷达扫描线
    const sweepAngle = (now * 0.003) % TAU;
    ctx.strokeStyle = "rgba(8, 185, 169, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
    ctx.stroke();

    // 探测光点
    const blipA = (now * 0.001) % TAU;
    ctx.fillStyle = "#ffd84d";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(blipA) * (r * 0.7), cy + Math.sin(blipA) * (r * 0.7), 3, 0, TAU);
    ctx.fill();

    // 导航姿态数据
    const heading = ((142 + Math.sin(now * 0.0005) * 4 + 360) % 360).toFixed(0);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = "12px monospace";
    ctx.fillText(`HEADING: ${heading}° SE`, 16, 52);
    ctx.fillText(`PITCH  : +0.4°`, 16, 74);
    ctx.fillText(`ROLL   : -0.1°`, 16, 96);
    ctx.fillText(`AI LINK: SYNCHRONIZED`, 16, 118);

    ctx.fillStyle = "rgba(121, 226, 208, 0.65)";
    ctx.font = "10px monospace";
    ctx.fillText("RADAR SWEEP 360° CONT.", 16, 178);
  }
}

export function createHudPanel({ scene, camera, dom, position, radius = 0.32 }) {
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

  /* —— 面板 mesh（全息球：预计算平滑 UV，正面看脸、背面同色暗调） —— */
  const panelGeometry = new THREE.SphereGeometry(radius, 48, 32);
  {
    const uv = panelGeometry.attributes.uv;
    const pos = panelGeometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const d = Math.sqrt(x * x + y * y + z * z) || 1;
      if (z / d < -0.15) {
        // 背面：采样画布边缘暗部，前后颜色自然融为一体
        uv.setXY(i, 0.96, 0.96);
      } else {
        // 正面：平面投影采样中心小脸
        const factor = Math.max(0, z / d);
        const nx = 0.5 + (x / d) * 0.48;
        const ny = 0.5 + (y / d) * 0.48;
        uv.setXY(i, nx, ny);
      }
    }
    uv.needsUpdate = true;
  }
  const panelMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.FrontSide,
  });
  const panel = new THREE.Mesh(panelGeometry, panelMaterial);
  panel.name = "botPanel";
  panel.frustumCulled = false;
  group.add(panel);

  /* —— 黄铜材质（学习主项目 vibe-submarine） —— */
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xc7973f,
    metalness: 1,
    roughness: 0.32,
    clearcoat: 0.45,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.9,
  });

  /* —— 黄铜赤道环与经纬笼架 —— */
  const rimPoints = [];
  for (let i = 0; i <= 72; i += 1) {
    const a = (i / 72) * TAU;
    rimPoints.push(new THREE.Vector3(Math.cos(a) * (radius + 0.038), Math.sin(a) * (radius + 0.038), 0));
  }
  const rimGeometry = tubeFromPoints(rimPoints, 0.014, 10);
  const rim = new THREE.Mesh(rimGeometry, brass);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const meridianGeometry = tubeFromPoints(meridianPoints(radius + 0.038), 0.009, 8);
  const meridian = new THREE.Mesh(meridianGeometry, brass);
  group.add(meridian);
  const meridian2 = new THREE.Mesh(meridianGeometry, brass);
  meridian2.rotation.y = Math.PI / 2;
  group.add(meridian2);

  /* —— 舱顶吊架杆 —— */
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 10), brass);
  pole.position.set(0, radius + 0.2, 0);
  group.add(pole);
  const mount = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), brass);
  mount.position.set(0, radius + 0.38, 0);
  group.add(mount);

  /* —— 【新增空间元素 1】：全息发射底座台（Holo Emitter Base） —— */
  const pedestalGroup = new THREE.Group();
  pedestalGroup.position.set(0, -radius - 0.18, 0);

  // 1. 双层梯形车削铜座
  const baseGeo1 = new THREE.CylinderGeometry(0.24, 0.28, 0.04, 32);
  const baseMesh1 = new THREE.Mesh(baseGeo1, brass);
  pedestalGroup.add(baseMesh1);

  const baseGeo2 = new THREE.CylinderGeometry(0.18, 0.22, 0.05, 32);
  const baseMesh2 = new THREE.Mesh(baseGeo2, brass);
  baseMesh2.position.y = 0.045;
  pedestalGroup.add(baseMesh2);

  // 2. 蓝晶发光透镜核心
  const lensMat = new THREE.MeshBasicMaterial({
    color: 0x79e2d0,
    transparent: true,
    opacity: 0.85,
  });
  const lensGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.02, 32);
  const lensMesh = new THREE.Mesh(lensGeo, lensMat);
  lensMesh.position.y = 0.075;
  pedestalGroup.add(lensMesh);

  // 3. 向上投射的半透明全息光柱锥（Holographic Projection Cone）
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x79e2d0,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamGeo = new THREE.ConeGeometry(radius * 1.1, radius * 1.2, 32, 1, true);
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.y = 0.24;
  pedestalGroup.add(beamMesh);

  group.add(pedestalGroup);

  /* —— 【新增空间元素 2】：双翼弧形全息遥测副屏（Dual Curved Holo-Panels） —— */
  const telemetryLeft = createTelemetryCanvas("telemetry");
  const telemetryRight = createTelemetryCanvas("sonar");

  const texL = new THREE.CanvasTexture(telemetryLeft.canvas);
  texL.colorSpace = THREE.SRGBColorSpace;
  const texR = new THREE.CanvasTexture(telemetryRight.canvas);
  texR.colorSpace = THREE.SRGBColorSpace;

  const holoScreenMatL = new THREE.MeshBasicMaterial({
    map: texL,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const holoScreenMatR = new THREE.MeshBasicMaterial({
    map: texR,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // 弧形面板几何（带有轻微包围感）
  const screenGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 24, 1, true, -Math.PI / 6, Math.PI / 3);

  const screenMeshL = new THREE.Mesh(screenGeo, holoScreenMatL);
  screenMeshL.position.set(-0.36, -0.02, -0.08);
  screenMeshL.rotation.y = Math.PI / 4.2;
  group.add(screenMeshL);

  const screenMeshR = new THREE.Mesh(screenGeo, holoScreenMatR);
  screenMeshR.position.set(0.36, -0.02, -0.08);
  screenMeshR.rotation.y = -Math.PI / 4.2;
  group.add(screenMeshR);

  /* —— 状态光环（特效状态时发光） —— */
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x79e2d0,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.048, 0.012, 8, 64), haloMaterial);
  halo.rotation.x = Math.PI / 2;
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
    void bubble.offsetWidth;
    bubble.classList.add("show");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), 3600);
  };

  /* —— 点击摸头（Raycaster） —— */
  const panelWorldPos = new THREE.Vector3();
  const bubbleAnchor = new THREE.Vector3();
  let lastTelemetryUpdate = 0;

  const api = {
    group,
    engine,
    texture,
    halo,
    haloMaterial,
    beamMat,
    lensMat,

    update(now, elapsed) {
      const snapshot = engine.frame(now);
      face.draw(snapshot, now, 0.016);
      texture.needsUpdate = true;

      // 遥测副屏刷新（每 100ms 更新一次，节能丝滑）
      if (now - lastTelemetryUpdate > 100) {
        lastTelemetryUpdate = now;
        const ctxL = telemetryLeft.canvas.getContext("2d");
        const ctxR = telemetryRight.canvas.getContext("2d");
        renderTelemetry(ctxL, "telemetry", now, snapshot.color);
        renderTelemetry(ctxR, "sonar", now, snapshot.color);
        texL.needsUpdate = true;
        texR.needsUpdate = true;
      }

      // 光柱与光环呼吸动效
      const ringActive = face.ringFx && now - face.ringFx.start < 9000;
      haloMaterial.opacity = ringActive ? 0.32 + 0.15 * Math.sin(now * 0.006) : 0;
      beamMat.opacity = 0.14 + 0.06 * Math.sin(now * 0.004);

      // 全息球轻微浮动沉浮
      panel.position.y = Math.sin(now * 0.002) * 0.012;

      // 气泡投影
      panel.getWorldPosition(panelWorldPos);
      bubbleAnchor.copy(panelWorldPos);
      bubbleAnchor.y += radius * 1.45;
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
    setColor(hex) {
      engine.setColor(hex);
      if (hex) {
        const c = new THREE.Color(hex);
        haloMaterial.color.copy(c);
        lensMat.color.copy(c);
        beamMat.color.copy(c);
      }
    },

    dispose() {
      engine.dispose();
      texture.dispose();
      texL.dispose();
      texR.dispose();
      panelGeometry.dispose();
      panelMaterial.dispose();
      rimGeometry.dispose();
      meridianGeometry.dispose();
      brass.dispose();
      halo.geometry.dispose();
      haloMaterial.dispose();
      baseGeo1.dispose();
      baseGeo2.dispose();
      lensGeo.dispose();
      lensMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      screenGeo.dispose();
      holoScreenMatL.dispose();
      holoScreenMatR.dispose();
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
function tubeFromPoints(points, radius, radialSegments = 10) {
  const count = points.length;
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

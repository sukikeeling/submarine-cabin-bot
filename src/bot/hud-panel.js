/* ============================================================
   hud-panel.js —— 潜水舱内的舰载 AI 全息面板与空间系统
   - FaceEngine（自动轮询） + FaceCanvas（表情绘制）
   - 全息主球体（无缝色调深度融合，支持动态换色联动）
   - 全息发射基座（黄铜座台 + 蓝晶发光透镜 + 向上投射聚能光锥）
   - 独立双翼全息遥测副屏（左：深海遥测脉冲波，右：360°战术声纳雷达）
     精准布局在主球左右两翼，带精致悬臂支架，完全消除穿模
   ============================================================ */
import * as THREE from "three/webgpu";
import { FaceEngine } from "./face-engine.js";
import { FaceCanvas } from "./face-canvas.js";

const TAU = Math.PI * 2;

/* —— 遥测副屏画布创建 —— */
function createTelemetryCanvas(type) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  return { canvas, type };
}

/* —— 遥测副屏内容绘制（高对比、高清晰度科幻全息界面） —— */
function renderTelemetry(ctx, type, now, mainColorHex = "#ff5d9e") {
  const w = 512;
  const h = 320;
  ctx.clearRect(0, 0, w, h);

  // 1. 半透明深海全息背景层
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, "rgba(6, 20, 36, 0.85)");
  bgGrad.addColorStop(1, "rgba(10, 30, 52, 0.90)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. 外层发光科技边框
  ctx.strokeStyle = "rgba(121, 226, 208, 0.95)";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // 3. 科技内角切角标
  ctx.fillStyle = "#79e2d0";
  const cLen = 22;
  const cThick = 5;
  // 左上
  ctx.fillRect(8, 8, cLen, cThick);
  ctx.fillRect(8, 8, cThick, cLen);
  // 右上
  ctx.fillRect(w - 8 - cLen, 8, cLen, cThick);
  ctx.fillRect(w - 8 - cThick, 8, cThick, cLen);
  // 左下
  ctx.fillRect(8, h - 8 - cThick, cLen, cThick);
  ctx.fillRect(8, h - 8 - cLen, cThick, cLen);
  // 右下
  ctx.fillRect(w - 8 - cLen, h - 8 - cThick, cLen, cThick);
  ctx.fillRect(w - 8 - cThick, h - 8 - cLen, cThick, cLen);

  if (type === "telemetry") {
    // ======== 左屏：深海遥测与环境感知 ========
    // 标题栏
    ctx.fillStyle = "rgba(121, 226, 208, 0.25)";
    ctx.fillRect(16, 16, w - 32, 36);
    ctx.fillStyle = "#79e2d0";
    ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("SYS // DEEP-SEA TELEMETRY", 26, 42);

    // 状态灯
    ctx.fillStyle = "#08c77a";
    ctx.beginPath();
    ctx.arc(w - 36, 34, 7, 0, TAU);
    ctx.fill();

    // 动态实时数据
    const depth = (2840 + Math.sin(now * 0.001) * 3.8).toFixed(1);
    const press = (28.42 + Math.sin(now * 0.0008) * 0.05).toFixed(2);
    const oxygen = (99.4 + Math.cos(now * 0.0005) * 0.3).toFixed(1);
    const temp = (3.2 + Math.sin(now * 0.0004) * 0.2).toFixed(1);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px Consolas, monospace";
    ctx.fillText(`DEPTH  :  ${depth} m`, 28, 88);
    ctx.fillText(`PRESS  :  ${press} MPa`, 28, 120);
    ctx.fillText(`OXYGEN :  ${oxygen} %`, 28, 152);
    ctx.fillText(`WATER  :  ${temp} °C`, 28, 184);

    // 动态波形 / 音频脉冲可视化
    ctx.fillStyle = "rgba(121, 226, 208, 0.15)";
    ctx.fillRect(24, 206, w - 48, 86);
    ctx.strokeStyle = "rgba(121, 226, 208, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 206, w - 48, 86);

    // 绘制音频脉冲柱与平滑正弦波
    const barCount = 28;
    const barWidth = 11;
    const startX = 36;
    for (let i = 0; i < barCount; i += 1) {
      const bh = Math.abs(Math.sin(now * 0.005 + i * 0.35)) * 48 + 6;
      ctx.fillStyle = i % 2 === 0 ? "#79e2d0" : "#ff5d9e";
      ctx.fillRect(startX + i * 15, 276 - bh, barWidth, bh);
    }

    ctx.strokeStyle = "#ffd84d";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 24; x < w - 24; x += 4) {
      const y = 248 + Math.sin(x * 0.06 + now * 0.008) * 16 * Math.cos(x * 0.015);
      if (x === 24) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(121, 226, 208, 0.85)";
    ctx.font = "12px Consolas, monospace";
    ctx.fillText("HULL INTEGRITY 100% · PULSE ACTIVE", 32, 302);
  } else {
    // ======== 右屏：战术声纳与导航姿态 ========
    // 标题栏
    ctx.fillStyle = "rgba(121, 226, 208, 0.25)";
    ctx.fillRect(16, 16, w - 32, 36);
    ctx.fillStyle = "#79e2d0";
    ctx.font = "bold 20px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("NAV // SONAR & TACTICAL GRID", 26, 42);

    // 状态灯
    ctx.fillStyle = "#ffd84d";
    ctx.beginPath();
    ctx.arc(w - 36, 34, 7, 0, TAU);
    ctx.fill();

    // 绘制 360° 声纳扫描雷达圆盘
    const cx = w - 120;
    const cy = 180;
    const r = 85;

    ctx.fillStyle = "rgba(8, 185, 169, 0.12)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(121, 226, 208, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.arc(cx, cy, r * 0.66, 0, TAU);
    ctx.arc(cx, cy, r * 0.33, 0, TAU);
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // 扫描光扇区
    const sweepAngle = (now * 0.0035) % TAU;
    const sweepGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    sweepGrad.addColorStop(0, "rgba(8, 185, 169, 0.8)");
    sweepGrad.addColorStop(1, "rgba(8, 185, 169, 0.1)");
    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sweepAngle - 0.45, sweepAngle);
    ctx.closePath();
    ctx.fill();

    // 雷达光束线
    ctx.strokeStyle = "#08c77a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
    ctx.stroke();

    // 目标微光点
    const blip1 = (now * 0.0008) % TAU;
    ctx.fillStyle = "#ff5d9e";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(blip1) * (r * 0.72), cy + Math.sin(blip1) * (r * 0.72), 5, 0, TAU);
    ctx.fill();

    const blip2 = (now * 0.0012 + 2) % TAU;
    ctx.fillStyle = "#ffd84d";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(blip2) * (r * 0.45), cy + Math.sin(blip2) * (r * 0.45), 4, 0, TAU);
    ctx.fill();

    // 左侧导航数据
    const heading = ((142 + Math.sin(now * 0.0006) * 4 + 360) % 360).toFixed(0);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px Consolas, monospace";
    ctx.fillText(`HEADING: ${heading}° SE`, 28, 88);
    ctx.fillText(`PITCH  : +0.4°`, 28, 120);
    ctx.fillText(`ROLL   : -0.1°`, 28, 152);
    ctx.fillText(`THRUST : 64 %`, 28, 184);
    ctx.fillText(`AI LINK: SYNC`, 28, 216);

    ctx.fillStyle = "rgba(121, 226, 208, 0.85)";
    ctx.font = "12px Consolas, monospace";
    ctx.fillText("SONAR SWEEP 360° RANGE: 500m", 28, 280);
    ctx.fillText("OBJECTS DETECTED: 2", 28, 302);
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

  /* —— 全息主球体（无缝自然全景映射） —— */
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
        uv.setXY(i, 0.96, 0.96);
      } else {
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

  /* —— 精致拉丝黄铜材质 —— */
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xc7973f,
    metalness: 1,
    roughness: 0.30,
    clearcoat: 0.5,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.0,
  });

  /* —— 黄铜经纬笼架与赤道环 —— */
  const rimPoints = [];
  for (let i = 0; i <= 72; i += 1) {
    const a = (i / 72) * TAU;
    rimPoints.push(new THREE.Vector3(Math.cos(a) * (radius + 0.035), Math.sin(a) * (radius + 0.035), 0));
  }
  const rimGeometry = tubeFromPoints(rimPoints, 0.013, 10);
  const rim = new THREE.Mesh(rimGeometry, brass);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const meridianGeometry = tubeFromPoints(meridianPoints(radius + 0.035), 0.009, 8);
  const meridian = new THREE.Mesh(meridianGeometry, brass);
  group.add(meridian);
  const meridian2 = new THREE.Mesh(meridianGeometry, brass);
  meridian2.rotation.y = Math.PI / 2;
  group.add(meridian2);

  /* —— 舱顶黄铜吊架杆 —— */
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 10), brass);
  pole.position.set(0, radius + 0.2, 0);
  group.add(pole);
  const mount = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), brass);
  mount.position.set(0, radius + 0.38, 0);
  group.add(mount);

  /* —— 【空间元素 1】：全息发射底座台（Holo Emitter Base） —— */
  const pedestalGroup = new THREE.Group();
  pedestalGroup.position.set(0, -radius - 0.14, 0);

  // 1. 双层梯形车削铜座
  const baseGeo1 = new THREE.CylinderGeometry(0.24, 0.28, 0.04, 32);
  const baseMesh1 = new THREE.Mesh(baseGeo1, brass);
  pedestalGroup.add(baseMesh1);

  const baseGeo2 = new THREE.CylinderGeometry(0.18, 0.22, 0.045, 32);
  const baseMesh2 = new THREE.Mesh(baseGeo2, brass);
  baseMesh2.position.y = 0.04;
  pedestalGroup.add(baseMesh2);

  // 2. 蓝晶发光透镜核心
  const lensMat = new THREE.MeshBasicMaterial({
    color: 0x79e2d0,
    transparent: true,
    opacity: 0.92,
  });
  const lensGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.02, 32);
  const lensMesh = new THREE.Mesh(lensGeo, lensMat);
  lensMesh.position.y = 0.07;
  pedestalGroup.add(lensMesh);

  // 3. 向上投射的全息发光微锥
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x79e2d0,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamGeo = new THREE.ConeGeometry(radius * 1.05, radius * 1.1, 32, 1, true);
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.position.y = 0.22;
  pedestalGroup.add(beamMesh);

  group.add(pedestalGroup);

  /* —— 【空间元素 2】：独立双翼全息遥测副屏（完全外置两翼，绝不穿模） —— */
  const telemetryLeft = createTelemetryCanvas("telemetry");
  const telemetryRight = createTelemetryCanvas("sonar");

  const texL = new THREE.CanvasTexture(telemetryLeft.canvas);
  texL.colorSpace = THREE.SRGBColorSpace;
  const texR = new THREE.CanvasTexture(telemetryRight.canvas);
  texR.colorSpace = THREE.SRGBColorSpace;

  const screenMatL = new THREE.MeshBasicMaterial({
    map: texL,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const screenMatR = new THREE.MeshBasicMaterial({
    map: texR,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const screenWidth = 0.32;
  const screenHeight = 0.20;
  const screenGeo = new THREE.PlaneGeometry(screenWidth, screenHeight);

  // 左屏组（屏 + 黄铜悬臂支架）
  const wingLeftGroup = new THREE.Group();
  wingLeftGroup.position.set(-0.48, 0.02, 0.08); // 彻底移出主球外（主球半径 0.32）
  wingLeftGroup.rotation.y = Math.PI / 8; // 朝向驾驶员微倾斜 22.5 度

  const screenMeshL = new THREE.Mesh(screenGeo, screenMatL);
  wingLeftGroup.add(screenMeshL);

  // 黄铜外框与悬臂杆
  const armGeoL = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 10);
  const armL = new THREE.Mesh(armGeoL, brass);
  armL.position.set(0.14, -0.12, -0.06);
  armL.rotation.z = -Math.PI / 4;
  wingLeftGroup.add(armL);

  group.add(wingLeftGroup);

  // 右屏组（屏 + 黄铜悬臂支架）
  const wingRightGroup = new THREE.Group();
  wingRightGroup.position.set(0.48, 0.02, 0.08); // 彻底移出主球外
  wingRightGroup.rotation.y = -Math.PI / 8; // 向内倾斜 22.5 度

  const screenMeshR = new THREE.Mesh(screenGeo, screenMatR);
  wingRightGroup.add(screenMeshR);

  const armGeoR = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 10);
  const armR = new THREE.Mesh(armGeoR, brass);
  armR.position.set(-0.14, -0.12, -0.06);
  armR.rotation.z = Math.PI / 4;
  wingRightGroup.add(armR);

  group.add(wingRightGroup);

  /* —— 状态光环 —— */
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x79e2d0,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.045, 0.012, 8, 64), haloMaterial);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  /* —— 台词气泡 —— */
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

      // 遥测副屏高频刷新（每 50ms 刷新一次动画与脉冲）
      if (now - lastTelemetryUpdate > 50) {
        lastTelemetryUpdate = now;
        const ctxL = telemetryLeft.canvas.getContext("2d");
        const ctxR = telemetryRight.canvas.getContext("2d");
        renderTelemetry(ctxL, "telemetry", now, snapshot.color);
        renderTelemetry(ctxR, "sonar", now, snapshot.color);
        texL.needsUpdate = true;
        texR.needsUpdate = true;
      }

      // 悬浮呼吸动效
      const floatOffset = Math.sin(now * 0.0022) * 0.012;
      panel.position.y = floatOffset;
      wingLeftGroup.position.y = 0.02 + floatOffset * 0.6;
      wingRightGroup.position.y = 0.02 + floatOffset * 0.6;

      const ringActive = face.ringFx && now - face.ringFx.start < 9000;
      haloMaterial.opacity = ringActive ? 0.36 + 0.18 * Math.sin(now * 0.006) : 0;
      beamMat.opacity = 0.18 + 0.08 * Math.sin(now * 0.004);

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
      screenMatL.dispose();
      screenMatR.dispose();
      armGeoL.dispose();
      armGeoR.dispose();
      bubble.remove();
    },
  };

  scene.add(group);
  return api;
}

/* 子午线 */
function meridianPoints(radius) {
  const points = [];
  for (let i = 0; i <= 48; i += 1) {
    const a = (i / 48) * TAU;
    points.push(new THREE.Vector3(Math.sin(a) * radius, Math.cos(a) * radius, 0));
  }
  return points;
}

/* 简易 sweepTube */
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

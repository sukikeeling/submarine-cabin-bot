/* ============================================================
   face-canvas.js —— 把 FaceEngine 状态渲染到 2D 画布
   用于潜水舱内的舰载 AI 全息屏（CanvasTexture 数据源）。
   绘制：粉色 blob 身体 + 白色眼睛环（Catmull-Rom 平滑）+ 屏内特效
   ============================================================ */
import { BLOB_PATH } from "./face-engine.js";

const VIEW = 230; // 原版 SVG 视口
const TAU = Math.PI * 2;

/* —— 原版 smoothRing：Catmull-Rom 平滑闭合路径 —— */
function smoothRingPath(ring, tension = 1) {
  if (ring.length < 3) {
    return new Path2D("M" + ring.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("L") + "Z");
  }
  const r = (v) => Math.round(v * 100) / 100;
  const n = ring.length;
  let d = `M${r(ring[0][0])},${r(ring[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const prev = ring[(i - 1 + n) % n];
    const cur = ring[i];
    const next = ring[(i + 1) % n];
    const after = ring[(i + 2) % n];
    const c1 = [cur[0] + ((next[0] - prev[0]) / 6) * tension, cur[1] + ((next[1] - prev[1]) / 6) * tension];
    const c2 = [next[0] - ((after[0] - cur[0]) / 6) * tension, next[1] - ((after[1] - cur[1]) / 6) * tension];
    d += `C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(next[0])},${r(next[1])}`;
  }
  return new Path2D(d + "Z");
}

/* 粒子符号表（状态 → 屏内漂浮元素） */
const PARTICLE_GLYPHS = {
  happy: ["♥", "#ff5d9e"], excited: ["✦", "#ffd84d"], sleeping: ["Z", "#a8b8ff"],
  humming: ["♪", "#79e2d0"], thinking: ["…", "#c9b8ff"], celebrate: ["✧", "#ff5d9e"],
  sad: ["◇", "#7fa8ff"], surprised: ["!", "#ffd84d"], scared: ["?!", "#ff9d5c"],
  angry: ["!!", "#ff3347"], laughing: ["哈哈", "#ff5d9e"],
};

export class FaceCanvas {
  constructor(canvas, { scale = 3 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.size = VIEW;
    this.scale = scale;
    canvas.width = VIEW * scale;
    canvas.height = VIEW * scale;
    this.particles = [];
    this.ringFx = null; // { type, start } 当前环形特效
    this._ringTime = 0;
  }

  /* 特效事件入口（FaceEngine.onFx） */
  handleFx(type, payload) {
    if (type === "ring") {
      this.ringFx = { type: payload, start: performance.now() };
    } else if (type === "particle") {
      this.spawnParticle(payload);
    }
  }

  spawnParticle(state, count = 1) {
    const glyph = PARTICLE_GLYPHS[state] || ["·", "#fff"];
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x: 115 + (Math.random() - 0.5) * 160,
        y: 150 + Math.random() * 60,
        vx: (Math.random() - 0.5) * 22,
        vy: -30 - Math.random() * 40,
        life: 1,
        decay: 0.6 + Math.random() * 0.9,
        glyph: glyph[0],
        color: glyph[1],
        size: 14 + Math.random() * 14,
        wobble: Math.random() * TAU,
      });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  /* 每帧绘制（now ms，engine 已 frame()） */
  draw(snapshot, now, dt) {
    const ctx = this.ctx;
    const s = this.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, VIEW, VIEW);
    // 浅瓷色底（一体化：球体整体浅瓷色，任何角度看都是瓷球而非黑球）
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW);
    gradient.addColorStop(0, "#e8e2d6");
    gradient.addColorStop(0.55, "#d9d3c6");
    gradient.addColorStop(1, "#c8c1b3");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW, VIEW);

    const { rings, eyeTransforms, body, state, color, line } = snapshot;

    /* —— 身体 blob —— */
    ctx.save();
    ctx.translate(0, body.y);
    ctx.rotate((body.rot * Math.PI) / 180);
    ctx.scale(body.sx, body.sy);
    const blob = new Path2D(BLOB_PATH);
    // 全息外发光：blob 边缘柔和光晕（浅色底上提高辨识度）
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill(blob);
    ctx.restore();
    // 深色描边：浅瓷底上保证 blob 轮廓清晰（对比度）
    ctx.strokeStyle = "rgba(120,72,88,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke(blob);
    ctx.fillStyle = color;
    ctx.fill(blob);
    // 腮红（萌感）：脸颊两侧半透明圆
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ff7d9e";
    ctx.beginPath();
    ctx.ellipse(60, 152, 13, 9, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(170, 152, 13, 9, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 顶部釉面高光（让屏内小脸也有立体感）
    ctx.beginPath();
    ctx.ellipse(88, 48, 30, 14, -0.5, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
    ctx.restore();

    /* —— 眼睛环 —— */
    for (let i = 0; i < rings.length; i += 1) {
      const ring = rings[i];
      const tr = eyeTransforms[i];
      if (!tr || tr.opacity <= 0) continue;
      const c = ring.reduce(
        (a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length],
        [0, 0],
      );
      ctx.save();
      ctx.translate(tr.tx, tr.ty);
      ctx.scale(tr.sx, tr.sy);
      ctx.translate(-c[0], -c[1]);
      ctx.fillStyle = "#fffdf7";
      ctx.strokeStyle = "rgba(120,72,88,0.35)";
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = tr.opacity;
      const eyePath = smoothRingPath(ring);
      ctx.fill(eyePath);
      ctx.stroke(eyePath);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* —— 屏内粒子 —— */
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      p.wobble += dt * 3;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.translate(p.x + Math.sin(p.wobble) * 6, p.y);
      ctx.fillStyle = p.color;
      ctx.font = `700 ${p.size}px "Segoe UI Symbol", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.glyph, 0, 0);
      ctx.restore();
    }

    /* —— 环形特效 —— */
    if (this.ringFx) {
      this._ringTime = (now - this.ringFx.start) / 1000;
      if (this._ringTime > 10) {
        this.ringFx = null; // 特效状态已切换，自动清除
      } else {
        this.drawRingFx(now);
      }
    }

    /* —— 状态角标 —— */
    ctx.fillStyle = "rgba(20,24,34,0.55)";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(state.toUpperCase(), 10, 8);
    if (line) {
      ctx.fillStyle = "rgba(20,24,34,0.45)";
      ctx.font = "500 11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(line.slice(0, 12), VIEW - 10, VIEW - 18);
    }
  }

  drawRingFx(now) {
    const ctx = this.ctx;
    const t = this._ringTime;
    ctx.save();
    ctx.translate(115, 112);
    switch (this.ringFx.type) {
      case "orbit": {
        ctx.rotate(t * 2);
        ctx.strokeStyle = "#79e2d0";
        ctx.lineWidth = 2.4;
        ctx.shadowColor = "#79e2d0";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, 0, 95, 38, 0, 0, TAU);
        ctx.stroke();
        ctx.rotate(-t * 4);
        ctx.strokeStyle = "#ff5d9e";
        ctx.shadowColor = "#ff5d9e";
        ctx.beginPath();
        ctx.arc(0, 0, 78, 0, TAU);
        ctx.stroke();
        break;
      }
      case "radar": {
        for (let i = 0; i < 3; i += 1) {
          const p = (t + i / 3) % 1;
          ctx.strokeStyle = `rgba(8,185,169,${0.9 * (1 - p)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 20 + p * 78, 0, TAU);
          ctx.stroke();
        }
        break;
      }
      case "loading": {
        ctx.rotate(t * 5);
        ctx.strokeStyle = "#ff5d9e";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#ff5d9e";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 74, 0, TAU * 0.72);
        ctx.stroke();
        break;
      }
      case "alerting": {
        const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI));
        ctx.strokeStyle = `rgba(255,51,71,${pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = "#ff3347";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 88, 0, TAU);
        ctx.stroke();
        break;
      }
      case "searching": {
        const sx = -72 + ((t * 1.6) % 2) * 144;
        const grad = ctx.createLinearGradient(0, -80, 0, 80);
        grad.addColorStop(0, "rgba(121,226,208,0)");
        grad.addColorStop(0.5, "rgba(121,226,208,0.9)");
        grad.addColorStop(1, "rgba(121,226,208,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx, -80);
        ctx.lineTo(sx, 80);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  resize(canvasW) {
    // 保持比例即可，无需处理
  }
}

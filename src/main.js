import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createPorcelainBrassSubmarineScene } from "./submarine-scene.js";
import "./styles.css";

const canvas = document.querySelector("#scene");
const loading = document.querySelector("#loading");
const errorPanel = document.querySelector("#error");
const pauseButton = document.querySelector("#pause");
const resetButton = document.querySelector("#reset");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const metricNodes = {
  fps: document.querySelector("#fps"),
  draws: document.querySelector("#draws"),
  triangles: document.querySelector("#triangles"),
};

const CAMERA_POSITION = new THREE.Vector3(3.8, 1.7, 4.6);
const CAMERA_TARGET = new THREE.Vector3(0, -0.05, 0);

async function start() {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  await renderer.init();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.76;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  camera.position.copy(CAMERA_POSITION);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(CAMERA_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 2.4;
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = 1.62;
  controls.enablePan = true;
  controls.update();

  const experience = createPorcelainBrassSubmarineScene({
    renderer,
    scene,
    camera,
    controls,
    dom: document.body,
  });

  /* —— 点击潜水仓面板 = 摸头（Raycaster） —— */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    experience.bot().hitTest(raycaster);
  });

  /* —— BOT 控制 —— */
  const botNextMood = document.querySelector("#bot-next-mood");
  const botPause = document.querySelector("#bot-pause");
  const botColor = document.querySelector("#bot-color");
  if (botNextMood) {
    botNextMood.addEventListener("click", () => experience.bot().nextMood());
  }
  if (botPause) {
    botPause.addEventListener("click", () => {
      const paused = experience.bot().togglePause();
      botPause.textContent = paused ? "bot 继续" : "bot 暂停";
    });
  }
  if (botColor) {
    const COLORS = ["#ff2d8b", "#08c77a", "#2f86ed", "#8656f6", "#ff9800", "#ff3347"];
    let colorIndex = 0;
    botColor.addEventListener("click", () => {
      colorIndex = (colorIndex + 1) % COLORS.length;
      experience.bot().setColor(COLORS[colorIndex]);
    });
  }
  const botViewButton = document.querySelector("#bot-view");
  if (botViewButton) {
    botViewButton.addEventListener("click", () => {
      // 相机在玻璃穹顶内看球（穹顶外会被玻璃透射干扰）
      const target = new THREE.Vector3(0, 0.6, 1.7);
      const from = new THREE.Vector3(0, 1.2, 2.6);
      const t0 = performance.now();
      const duration = 900;
      const fly = (now) => {
        const k = Math.min(1, (now - t0) / duration);
        const e = 1 - Math.pow(1 - k, 3);
        camera.position.lerpVectors(from, target, e);
        controls.target.set(0, 0.56, 0.72);
        controls.update();
        if (k < 1) requestAnimationFrame(fly);
      };
      fly(performance.now());
    });
  }
  const showcaseButton = document.querySelector("#bot-showcase");
  if (showcaseButton) {
    let showcaseTimer = null;
    showcaseButton.addEventListener("click", () => {
      if (showcaseTimer) {
        clearInterval(showcaseTimer);
        showcaseTimer = null;
        showcaseButton.textContent = "表情秀";
        return;
      }
      let exprIndex = experience.bot().engine.expression;
      showcaseTimer = setInterval(() => {
        exprIndex = (exprIndex + 1) % 25;
        experience.bot().engine.chooseExpression(exprIndex);
      }, 1200);
      showcaseButton.textContent = "停止";
    });
  }

  window.__experience = experience; // 调试/验证句柄
  let paused = false;
  let previous = performance.now();
  let elapsed = 0;
  let metricElapsed = 0;
  let metricFrames = 0;
  let frameInProgress = false;

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resetView = () => {
    camera.position.copy(CAMERA_POSITION);
    controls.target.copy(CAMERA_TARGET);
    controls.update();
  };

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      modeButtons.forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      experience.setDebugMode(button.dataset.mode);
    });
  });

  pauseButton.addEventListener("click", () => {
    paused = !paused;
    pauseButton.textContent = paused ? "继续动画" : "暂停动画";
    pauseButton.setAttribute("aria-pressed", String(paused));
  });
  resetButton.addEventListener("click", resetView);
  window.addEventListener("resize", resize);
  resize();

  async function frame(now) {
    if (frameInProgress) return;
    frameInProgress = true;
    try {
      const rawDelta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const delta = paused ? 0 : rawDelta;
      elapsed += delta;
      controls.update();
      experience.update({ delta, elapsed });
      renderer.render(scene, camera);

      metricElapsed += rawDelta;
      metricFrames += 1;
      if (metricElapsed >= 1) {
        metricNodes.fps.textContent = Math.round(metricFrames / metricElapsed);
        metricNodes.draws.textContent = renderer.info.render.calls;
        metricNodes.triangles.textContent = Math.round(
          renderer.info.render.triangles / 1000,
        ) + "K";
        metricElapsed = 0;
        metricFrames = 0;
      }
    } finally {
      frameInProgress = false;
    }
  }

  renderer.setAnimationLoop(frame);
  loading.classList.add("is-hidden");

  window.addEventListener("pagehide", () => {
    renderer.setAnimationLoop(null);
    controls.dispose();
    experience.dispose();
    renderer.dispose();
  }, { once: true });
}

start().catch((error) => {
  console.error(error);
  loading.classList.add("is-hidden");
  errorPanel.hidden = false;
  errorPanel.textContent = `场景启动失败：${error.message}`;
});

/* ============================================================
   face-engine.js —— moodie-pet 自动轮询引擎（纯逻辑移植）
   移植自 moodie-pet/pet.html（MIT，sukikeeling）：
   - 25 表情坐标 + 39 状态节奏（data/moodie-data.js 原样数据）
   - 自动轮询：状态切换（changeState）+ 表情池循环（cycleExpr）
     + 眨眼（scheduleBlink）+ 自言自语（scheduleChatter）
   - 弹簧身体 / 反应动画 / 循环动画 / 3D 转向 / 视线跟随
   不依赖 DOM：渲染交给调用方（Canvas 2D / Three.js）。
   ============================================================ */
import DATA from "./moodie-data.js";

const TAU = Math.PI * 2;

export const STATE_NAMES = {
  sleeping: "睡眠", waking: "唤醒", idle: "待机", listening: "倾听",
  thinking: "思考", searching: "搜索", working: "工作", excited: "兴奋",
  surprised: "惊讶", suspicious: "怀疑", angry: "生气", drowsy: "困倦",
  happy: "开心", curious: "好奇", confused: "困惑", bored: "无聊",
  proud: "得意", shy: "害羞", sad: "难过", laughing: "大笑",
  scared: "害怕", playful: "调皮", celebrate: "庆祝", orbit: "轨道",
  radar: "雷达", progress: "进度", spawning: "诞生", humming: "哼唱",
  loading: "加载", dictating: "听写", writing: "书写", sending: "发送",
  receiving: "接收", uploading: "上传", notifying: "通知", alerting: "警报",
  dragging: "拖拽", bouncing: "弹跳", "powering-down": "关机",
};

const STATE_LINES = {
  sleeping: ["困了…深潜小憩一下", "呼噜呼噜…潜艇轻轻晃", "别叫我了…水压正好入睡"],
  waking: ["嗯？浮出水面了？", "刚醒，气泡还在冒", "谁在敲我的玻璃罩"],
  idle: ["深潜发呆中…", "戳我有惊喜（隔着玻璃罩）", "海面以下 200 米，无事发生", "今天潜到哪一层呢"],
  listening: ["我在听，声呐全开", "你说我记，潜望镜已升起", "嗯嗯，继续（咕噜咕噜）"],
  thinking: ["让我想想…下一条航线", "嗯…在算浮力配平", "这个有点意思，先记在防水板上"],
  searching: ["翻海底地形图中…", "声呐扫一圈", "找到一点线索了", "正在翻珊瑚丛"],
  working: ["埋头干活中…螺旋桨都转快了", "在忙，别催，压载水还没排", "快好了快好了", "专注模式 ON（水下版）"],
  excited: ["好耶！跃出水面！", "冲冲冲！螺旋桨拉满！", "太棒了吧(≧▽≦)", "嘿咻！水花四溅！"],
  surprised: ["咦？！海底有宝藏？！", "哇哦，发光的鱼群！", "没想到！这水层还有这种操作"],
  suspicious: ["emmm…这海流不对劲", "有点蹊跷，潜深一点看看", "我才不信呢(¬_¬ )"],
  angry: ["哼！别往我的舷窗喷墨！", "气鼓鼓，泡泡都变大了", "别惹我，我带了鱼雷（假的）"],
  drowsy: ["哈欠～水压有点大", "眼皮打架了…", "头晕晕(⊙﹏⊙) 有点氮醉", "撑不住了…先上浮一点"],
  happy: ["嘿嘿，今天海况不错", "心情美美哒(◡‿◡) 珊瑚都在笑", "刚和鱼群打了个招呼"],
  curious: ["这是什么？发光的水母？", "让我瞅瞅，沉船残骸？", "有意思～这鱼长得像鼠标"],
  confused: ["啊这…导航仪进水了？", "等等，啥情况，鱼雷呢", "脑子转不过来(⊙﹏⊙) 海流太乱"],
  bored: ["好无聊啊，海面太平了", "没事做…数泡泡玩", "海底的时间好慢"],
  proud: ["哼哼，又穿过一条海沟", "不错吧？我的航线规划", "稳了，这波潜航完美"],
  shy: ["哎呀…别盯着我的舷窗看啦", "害羞了，尾灯都红了"],
  sad: ["呜…海底好冷", "心情低落，像沉船", "有点丧(´；ω；`)"],
  laughing: ["哈哈哈，笑得直冒泡", "停不下来～螺旋桨都抖了", "嘿嘿嘿(≧▽≦)"],
  scared: ["吓！大鲸鱼！", "别吓我呀，鲨鱼！", "瑟瑟发抖，压载水都忘了排"],
  playful: ["来玩呀，追泡泡", "皮一下，绕鲸鱼转圈", "捉迷藏？珊瑚后面"],
  celebrate: ["耶！顺利返航！", "庆祝一下，喷个水柱！", "圆满完工，浮出水面！", "快看，水母烟花！"],
  orbit: ["绕潜艇巡视一圈", "轨道运行中，声呐全开", "绕一绕，检查舷窗"],
  radar: ["声呐扫描…滴滴滴", "波纹扩散中，前方有鱼群", "探测中，海底地形加载"],
  progress: ["下潜进度 +1", "一点点下潜，稳扎稳打", "深度记录刷新中"],
  spawning: ["下水！我来啦！", "潜艇 AI 上线", "咕噜咕噜，入水成功"],
  humming: ["哼哼～航行小曲儿", "啦啦啦，螺旋桨节拍", "小曲儿走起，鱼群伴舞"],
  loading: ["加载中…下潜缓冲", "转圈圈，排水阀调整中", "缓冲一下，海流有点急"],
  dictating: ["你说我记，航行日志中", "听写中…记入航海日志", "嗯，记下了，用防水笔"],
  writing: ["写航行日志中…", "写点东西，记在舱壁上", "这段航程这么写…", "日志 ing"],
  sending: ["发出去了！无线电波走你", "发送中…摩斯电码", "消息走你，穿过水层"],
  receiving: ["收到新信号！", "来活了，岸上指挥部", "有新东西，海面传来的"],
  uploading: ["上传中…数据打包成气泡", "传上去啦，浮标中转", "推送到云端，穿过海面"],
  notifying: ["叮！该上浮换气了", "有个通知，螺旋桨检修", "注意查收，声呐信号"],
  alerting: ["警报！水压异常！", "注意注意，前方有暗礁", "红色预警，紧急上浮！"],
  dragging: ["哎哎别拽我，玻璃罩要掉了", "我在移动，压载水在排", "别拉我啦，螺旋桨会缠住"],
  bouncing: ["蹦蹦蹦，浪花里蹦迪", "弹一下，跃出水面", "嗨起来，和海豚一起"],
  "powering-down": ["收工啦，潜艇泊港", "关机咯，收起潜望镜", "下次见，深蓝之约"],
};

export const GROKBOT_COLORS = [
  ["cocoa", "可可棕", "#9a6737"], ["red", "活力红", "#ff3347"],
  ["orange", "暖橙", "#ff6a00"], ["amber", "琥珀", "#ff9800"],
  ["green", "青绿", "#08c77a"], ["teal", "湖蓝", "#08b9a9"],
  ["blue", "经典蓝", "#2f86ed"], ["purple", "梦幻紫", "#8656f6"],
  ["pink", "桃粉", "#ff2d8b"], ["black", "纯黑", "#000000"],
];

/* —— blob 身体路径（原版 GROKBOT_SHAPES[0]）—— */
export const BLOB_PATH =
  "M228.541 114.228C228.541 130.133 225.184 145.994 218.738 160.534C212.674 174.217 203.904 186.669 193.065 196.988C155.933 232.34 99.497 238.596 55.5255 212.24C45.097 205.99 35.6851 198.072 27.7451 188.866C19.1926 178.953 12.3686 167.569 7.65781 155.351C2.60712 142.264 0 128.257 0 114.228C0 98.3219 3.35751 82.4611 9.80315 67.9215C15.8672 54.2382 24.6377 41.7862 35.4767 31.4668C72.6081 -3.88483 129.044 -10.1413 173.016 16.2153C183.444 22.4653 192.856 30.3829 200.796 39.5896C209.349 49.5018 216.173 60.8859 220.883 73.1037C225.934 86.1906 228.541 100.198 228.541 114.228Z";

const ALL_STATES = Object.values(DATA.GROUPS).flat();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Spring {
  constructor(value, stiffness = 210, damping = 22, mass = 0.8) {
    this.x = value;
    this.v = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
    this.target = value;
  }
  step(target, dt) {
    const a =
      (-this.stiffness * (this.x - target) - this.damping * this.v) / this.mass;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

const PERF_PALETTE = [
  { y: -2, scaleY: 0.92 },
  { y: -5, rotate: 2, scaleX: 1.08, scaleY: 1.12 },
  { y: 3, scaleX: 0.97, scaleY: 1.03 },
  { rotate: 4, scaleX: 1.04 },
  { rotate: -5, y: 1 },
  { scaleX: 1.03, scaleY: 0.97, y: -1 },
  { y: 4, rotate: -3, scaleX: 0.98, scaleY: 1.02 },
  { rotate: 6, scaleY: 0.94, y: -3 },
  { y: -6, scaleX: 0.94, scaleY: 1.12 },
  { scaleX: 1.06, scaleY: 1.06, rotate: -2 },
];

const REACTION_FRAMES = {
  bounce: { y: [0, -11, 3.5, -1, 0], rotate: [0, -2.5, 2, -0.7, 0], scale: [1, 0.96, 1.025, 0.99, 1] },
  squash: { scaleX: [1, 1.045, 0.978, 1.012, 1], scaleY: [1, 0.95, 1.028, 0.992, 1], y: [0, 5, -3, 1, 0] },
  tilt: { rotate: [0, -8, 6, -2, 0], y: [0, 3, -2, 0.5, 0] },
  spin: { rotate: [0, 14, -12, 7, 0], scale: [1, 0.93, 1.045, 0.985, 1] },
};
const REACTION_TIMES = [0, 0.22, 0.58, 0.82, 1];
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const STATE_REACTION = {
  excited: "bounce", happy: "bounce", laughing: "bounce", playful: "bounce",
  celebrate: "bounce", bouncing: "bounce",
  sad: "squash", angry: "squash", suspicious: "squash", drowsy: "squash",
  listening: "tilt", thinking: "tilt", curious: "tilt", confused: "tilt",
  shy: "tilt", dragging: "tilt", bored: "tilt", proud: "tilt",
  orbit: "spin", radar: "spin", progress: "spin",
};
const EXPR_ACTIONS = ["tilt", "bounce", "squash", "spin", "none"];
const STATE_LOOP = {
  sleeping: { y: [3, 1.2] }, waking: { y: [2, 2.4], rot: [1, 2.2] }, idle: { y: [1, 1.8] },
  listening: { eyeX: [4, 2.2], rot: [1.5, 1.6] }, thinking: { rot: [3, 1.4], y: [1.5, 2.0] },
  searching: { eyeX: [10, 1.6], rot: [2, 1.8] }, working: { y: [2, 4.5], rot: [1, 4] },
  excited: { y: [6, 3.2], sx: [0.03, 3.2], sy: [0.03, 3.2] },
  surprised: { sx: [0.04, 4], sy: [0.04, 4] },
  suspicious: { rot: [4, 1.2], eyeX: [3, 1.2] },
  angry: { y: [2, 3], rot: [3, 3] }, drowsy: { y: [3, 1.1], rot: [2, 0.9] },
  happy: { y: [4, 2.8], rot: [2, 2.8] }, curious: { eyeX: [6, 1.5], rot: [2, 1.5] },
  confused: { rot: [5, 1.3], eyeX: [4, 2.6] }, bored: { y: [2, 1.0], rot: [1, 0.8] },
  proud: { y: [2, 2.2], rot: [-2, 2.2] }, shy: { y: [2, 2.5], rot: [3, 2.5], sx: [0.02, 2.5] },
  sad: { y: [2, 1.3], rot: [1, 1.3] }, laughing: { y: [7, 4.2], sx: [0.04, 4.2] },
  scared: { y: [3, 5], sx: [0.03, 5] }, playful: { rot: [5, 2.2], y: [3, 2.2] },
  celebrate: { y: [8, 3.6], rot: [4, 3.6], spin: true }, orbit: { spin: true, y: [2, 2] },
  radar: { eyeX: [12, 1.2], eyeY: [8, 1.2] }, progress: { eyeX: [10, 1.8] },
  spawning: { sx: [0.06, 3], sy: [0.06, 3] }, humming: { y: [2, 2.6] },
  loading: { eyeY: [6, 1.5], y: [3, 1.5] }, dictating: { rot: [2, 2.8], y: [1.5, 2.8] },
  writing: { y: [1.5, 3.2], rot: [1, 3.2] }, sending: { eyeX: [8, 1.8], y: [2, 1.8] },
  receiving: { eyeX: [-8, 1.8], y: [2, 1.8] }, uploading: { y: [3, 2.4], eyeY: [4, 2.4] },
  notifying: { y: [4, 3.4], rot: [2, 3.4] }, alerting: { y: [3, 4.5], sx: [0.03, 4.5] },
  dragging: { eyeX: [6, 1.4], y: [2, 1.4] }, bouncing: { y: [10, 3.0] },
  "powering-down": { y: [2, 0.8], rot: [2, 0.7] },
};

/* 特效映射：环形特效状态 + 粒子状态（原版 FX_RING / FX_PARTICLE） */
export const FX_RING_STATES = new Set(["orbit", "radar", "loading", "alerting", "searching"]);
export const FX_PARTICLE_RATES = {
  happy: 360, excited: 220, sleeping: 600, humming: 520, thinking: 700,
  celebrate: 90, sad: 500, surprised: 380, scared: 420, angry: 340, laughing: 300,
};

const EFFECT_STATES = [
  "orbit", "radar", "loading", "alerting", "searching", "celebrate", "happy",
  "excited", "sleeping", "humming", "thinking", "sad", "surprised", "scared",
  "angry", "laughing",
];

export class FaceEngine {
  constructor({ onLine = null, onState = null, onColor = null, onFx = null } = {}) {
    this.onLine = onLine;
    this.onState = onState;
    this.onColor = onColor;
    this.onFx = onFx; // (type, payload) type: 'particle' | 'ring'
    this.data = DATA;
    this.reset();
    this.start();
  }

  reset() {
    this.expression = 0;
    this.current = DATA.EXPRESSIONS[0].map((r) => r.map((p) => [...p]));
    this.target = DATA.EXPRESSIONS[0];
    this.morph = 1;
    this.velocity = 0;
    this.activeState = "idle";
    this.last = performance.now();
    this.blinkStart = 0;
    this.gazeX = 0;
    this.gazeY = 0;
    this.turn = 0;
    this.eyePulse = 0;
    this.reaction = null;
    this.line = "";
    this.color = GROKBOT_COLORS[8][2];
    this.paused = false;
    this.bodySprings = {
      y: new Spring(0, 170, 15),
      rotate: new Spring(0, 170, 15),
      scaleX: new Spring(1, 170, 15),
      scaleY: new Spring(1, 170, 15),
    };
    this.bodyTilt = new Spring(0, 120, 18);
    this.yawSpring = new Spring(0, 150, 16);
    this.pitchSpring = new Spring(0, 150, 16);
    this._fxTimers = [];
    this._timers = [];
    this._lastLine = "";
    this._fxAcc = {};
  }

  /* ---------- 台词 ---------- */
  randLine(state) {
    const a = STATE_LINES[state] || [STATE_NAMES[state] || state];
    let l = pick(a);
    for (let i = 0; i < 3 && l === this._lastLine && a.length > 1; i += 1) l = pick(a);
    this._lastLine = l;
    return l;
  }
  showLine(state) {
    this.line = this.randLine(state);
    if (this.onLine) this.onLine(this.line, state);
  }

  /* ---------- 表情插值 ---------- */
  rings() {
    return this.current.map((ring, e) =>
      ring.map((p, i) => [
        p[0] + (this.target[e][i][0] - p[0]) * clamp(this.morph, 0, 1),
        p[1] + (this.target[e][i][1] - p[1]) * clamp(this.morph, 0, 1),
      ]),
    );
  }

  chooseExpression(index) {
    this.current = this.rings();
    this.target = this.data.EXPRESSIONS[index];
    this.expression = index;
    this.morph = 0;
    this.velocity = 0;
    const perf = PERF_PALETTE[index % PERF_PALETTE.length];
    const s = this.bodySprings;
    s.y.target = perf.y ?? 0;
    s.rotate.target = perf.rotate ?? 0;
    s.scaleX.target = perf.scaleX ?? 1;
    s.scaleY.target = perf.scaleY ?? 1;
    s.y.v = (perf.y ?? 0) * 0.22;
    s.rotate.v = (perf.rotate ?? 0) * 0.18;
    s.scaleX.v = ((perf.scaleX ?? 1) - 1) * 0.25;
    s.scaleY.v = ((perf.scaleY ?? 1) - 1) * 0.25;
    const actType = STATE_REACTION[this.activeState] || EXPR_ACTIONS[index % EXPR_ACTIONS.length];
    if (actType !== "none") this.reaction = { type: actType, t: 0, dur: 620 };
    this.eyePulse = 1;
    this.blink();
  }

  blink() { this.blinkStart = performance.now(); }

  blinkScale(now) {
    if (!this.blinkStart) return 1;
    const t = (now - this.blinkStart) / 320;
    if (t >= 1) { this.blinkStart = 0; return 1; }
    return Math.max(t < 0.42 ? 1 - t / 0.42 : (t - 0.42) / 0.58, 0.04);
  }

  /* ---------- 每帧推进（移植自原版 frame()） ---------- */
  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.velocity += (-10 * this.velocity - 36 * (this.morph - 1)) * dt;
    this.morph += this.velocity * dt;
    if (!Number.isFinite(this.morph)) { this.morph = 1; this.velocity = 0; }

    const shown = this.rings();
    const bs = this.blinkScale(now);
    const rad = (this.turn * Math.PI) / 180;
    this.eyePulse = Math.max(0, this.eyePulse - dt * 3.2);
    const pulseScale = 1 + Math.sin(this.eyePulse * Math.PI) * 0.14;
    const loop = STATE_LOOP[this.activeState] || null;
    let loopEyeX = 0;
    let loopEyeY = 0;
    if (loop) {
      const t = now / 1000;
      if (loop.eyeX) loopEyeX = Math.sin(t * loop.eyeX[1]) * loop.eyeX[0];
      if (loop.eyeY) loopEyeY = Math.sin(t * loop.eyeY[1]) * loop.eyeY[0];
    }
    // 每条环的 3D 转向投影 + 视线 + 眨眼（原版逐环 transform）
    const eyeTransforms = shown.map((ring) => {
      const c = ring.reduce(
        (a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length],
        [0, 0],
      );
      const base = Math.asin(clamp((c[0] - 114.2705) / 105, -1, 1));
      const longitude = base + rad;
      const depth = Math.cos(longitude);
      const perspective = Math.max(depth, 0.02) / Math.max(Math.cos(base), 0.02);
      const x = 114.2705 + 105 * Math.sin(longitude) + this.gazeX + loopEyeX;
      const y = c[1] + this.gazeY + loopEyeY;
      return {
        tx: x, ty: y,
        sx: clamp(perspective, 0.02, 2.4) * pulseScale,
        sy: bs,
        opacity: depth > 0.02 ? 1 : 0,
      };
    });

    const s = this.bodySprings;
    const bodyY = s.y.step(s.y.target, dt);
    const bodyRot = s.rotate.step(s.rotate.target, dt);
    const bodySX = s.scaleX.step(s.scaleX.target, dt);
    const bodySY = s.scaleY.step(s.scaleY.target, dt);
    const t = now / 1000;
    const breathY = Math.sin(t * 2.1) * 1.4;
    const breathRot = Math.sin(t * 1.7) * 0.6;
    const breathScale = 1 + Math.sin(t * 2.6) * 0.008;
    const tiltVal = this.bodyTilt.step(this.bodyTilt.target ?? 0, dt);

    let rY = 0, rRot = 0, rScale = 1, rSX = 1, rSY = 1;
    if (this.reaction) {
      this.reaction.t += dt * 1000;
      const p = clamp(this.reaction.t / this.reaction.dur, 0, 1);
      const frames = REACTION_FRAMES[this.reaction.type];
      const evalF = (arr) => {
        for (let i = 1; i < REACTION_TIMES.length; i += 1) {
          if (p <= REACTION_TIMES[i]) {
            const local = (p - REACTION_TIMES[i - 1]) / (REACTION_TIMES[i] - REACTION_TIMES[i - 1]);
            return arr[i - 1] + (arr[i] - arr[i - 1]) * easeOutCubic(local);
          }
        }
        return arr[arr.length - 1];
      };
      if (frames) {
        if (frames.y) rY = evalF(frames.y);
        if (frames.rotate) rRot = evalF(frames.rotate);
        if (frames.scale) rScale = evalF(frames.scale);
        if (frames.scaleX) rSX = evalF(frames.scaleX);
        if (frames.scaleY) rSY = evalF(frames.scaleY);
      }
      if (p >= 1) this.reaction = null;
    }

    let loopY = 0, loopRot = 0, loopSX = 1, loopSY = 1;
    if (loop) {
      const tt = now / 1000;
      if (loop.y) loopY = Math.sin(tt * loop.y[1]) * loop.y[0];
      if (loop.rot) loopRot = Math.sin(tt * loop.rot[1]) * loop.rot[0];
      if (loop.sx) loopSX = 1 + Math.sin(tt * loop.sx[1]) * loop.sx[0];
      if (loop.sy) loopSY = 1 + Math.sin(tt * loop.sy[1]) * loop.sy[0];
      if (loop.spin) loopRot = (now * 0.05) % 360;
    }

    const finalY = bodyY + rY + breathY + loopY;
    const finalRot = bodyRot + rRot + breathRot + tiltVal + loopRot;
    const finalSX = bodySX * rSX * rScale * breathScale * loopSX;
    const finalSY = bodySY * rSY * rScale * (2 - breathScale) * loopSY;

    const yaw = this.yawSpring.step(this.yawSpring.target, dt);
    const pitch = this.pitchSpring.step(this.pitchSpring.target, dt);

    return {
      rings: shown,
      eyeTransforms,
      body: { y: finalY, rot: finalRot, sx: finalSX, sy: finalSY },
      yaw,
      pitch,
      state: this.activeState,
      line: this.line,
      color: this.color,
      now,
    };
  }

  /* ---------- 视线跟随 ---------- */
  setGaze(nx, ny) { // -1..1
    this.gazeX = clamp(nx, -1, 1) * 22;
    this.gazeY = clamp(ny, -1, 1) * 14;
    this.bodyTilt.target = clamp(nx * 4, -4, 4);
  }
  clearGaze() { this.gazeX = 0; this.gazeY = 0; this.bodyTilt.target = 0; }

  /* ---------- 3D 转向（拖动/点击） ---------- */
  setTurn(yaw, pitch) {
    this.yawSpring.target = clamp(yaw, -44, 44);
    this.pitchSpring.target = clamp(pitch, -26, 26);
  }
  releaseTurn() { this.yawSpring.target = 0; this.pitchSpring.target = 0; }

  /* ---------- 摸头/点击 ---------- */
  boop() {
    this.reaction = { type: "squash", t: 0, dur: 620 };
    this.eyePulse = 1;
    this.blink();
    const lines = ["嘿嘿~被隔着玻璃摸头啦", "舒服～(◡‿◡) 水波都温柔了", "再来一下嘛，泡泡都变心了", "哎呀别戳啦，玻璃罩会花", "咕噜咕噜~潜水真开心"];
    this.line = pick(lines);
    if (this.onLine) this.onLine(this.line, this.activeState);
    if (this.onFx) {
      for (let i = 0; i < 3; i += 1) {
        setTimeout(() => this.onFx("particle", "happy"), i * 180);
      }
    }
  }

  /* ---------- 状态 ---------- */
  pickState() {
    const r = Math.random();
    if (r < 0.3) return pick(EFFECT_STATES);
    if (r < 0.7) return pick(this.data.GROUPS["Cycle produit"]);
    return pick(ALL_STATES);
  }
  setState(name) {
    this.activeState = name;
    const pool = this.data.POOLS[name];
    if (pool && pool.length) {
      this.chooseExpression(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      this.chooseExpression(Math.floor(Math.random() * this.data.EXPRESSIONS.length));
    }
    this.showLine(name);
    if (this.onState) this.onState(name);
    // 特效：环形状态 + 粒子状态
    this._fxAcc = {};
    if (FX_RING_STATES.has(name) && this.onFx) this.onFx("ring", name);
    const rate = FX_PARTICLE_RATES[name];
    if (rate && this.onFx && !this._fxRunning) {
      this._fxRunning = setInterval(() => {
        if (!this.paused) this.onFx("particle", name);
      }, rate);
    } else if (!rate && this._fxRunning) {
      clearInterval(this._fxRunning);
      this._fxRunning = null;
    }
  }
  changeState() {
    this._clearTimer("state");
    if (this.paused) { this._setTimer("state", () => this.changeState(), 3000); return; }
    try {
      let s;
      do { s = this.pickState(); } while (s === this.activeState && ALL_STATES.length > 1);
      this.setState(s);
      // 自动换色：低频（8%）且只在暖萌色系里选，保持萌感（不出现黑/绿等冷色）
      if (Math.random() < 0.08) {
        const warm = ["#ff2d8b", "#ff6a00", "#ff9800", "#ff3347", "#ff5d9e"];
        const c = pick(warm);
        this.color = c;
        if (this.onColor) this.onColor(c);
      }
    } catch (e) { /* 单次异常不卡死轮询 */ }
    this._setTimer("state", () => this.changeState(), rand(7000, 13000));
  }
  cycleExpr() {
    this._clearTimer("expr");
    if (this.paused) { this._setTimer("expr", () => this.cycleExpr(), 2000); return; }
    const pool = this.data.POOLS[this.activeState] || [];
    if (!pool.length) { this._setTimer("expr", () => this.cycleExpr(), 3000); return; }
    let idx = pick(pool);
    if (idx === this.expression && pool.length > 1) idx = pick(pool);
    this.chooseExpression(idx);
    const cad = this.data.EXPR_CADENCE[this.activeState] || [3000, 5000];
    this._setTimer("expr", () => this.cycleExpr(), rand(cad[0], cad[1]));
  }
  scheduleBlink() {
    this._clearTimer("blink");
    this._setTimer("blink", () => {
      if (!this.paused && this.data.BLINK[this.activeState]) this.blink();
      this.scheduleBlink();
    }, rand(2200, 5200));
  }
  scheduleChatter() {
    this._clearTimer("chatter");
    this._setTimer("chatter", () => {
      if (!this.paused && !this.dragging) this.showLine(this.activeState);
      this.scheduleChatter();
    }, rand(11000, 22000));
  }

  /* ---------- 定时器管理 ---------- */
  _timers = {};
  _setTimer(key, fn, ms) { this._timers[key] = setTimeout(fn, ms); }
  _clearTimer(key) { if (this._timers[key]) { clearTimeout(this._timers[key]); delete this._timers[key]; } }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }
  setColor(hex) {
    this.color = hex;
    if (this.onColor) this.onColor(hex);
  }
  nextMood() {
    const s = pick(ALL_STATES.filter((x) => x !== this.activeState)) || pick(ALL_STATES);
    this.setState(s);
  }
  start() {
    this.cycleExpr();
    this.changeState();
    this.scheduleBlink();
    this.scheduleChatter();
  }
  dispose() {
    for (const key of Object.keys(this._timers)) this._clearTimer(key);
    if (this._fxRunning) clearInterval(this._fxRunning);
  }
}

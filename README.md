# 🚤 头脑风暴1：Bot 植入潜水仓（Pet-1 · Submarine Cabin Bot）

> **结论：可行，已实现并验证。** moodie-pet 的自动轮询小脸 bot 成功植入
> vibe-submarine 潜水艇的玻璃穹顶驾驶舱内，表情/状态/台词全自动轮询运行。

**🌐 在线体验：https://sukikeeling.github.io/submarine-cabin-bot/**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 做了什么

在 vibe-submarine（主项目，Three.js WebGPU 全程序化瓷器黄铜潜水艇）的驾驶舱
玻璃穹顶内，挂了一颗 **舰载 AI 全息球**：

- **bot 本体**：moodie-pet 的圆嘟嘟小脸（粉色 blob + 白色眼睛环 + 腮红），25 表情坐标
  数据原样使用，表情插值/弹簧身体/眨眼全部移植；
- **全息球呈现**：小脸包在深色球面上（平面投影 UV，正面永远朝观察者），告别
  平面贴片感；黄铜赤道环 + 正交经线笼架 + 舱顶支架，学主项目的装配思路；
- **自动轮询完整保留**：
  - 状态随机切换（39 状态，7–13 秒一轮，30% 特效状态 / 40% 工作流）；
  - 表情池循环（按 `EXPR_CADENCE` 节奏切换当前状态的候选表情）；
  - 自动眨眼（按 `BLINK` 间隔）；偶尔自言自语气泡（11–22 秒）；
- **屏内特效**：轨道双激光环 / 雷达波纹 / 加载霓虹弧 / 警报脉冲 / 扫描光束 +
  爱心/星星/Z 字/音符等粒子随状态上浮；
- **立体感细节**（沿用主项目思路）：
  - 面板 = 圆形 CanvasTexture 屏，黄铜边框（sweepTube 环管）+ 12 颗黄铜铆钉
    （InstancedMesh，学主项目 30 铆钉做法）+ 舱顶黄铜支架；
  - 面板上方一盏暖色 PointLight，让玻璃穹顶内有真实光源；
  - 台词气泡是 DOM overlay，用 3D 坐标投影跟随面板；
- **交互**：点击舱内面板 = 摸头（果冻挤压 + 撒娇台词 + 爱心粒子）；右侧
  `BOT` 控制组可换心情 / 暂停 / 换颜色。

## 技术要点

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 自动轮询引擎 | `src/bot/face-engine.js` | 纯逻辑移植（不碰 DOM），输出每帧表情环/弹簧/视线状态 |
| Canvas 渲染 | `src/bot/face-canvas.js` | blob + Catmull-Rom 平滑眼睛环 + 屏内粒子/环形特效 |
| 3D 面板 | `src/bot/hud-panel.js` | CanvasTexture + 铜框/铆钉/支架 + 气泡投影 + 摸头 |
| 场景挂载 | `src/submarine-scene.js` | 面板定位 (0, 0.56, 0.72)（穹顶内），update 驱动 |
| 交互 | `src/main.js` | Raycaster 摸头 + BOT 控制按钮 |

## 运行

```bash
npm install
npm run dev        # http://127.0.0.1:5181
npm run build      # 产物在 dist/
```

## 验证记录

- `vite build` 通过；dev server + Edge（WebGPU）实测：无报错，~201K tris；
- GLM 视觉模型确认截图中「圆形面板 + 粉色小脸 + 白色椭圆眼睛 + 黄铜边框 +
  玻璃穹顶」全部可见；
- 轮询采样：表情 `8 → 17`、状态 `orbit → laughing`、台词「绕一绕」→
  「嘿嘿嘿(≧▽≦)」——自动轮询确实在跑。

## 来源

- 主项目 [zhulin025/vibe-submarine](https://github.com/zhulin025/vibe-submarine)（MIT）
- 辅项目 [sukikeeling/moodie-pet](https://github.com/sukikeeling/moodie-pet)（MIT，
  数据引擎源自 zhulin025/LaoA-GrokBot，作者同一人，融合天然合理）

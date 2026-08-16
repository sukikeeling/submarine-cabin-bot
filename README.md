# 🚤 头脑风暴1：Bot 植入潜水仓（Pet-1 · Submarine Cabin Bot）

> **结论：可行，已实现并上线。** moodie-pet 的自动轮询小脸 bot 成功植入
> vibe-submarine 潜水艇的玻璃穹顶驾驶舱内，表情/状态/台词全自动轮询运行。

**🌐 在线体验：https://sukikeeling.github.io/submarine-cabin-bot/**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 做了什么

在 vibe-submarine（主项目，Three.js WebGPU 全程序化瓷器黄铜潜水艇）的驾驶舱
玻璃穹顶内，挂了一颗 **舰载 AI 全息球**：

- **bot 本体**：moodie-pet 的圆嘟嘟小脸（粉色 blob + 白色眼睛环 + 腮红 + 描边），
  25 表情坐标数据原样使用，表情插值/弹簧身体/眨眼全部移植；
- **全息球呈现**：球体整体**浅瓷一体化**（米白渐变，任何角度看都是瓷球）——
  正面小脸平面投影采样（预计算 UV），背面强制采样米白顶部（杜绝镜像黑球）；
  黄铜赤道环 + 正交经线笼架 + 舱顶支架，学主项目的装配思路；
- **海洋气泡**：140 颗半透明气泡环绕潜水艇上升（InstancedMesh 单次绘制，
  摆动 + 缩放脉动），移植自主项目深海增强版粒子系统；
- **潜艇场景台词**：39 个状态 + 摸头，全套海底/舰载 AI 口吻——
  「声呐全开」「压载水还没排」「前方有暗礁」「水母烟花」「下次见，深蓝之约」；
- **自动轮询完整保留**：
  - 状态随机切换（39 状态，7–13 秒一轮，30% 特效状态 / 40% 工作流）；
  - 表情池循环（按 `EXPR_CADENCE` 节奏切换当前状态的候选表情）；
  - 自动眨眼（按 `BLINK` 间隔）；偶尔自言自语气泡（11–22 秒）；
- **屏内特效**：轨道双激光环 / 雷达波纹 / 加载霓虹弧 / 警报脉冲 / 扫描光束 +
  爱心/星星/Z 字/音符等粒子随状态上浮；
- **交互**：点击舱内全息球 = 摸头（果冻挤压 + 撒娇台词 + 爱心粒子）；
  `BOT` 控制组可换心情 / 暂停 / 换颜色 / 表情秀 / 看 bot（相机飞近舱内）。

## 技术要点

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 自动轮询引擎 | `src/bot/face-engine.js` | 纯逻辑移植（不碰 DOM）+ 潜艇台词表 |
| Canvas 渲染 | `src/bot/face-canvas.js` | 浅瓷渐变底 + blob/眼睛描边 + 屏内粒子/环形特效 |
| 3D 全息球 | `src/bot/hud-panel.js` | CanvasTexture 球 + 预计算 UV（背面米白）+ 铜环/经线/支架 |
| 海洋气泡 | `src/bot/underwater-bubbles.js` | InstancedMesh 上升气泡（移植 D:\vibe-submarine） |
| 场景挂载 | `src/submarine-scene.js` | 球定位穹顶内 (0, 0.56, 0.72)，update 驱动 |
| 交互 | `src/main.js` | Raycaster 摸头 + BOT 控制按钮 + 相机飞行 |

## 运行

```bash
npm install
npm run dev        # http://127.0.0.1:5181
npm run build      # 产物在 dist/
```

> 或双击桌面 `启动任务1-潜水仓bot.bat`（自动起服务 + 开浏览器）。

## 来源

- 主项目 [zhulin025/vibe-submarine](https://github.com/zhulin025/vibe-submarine)（MIT）
- 辅项目 [sukikeeling/moodie-pet](https://github.com/sukikeeling/moodie-pet)（MIT，
  数据引擎源自 zhulin025/LaoA-GrokBot，作者同一人，融合天然合理）
- 气泡粒子移植自深海增强版分支（feat/deep-sea-enhancement）

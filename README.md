# Mory-Automation (魔力自动化) - 轻量级现代自动化工作流引擎 | MORY HUB

> **官方出品：来自 MORY HUB ([www.moryhub.com](https://www.moryhub.com))**  
> **下一代轻量级、跨平台、高精度现代自动化工作流引擎（Studio & Agent）**  
> **双模驱动：桌面免安装便携独立版 (Windows Portable EXE) + 现代化浏览器扩展插件 (Chrome & Edge Extension)**

[![MORY HUB](https://img.shields.io/badge/Official-MORY_HUB-3b82f6?style=flat-square&logo=googlechrome&logoColor=white)](https://www.moryhub.com)
[![Version](https://img.shields.io/badge/version-v1.0.0-emerald?style=flat-square)](https://www.moryhub.com)
[![GitHub Repo](https://img.shields.io/badge/GitHub-SuperMory%2Fmory--automation-181717?style=flat-square&logo=github)](https://github.com/SuperMory/mory-automation)
[![Gitee Repo](https://img.shields.io/badge/Gitee-mzh5544%2Fmory--automation-c71d23?style=flat-square&logo=gitee)](https://gitee.com/mzh5544/mory-automation)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Chrome%20%7C%20Edge-blueviolet?style=flat-square)](https://www.moryhub.com)

---

## 📖 项目简介 (Introduction)

**Mory-Automation (魔力自动化)** 是由 **MORY HUB ([www.moryhub.com](https://www.moryhub.com))** 倾力打造的**轻量级现代自动化工作流引擎**。

它融合了**桌面系统级驱动自动化**与**浏览器原生 DOM 网页自动化**双模能力，致力于为个人创作者、业务分析师与研发工程师提供直观、清爽、高效的无人值守工作流编排方案。

通过可视化交互式画布，Mory-Automation 彻底革新了传统脚本编写与繁复代码门槛：
- **工业级正交折线排线（Orthogonal Routing）**，连线规整清晰，告别蜘蛛网式的杂乱流程；
- **Windows GDI 4K 零压缩高精找图**，解决传统截图模糊、DPI 缩放失真与识别漂移痛点；
- **原生离线 WinRT OCR 文字识别**，毫秒级本地计算，数据绝对隐私安全；
- **驱动级拟人化鼠标键盘模拟**，支持随机抖动、水波纹反馈、物理滚轮与修饰快捷键；
- **受控流程「开始」入口**与**多分支流转（成功/失败双引脚）**，保证任务拓扑的健壮可控。

---

## 🌟 核心特性与架构

### 1. 🚀 双模融合运行架构
- **桌面便携独立客户端 (Portable EXE)**：
  - 纯单文件免安装绿色架构，开箱即用，无需配置 Python、Node.js 等外部运行环境。
  - 直接调用 Windows 原生 GDI 驱动级抓屏与 Win32 底层输入，能够穿透各种桌面客户端软件（ERP、办公工具、微信、行业客户端、无句柄应用等）进行高灵敏全桌面接管。
- **浏览器扩展插件版 (Chrome & Edge Extension)**：
  - 严格遵循 Google Chrome Extension Manifest V3 现代规范。
  - 轻量注入目标标签页，原生派发标准 DOM 事件，提供逼真的虚拟指针移动平滑动画、点击水波纹反馈与页面级找图匹配。

### 2. 🎨 工业级流式画布与排线系统
- **流程入口「开始」节点（Start Node）**：
  - 作为流程执行的标准入口，严格规范 DAG 拓扑方向，隐藏输入端口，杜绝回环死循环。
  - 支持设置流程启动前置缓冲延时（毫秒）与业务说明。
- **三模排线自由切换**：
  - **☵ 折线排线 (Orthogonal Routing)**：采用带平滑倒角半径（Fillet Radius）的正交直角折线算法，自动排版规整，呈现工业电路级排线质感。
  - **〰 平滑曲线 (Smooth Bezier)**：经典流畅的贝塞尔过渡曲线。
  - **╱ 极简直线 (Straight Line)**：最短路径直通连接。
- **高自由度交互**：
  - 支持 `Ctrl + 滚轮` 平滑缩放视口（40% ~ 200%）、无限空间拖拽平移、一键拓扑自动排版。
  - **步骤 ID 与快速重命名**：每个节点具备醒目的短 ID（如 `#start`、`#ocr_1`），点击一键复制，双击卡片标题或铅笔图标即可直接原地重命名，使「跳转指定步骤」目标一清二楚。

### 3. 🔍 GDI 4K 零压缩无损图像匹配（找图）
- **真正的无损底层直截**：拒绝有损编码压缩，直接读取屏幕物理 FrameBuffer 像素，找图命中精度提升至 99.9%。
- **高分屏与多 DPI 完美自适应**：精准计算系统缩放倍率（100%、125%、150%、200%），彻底解决找图与点击坐标偏移难题。
- **分支双输出端口**：找图卡片自带 **成功 (绿色)** 与 **失败 (橙色)** 两条物理连线端点，直观构建重试、等待或分支逻辑。

### 4. 🔤 Windows 本地离线高精文字识别 (OCR)
- **零网络、免 API Key、隐私不出本地**：底层基于 Windows 10/11 内置原生 WinRT OCR 离线服务，毫秒级实时计算。
- **文字查找与自动提取**：支持模糊关键词比对、拉框限制识别区域、识别成功自动提取文本并同步至系统剪贴板。

### 5. 🖱️ 驱动级拟人化键鼠模拟
- **平滑轨迹与拟人抖动**：支持设定 X/Y 像素范围内的拟人化微随机抖动，真实模拟手部操作，极大降低平台风控反爬概率。
- **复合按键与修饰支持**：支持 `Ctrl+C`、`Ctrl+V`、`Ctrl+A`、`Ctrl+Z`、`Ctrl+S`、`Enter`、`Tab`、`Esc` 等常用组合键，支持同时附带 `Shift`、`Alt`、`Win` 等修饰键。

---

## 🧩 动作组件库一览

| 动作类型 | 节点标识 | 类别 | 核心功能与亮点 |
| :--- | :---: | :--- | :--- |
| **开始节点** | `flow_start` | 流程控制 | 流程唯一受控入点，前置启动延时，保障执行秩序 |
| **移动鼠标** | `mouse_move` | 鼠标动作 | 十字准星拾取目标坐标、拟人化随机像素抖动、轨迹延时 |
| **鼠标点击** | `mouse_click` | 鼠标动作 | 左/右/中键，单击/双击/按压/松开，支持复合修饰键组合 |
| **滚动滚轮** | `mouse_scroll` | 鼠标动作 | 垂直（向下/向上）与水平（向左/向右）滚动控制，自定义滚动步长 |
| **图像识别** | `find_image` | 图像匹配 | 屏幕拉框截取模板/本地图导入、相似度阈值、成功/失败双分支输出 |
| **文字识别** | `ocr_text` | 本地OCR | 本地离线 OCR 识别、文字匹配搜索、提取并复制到系统剪贴板 |
| **等待时间** | `wait_time` | 流程控制 | 固定延时等待（支持毫秒或秒） |
| **随机等待** | `random_wait` | 流程控制 | Min ~ Max 毫秒区间随机休眠，有效应对防刷机制 |
| **快捷按键** | `hotkey` | 键盘动作 | 常用编辑按键组合、文本全选、复制粘贴与自定义触发 |
| **跳转步骤** | `flow_jump` | 流程控制 | 跳转到指定节点 ID，轻松实现循环流转与特定跳段 |

---

## 🚀 快速上手与运行

### 方式 1：独立桌面客户端 (Windows Portable EXE) —— 推荐 ⭐

1. 打开项目的 `dist/` 目录：
   ```
   dist/Mory-Automation 1.0.0.exe
   ```
2. **直接双击运行**，无需安装 Python、Node.js 或任何运行库。
3. 在顶部执行目标下拉菜单中选择待操作的外部软件窗口（或全屏幕桌面），即可开始低代码编排并一键执行！
4. 如需在源码环境下重新打包，执行：
   ```bash
   npm run build:exe
   ```

### 方式 2：加载到 Chrome / Edge 浏览器扩展

1. 打开 Chromium 内核浏览器（Google Chrome 或 Microsoft Edge）：
   - Chrome 地址栏输入：`chrome://extensions/`
   - Edge 地址栏输入：`edge://extensions/`
2. 开启右上角的 **【开发者模式】(Developer mode)**。
3. 点击 **【加载已解压的扩展程序】(Load unpacked)**。
4. 选择本项目源码目录（例如 `E:\moryPj\mory-automation`）。
5. 点击浏览器右上角扩展栏中的 **Mory-Automation** 图标，点击 **【⚡ 打开流程设计器 (工作台)】** 即可开始编排！

---

## 📂 项目工程结构

```
mory-automation/
├── LICENSE                    # MIT 开源许可证
├── README.md                  # 官方中英文详细说明文档
├── package.json               # 引擎配置、构建脚本与依赖声明
├── manifest.json              # 浏览器扩展 Manifest V3 清单配置
├── background.js              # 扩展后台 Service Worker 通信中心
├── icons/                     # 全尺寸高精应用与浏览器图标
├── popup/                     # 浏览器扩展快捷弹窗与状态面板
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── electron/                  # 桌面独立客户端核心实现 (Electron & Win32)
│   ├── main.cjs               # Electron 主控进程
│   ├── preload.cjs            # 进程隔离安全 IPC 桥接层
│   ├── native-robot.cjs       # Windows GDI BitBlt 无损截图、OCR 与系统 API
│   ├── win-ocr.ps1            # Windows 原生 WinRT OCR 离线识别脚本
│   └── bin/                   # 原生驱动级输入模块
├── content/                   # 网页端内容脚本 (DOM 自动化层)
│   ├── content.js             # 页面执行器 (虚拟指针动画、水波纹反馈)
│   ├── content.css            # 准星、十字定位器与选区遮罩样式
│   └── picker.js              # 坐标交互式十字拾取与矩形拉框截屏
└── designer/                  # 流程设计器核心引擎 (Studio Core)
    ├── designer.html          # 工作台主界面结构
    ├── designer.css           # 现代化深色工作台 UI 视觉系统
    ├── designer.js            # 设计器应用主控制器与持久化
    ├── canvas.js              # 可视化画布引擎 (折线排线/贝塞尔/平移缩放)
    ├── executor.js            # 自动化流程拓扑执行与分支调度引擎
    ├── image_matcher.js       # 4K 高精度模板匹配算法核心
    ├── actions/               # 动作注册中心 (低代码模块化拓展)
    │   ├── action-registry.js # 动作注册表
    │   ├── action-start.js    # 开始节点
    │   ├── action-mouse-move.js
    │   ├── action-mouse-click.js
    │   ├── action-mouse-scroll.js
    │   ├── action-find-image.js
    │   ├── action-ocr.js
    │   ├── action-wait.js
    │   └── ...
    ├── modals/                # 参数配置模态框组件
    │   ├── modal-base.js      # 可拖拽模态框基类
    │   ├── modal-start.js     # 开始节点配置
    │   └── ...
    └── templates/             # 预设标准模板库 (demo-flow.json)
```

---

## 📄 开源许可证 (MIT License)

本项目采用 [MIT License](LICENSE) 协议完全开源，并由 **MORY HUB ([www.moryhub.com](https://www.moryhub.com))** 官方出品与维护。

```text
MIT License

Copyright (c) 2026 MORY HUB (www.moryhub.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- **免费商用**：个人、开发者、企业均可完全免费用于日常学习、企业内部自动化、业务提效与商业项目。
- **保留署名**：在衍生开发、重新打包或二次分发时，请保留原版权声明与出处信息。

---

## 🔗 开源仓库与源码地址 (Open Source Repositories)

- **GitHub 官方仓库**：[https://github.com/SuperMory/mory-automation](https://github.com/SuperMory/mory-automation)
- **Gitee (码云) 国内镜像**：[https://gitee.com/mzh5544/mory-automation](https://gitee.com/mzh5544/mory-automation)
- **最新 Release 下载**：前往 GitHub Releases 或 Gitee 发布页下载免安装便携绿色版 (`Mory-Automation 1.0.0.exe`)。
- **欢迎 Star & Fork 支持我们！**

---

## 👨‍💻 作者与出品机构

- **作者**：Mory ([hello@moryhub.com](mailto:hello@moryhub.com))
- **出品机构**：MORY HUB ([www.moryhub.com](https://www.moryhub.com))
- **官方网站**：[www.moryhub.com](https://www.moryhub.com)
- **技术交流与反馈**：欢迎访问 [MORY HUB](https://www.moryhub.com) 或在 GitHub / Gitee 提交 Issue 与反馈。

---

*Mory-Automation (魔力自动化) —— 赋能数字化业务，让每一次自动化流转充满魔力。*

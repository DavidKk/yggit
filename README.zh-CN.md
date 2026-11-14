# Yggit (世界树 Git)

<p align="center">
  <strong>有机生命树 Git 图谱与版本管理工作台</strong>
</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a> | <a href="./README.md">English</a>
</p>

---

## 项目概述

**Yggit**（世界树 Git）将传统的生硬工业地铁线路图升级为**有机生命树 / 灵脉网络**。基于 Next.js、React 19 和 Tailwind CSS 构建，Yggit 提供高性能、高颜值、Local-first 的 Git 提交图谱可视化与本地仓库管理体验。

## 核心特性

- 🌳 **世界树有机生命图谱** — 三次贝塞尔曲线分支汇合、双色渐变汇流、主干与侧枝线条粗细分化。
- ⏱️ **GitKraken 风格缝隙日期分割线** — 零高度行缝隙日期分割线，精准贴合行顶部边界，不占用 DAG 纵向高度与行背景。
- 🌿 **语义化节点呈现** — 正圆虚线 Stash 胶囊、HEAD 呼吸光环、交汇点双环年轮结。
- 📋 **全列右键快捷复制能力** — 分支列、图谱列、提交说明列全支持右键菜单（复制分支名、提交说明、完整/短 Hash、作者、提交时间等）。
- 🧭 **多仓库与工作空间切换** — 便捷管理与切换本地/远程仓库，支持工作区与分支状态即时检测。
- ⚡ **高性能 React Memo 优化** — SVG 矢量层解耦独立缓存，在数据加载与交互悬浮时避免无效重绘与闪烁。
- 🌐 **完整多语言支持** — 界面全量国际化（中英双语）。

## 快速上手

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/DavidKk/yggit.git
cd yggit

# 安装依赖
pnpm install

# 启动本地开发服务
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 即可开始查看与管理本地 Git 仓库。

### 构建与部署

```bash
# 构建生产产物
pnpm build

# 运行生产服务
pnpm start
```

## 开源协议

MIT © [DavidJones](https://github.com/DavidKk)

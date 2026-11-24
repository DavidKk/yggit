# Yggit Living Tree — 世界树分层资产包 (world-tree-assets)

本目录包含 **Yggit Living Tree** P0 阶段非破坏式拆分的全部标准交付物，以及支持 P1–P4 阶段验证的对齐图层与元数据。

## 目录结构

- `README.md`：本说明文件
- `audit.md`：源图像素级审计报告（含 4 份输入源图对比、遮挡说明与烘焙光效边界）
- `rebuild_report.md`：重组验证报告（MAE = 0.0432 / 255, PSNR = 66.07 dB）
- `tree_meta.json`：核心图层清单、包围盒、连接锚点、绘制深度与风场物理权重配置
- `nodes.json`：16 个真实 Git 发光节点的母版坐标、半径、默认色彩与分支语义角色
- `original/`：原始母版裁切图 `default_world_tree_original.png` 及对齐的 02–06 主题参考原图
- `background/scene_clean.png`：移除世界树与左上角 UI 标签后的纯净深林背景层
- `extracted/tree_full_rgba.png`：完整世界树 32-bit RGBA 透明主体图层
- `base/base_trunk.png`：静止固定骨架（主干、粗枝、根系及底层防空洞树皮延展）
- `branches/branch_flex_01..04.png`：4 根可轻微受约束弯曲的次级细枝图层
- `canopy/cluster_01..12.png`：12 个按自然分枝拆分的不规则 Alpha 叶簇图层
- `masks/cluster_01..12_deform.png`：12 张 8-bit 灰度局部网格形变权重蒙版（锚点处为 0，叶尖处平滑递增）
- `masks/glow_mask.png` & `masks/glow_emission.png`：树干/根系能量线发光强度灰度遮罩与色彩参考层
- `masks/node_mask.png`：Git 发光节点像素遮罩
- `masks/inpainted_mask.png`：左上角 UI 标签移除与树冠下层遮挡补绘区域的显式记录遮罩
- `reference/baked_lighting.png`：原图已烘焙光效参考层
- `previews/`：重组预览 `preview_rebuild.png`、差异热图 `difference.png`、透明棋盘格预览 `transparent_checkerboard.png` 及 3 张 2× 局部微距放大图
- `seasons/`：从同一六宫格母版对齐提取的春樱、夏绿、秋枫、冬雪及夜樱祭灯笼透明外观层

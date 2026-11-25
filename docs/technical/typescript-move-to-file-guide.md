# TypeScript Move to File 自动化拆分与迁移指南

> 适用场景：当单文件超过 `max-lines`（800 行）限制需要拆分，或需要将顶层函数、类型、常量、Hook、子组件迁移到独立模块时，使用 TypeScript Language Service 的 **`Move to file` / `Move to a new file`** 重构能力，可在秒级自动完成代码搬运、跨文件 `import/export` 补全与全项目引用更新，大幅减少手工编辑带来的 Token 消耗与出错概率。

---

## 1. 可行性结论

已在当前仓库（TypeScript `5.9.3`）实测验证 **完全可行**：

- **能力 1：`Move to a new file`（`refactor.move.newFile`）**  
  将顶层声明（`function`、`const`、`class`、`type`、`interface`、`enum` 等）一键迁移到新文件，自动生成目标文件并处理所有依赖导入与导出。
- **能力 2：`Move to file`（`refactor.move.file`）**  
  将顶层声明迁移到已存在的目标文件（通过 `interactiveRefactorArguments.targetFile` 指定路径），自动合并导入并更新原文件与全项目所有引用处。

---

## 2. 适用与不适用边界

### 适合直接使用 `Move to file` 的场景

1. **顶层工具函数 / 类型 / 常量拆分**：例如将 `isGitSelection`、`repoName`、`Props` 类型或纯函数抽离到独立 `.ts` 文件。
2. **顶层独立组件 / Hook 迁移**：文件内定义的独立子组件（`function FooModal(...)`）或独立自定义 Hook（`export function useXxx(...)`）。
3. **跨模块目录整理**：把组件或工具函数从一个文件搬运到另一个模块目录，自动更新全仓库所有引用路径。

### 不适合直接依赖单次 `Move to file` 的场景

1. **大型组件内部匿名逻辑块（强依赖外层闭包 state/props）**：  
   例如 `GitLogPage` 内部直接读取 15 个 `useState` 变量的 JSX 片段或内联 `useCallback`。这类代码需要先在原文件抽成独立的顶层函数/组件（明确入参 props），或使用 `Extract to function in module scope`，然后再用 `Move to file` 迁移到目标文件。
2. **跨文件循环依赖**：若待迁移函数与原文件其余顶层符号存在双向引用，需先解耦公共类型/常量。

> **最佳实践组合拳（最省 Token）**：  
> `先将局部逻辑提取为顶层声明（或 props 显式传参）` → `调用 TypeScript Move to file / Move to a new file 自动迁移与更新全仓引用` → `pnpm lint`（自动排序 imports 并校验 `--max-warnings=0`）。

---

## 3. 命令行 / 脚本自动化操作方法（Node + TypeScript LanguageService）

在 IDE 外（如终端 / Agent 自动化重构）无需启动 VS Code，可直接通过项目自带的 `typescript` API 执行：

### 3.1 检查目标符号是否支持迁移（Dry Run）

```bash
node -e "
const ts = require('typescript');
const file = 'components/git/log-page/gitLogUtils.ts'; // 源文件路径
const symbolName = 'isGitSelection';                    // 顶层声明名称

const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());

const svc = ts.createLanguageService({
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => '1',
  getScriptSnapshot: (f) => ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)) : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
});

const src = ts.sys.readFile(file);
const pos = src.indexOf(symbolName);
const refactors = svc.getApplicableRefactors(
  file,
  { pos, end: pos + symbolName.length },
  { allowTextChangesInNewFiles: true },
  'interactive',
  undefined,
  true
);
console.log(JSON.stringify(refactors.filter(r => r.name.includes('Move')), null, 2));
"
```

### 3.2 执行迁移并应用 TextChanges

- **迁移到新文件**（自动生成 `<symbolName>.ts`）：
  调用 `svc.getEditsForRefactor(file, {}, { pos, end }, 'Move to a new file', 'Move to a new file', { allowTextChangesInNewFiles: true })`。
- **迁移到指定已存在文件**：
  先确保目标文件已创建（如空文件或已有基础结构）并包含在 `getScriptFileNames()` 中，再调用：
  ```js
  const edits = svc.getEditsForRefactor(
    file,
    {},
    { pos, end },
    'Move to file',
    'Move to file',
    { allowTextChangesInNewFiles: true },
    { targetFile: 'components/git/log-page/targetFile.ts' }
  )
  ```
- 将 `edits.edits` 中的每个 `fileTextChanges` 按 `textChanges` 倒序应用到对应文件（新文件直接写入），最后运行一次格式化与校验即可：

```bash
pnpm fix:imports && pnpm format && pnpm lint:check
```

---

## 4. IDE 交互式操作方法（VS Code / Cursor / Antigravity IDE）

1. 将光标放在需要拆出的**顶层声明名称**上（如 `function HelperName`、`export const X`、`type Props`）。
2. 按快捷键 **`Cmd + .`**（macOS）或 **`Ctrl + .`**（Windows/Linux）打开 Code Action 菜单。
3. 选择：
   - **`Move to a new file`**：自动创建同名新文件并迁移；
   - **`Move to file...`**：在弹出的文件选择器中指定目标文件并自动合并 `import/export`。
4. 完成后运行 `pnpm lint:check` 确认无循环依赖、无未使用导入且行数达标。

---

## 5. 标准验收命令

每次大文件拆分或模块迁移后，统一执行：

```bash
pnpm ok
```

`pnpm ok` 已强制开启 ESLint `--max-warnings=0`，任何超出 `800` 行（`max-lines`）或残留未用导入的文件都会直接阻断，确保代码结构长期健康。

# gongzhonghaopaiban 重构计划 (v2 — 经 5 视角审查修正)

> 架构 · UI/UX · 测试 · 安全 · 产品 五维讨论最终版

## 现状诊断

| 指标 | 数值 | 问题 |
|------|------|------|
| script.js | 834 行单体 | 8 个功能域混在一个全局文件中 |
| style.css | 705 行 | 线性排列，模块边界模糊 |
| 测试覆盖率 | ≈0% | 138 行测试全部是"重复实现逻辑"，非真实行为测试 |
| CDN 依赖 | marked + DOMPurify | **无版本锁定 + 无 SRI** — 供应链攻击可绕过所有防御 |
| CSP | 无 | 单层 DOMPurify 防线，无纵深防御 |
| 图片存储 | base64 嵌入 Markdown | 双重存储（localStorage + IndexedDB），2-3 张图撑爆 5MB 限额 |
| 导出信任 | 用户复制前看不到最终效果 | 预览区样式 ≠ 导出 HTML 样式，存在信任鸿沟 |
| 交互 | alert/confirm 重度依赖 | 高频操作打断工作流 |
| Open Issue #1 | HTML 编辑模式 | 一位真实用户在等 |

---

## 核心方向

**"粘贴零调整"** — 用户写完 Markdown → 点复制 → 切到公众号后台粘贴，样式一致，无需手动调整。

其余功能（AI、多平台、插件等）全部从 PRD 中移除，聚焦这一件事。

---

## 重构步骤（重新排序）

### Phase 1 — 基础设施重构 (P0)

**Step 1: Vite + ESM 工具链**

- 用 `vite + vite-plugin-singlefile` 替代手动构建
- CDN 依赖改为 npm 包（`marked` + `dompurify`），通过 `import` 引入
- 锁定版本号 + 添加 SRI integrity
- `index.html` 改为 `<script type="module" src="js/app.js">`

**Step 2: 8 模块拆分**

```
js/
├── editor.js      编辑器核心 + undo/redo + 统计更新
├── preview.js     Markdown 渲染 + 滚动同步
├── theme.js       主题切换 + 持久化
├── image.js       IndexedDB 图片存储（纯数据层，引用令牌模式）
├── export.js      Markdown/PDF/公众号导出
├── version.js     版本管理 CRUD + 模态框展示
├── utils.js       escapeHtml, simpleHash 等纯工具函数
└── app.js         入口：初始化编排 + 全局事件绑定 + 自动保存
```

**Step 3: CSS 拆分**

```
css/
├── variables.css     CSS 变量 + 5 主题定义
├── layout.css        布局：侧边栏、主区域、编辑器容器
├── components.css    组件：按钮、工具栏、表单、模态框
├── preview.css       预览区 Markdown 渲染样式
└── responsive.css    响应式 + 打印样式
```

### Phase 2 — 安全加固 (P0.5)

**Step 4: CSP + SRI**

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'none';
  frame-src 'none'; object-src 'none';
  base-uri 'self'; form-action 'none';
">
```

- CDN 锁定版本 + SRI integrity hash
- DOMPurify 严格配置（白名单标签 + 属性）
- exportWechat 二次消毒（纵深防御）

### Phase 3 — 修复 Issue #1 (P0)

**Step 5: HTML 编辑模式**

- 编辑器增加 Markdown/HTML 模式切换 tab
- HTML 模式：原始 HTML 渲染 + 走 DOMPurify
- 非双向同步（切换回 Markdown 时提示将丢失 HTML 修改）
- 所有渲染路径统一经过 DOMPurify

**Step 6: 公众号视图预览**

- 预览模式改为三档：编辑视图 / 公众号视图 / 手机视图
- 公众号视图使用 `addWechatInlineStyles()` 渲染（与导出完全一致）
- 手机视图增加手机外框、状态栏、底部导航占位

### Phase 4 — 测试重构 (P1)

**Step 7: 先写特征测试再拆模块**

```
test/
├── editor.test.js      编辑器操作 + 快捷键 + undo/redo
├── preview.test.js     预览渲染 + 滚动同步
├── theme.test.js       主题切换 + 持久化
├── image.test.js       IndexedDB 图片存储（mock 接口）
├── export.test.js      三种导出 + 剪贴板 fallback
├── version.test.js     版本 CRUD + 模态框
├── utils.test.js       纯函数
└── app.test.js         初始化 + 事件绑定
```

- 每个模块 6-12 个测试用例
- marked + DOMPurify 全部 mock
- 覆盖率阈值：statements 80%, branches 70%, functions 85%
- CI 中以 coverage threshold 为门禁

### Phase 5 — UI/UX 优化 (P2)

**Step 8: 交互提升**

- Toast 组件替换所有 alert/confirm
- 保存状态增强（时间维度 + 错误态 + 脉冲动画）
- 按钮 disabled 状态（undo 栈空时灰化）
- 导出后粘贴引导提示
- 快捷键帮助面板（Ctrl+/）
- 字数统计浮动条

**Step 9: 图片存储优化**

- 引用令牌模式：Markdown 中存 `image://{id}` 而非 base64
- 预览时从 IndexedDB 读并创建 Blob URL
- localStorage 不再包含 base64 数据

**Step 10: GitHub Pages 部署 + README 重写**

- CI 自动部署到 GitHub Pages
- README 首行放在线试用链接
- 添加使用截图 + 一句话说明

---

## 发布节奏

| 版本 | 内容 | 预计 | 说明 |
|------|------|------|------|
| v0.2 | Step 1-3 (工具链 + 模块化 + CSS) | 2-3 天 | 无功能变化，纯重构 |
| v0.3 | Step 4-6 (安全 + HTML 模式 + 公众号视图) | 2-3 天 | 解决 Issue #1 + 实质改进 |
| v0.4 | Step 7 (测试重构) | 1-2 天 | 建立质量门禁 |
| v0.5 | Step 8-10 (UI + 图片 + 部署) | 2-3 天 | 打磨发布 |

---

## 审核意见采纳情况

| 代理 | 关键建议 | 采纳 |
|------|---------|------|
| 架构师 | 8 模块而非 6 模块 | ✅ 增加 version.js + utils.js |
| 架构师 | Vite + ESM | ✅ Step 1 |
| 架构师 | 图片引用令牌模式 | ✅ Step 9 |
| UI/UX | 公众号视图预览 | ✅ Step 6 |
| UI/UX | Toast 替换 alert | ✅ Step 8 |
| 测试 | 先写特征测试再拆模块 | ✅ Step 7 |
| 测试 | 26 核心用例 + mock 依赖 | ✅ |
| 安全 | SRI + 版本锁定 | ✅ Step 4 |
| 安全 | CSP meta 标签 | ✅ Step 4 |
| 安全 | DOMPurify 严格配置 | ✅ Step 4 |
| 产品 | 聚焦"粘贴零调整" | ✅ 核心方向 |
| 产品 | 砍掉 PRD 85% 内容 | ✅ 已移除 AI/多平台/插件 |
| 产品 | 先修 Issue #1 | ✅ Phase 3 提前 |
| 产品 | GitHub Pages + README | ✅ Step 10 |

# 公众号排版工具

> Markdown 写文章 → 一键复制 → 粘贴到公众号，样式完美一致。

[在线体验](https://121212165.github.io/gongzhonghaopaiban/) | [功能特性](#功能特性) | [快速开始](#快速开始)

## 功能特性

- **Markdown 实时预览** — 左侧写，右侧看，所见即所得
- **5 种主题** — 简约/优雅/现代/暗色/极简，一键切换
- **公众号格式导出** — 自动内联样式，粘贴到公众号编辑器零调整
- **移动端预览** — 模拟手机阅读效果
- **自动保存** — 不怕浏览器崩溃
- **版本管理** — 保存历史版本，随时恢复
- **图片粘贴** — 直接粘贴剪贴板图片
- **统计信息** — 字数、段落、图片数、阅读时长

## 快速开始

[在线使用](https://121212165.github.io/gongzhonghaopaiban/) — 无需安装，打开即用

## 本地开发

```bash
git clone https://github.com/121212165/gongzhonghaopaiban.git
cd gongzhonghaopaiban
npx serve .
```

浏览器打开 `http://localhost:3000` 即可使用。

## 技术栈

- 原生 JavaScript (ES Modules) + CSS3
- marked.js (Markdown 渲染)
- DOMPurify (XSS 防护)
- CSS Variables (主题系统)
- localStorage + IndexedDB (数据持久化)

## License

MIT

/**
 * 视图集成模块
 * 职责：初始化 HTML 编辑模式和公众号视图预览模块
 *
 * 独立的 CSP 兼容模块脚本，在 app.js 之后加载。
 * 模块本身自包含事件绑定，无需其他设置。
 */
import { initHtmlMode } from './html-mode.js';
import { initWechatView } from './wechat-view.js';

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');

// 初始化 HTML 编辑模式模块（自动绑定 mode-tabs 事件和输入处理）
initHtmlMode(editor, preview);

// 初始化公众号视图模块（自动绑定 view-mode-buttons 事件）
initWechatView(preview);

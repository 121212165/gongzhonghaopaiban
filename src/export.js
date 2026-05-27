/**
 * 导出模块
 * 职责：Markdown 导出、PDF 导出、公众号格式导出
 */

/** HTML 转义 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 导出 Markdown 文件 */
export function exportMarkdown(title, content, author) {
  const markdown = `# ${title}\n\n${author ? `作者：${author}\n\n` : ''}${content}`;

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出 PDF（通过浏览器打印） */
export function exportPdf(title, content, author) {
  const html = DOMPurify.sanitize(marked.parse(content));
  const escapedTitle = escapeHtml(title);
  const escapedAuthor = escapeHtml(author);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('弹窗被浏览器拦截，请允许弹窗后重试');
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapedTitle}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;line-height:1.8;color:#333}
    h1,h2,h3,h4,h5,h6{margin-top:1.5em;margin-bottom:0.5em;color:#1a1a1a}
    p{margin:1em 0}
    code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:'Courier New',monospace}
    pre{background:#f4f4f4;padding:16px;border-radius:8px;overflow-x:auto}
    pre code{background:none;padding:0}
    blockquote{border-left:4px solid #007aff;padding:12px 16px;margin:1em 0;color:#666;background:#f8f9fa}
    img{max-width:100%;height:auto;display:block;margin:20px auto}
    table{border-collapse:collapse;width:100%;margin:20px 0}
    th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
    th{background:#f4f4f4}
    a{color:#007aff;text-decoration:none}
    hr{border:none;border-top:2px solid #e0e0e0;margin:30px 0}
  </style>
</head>
<body>
  <h1>${escapedTitle}</h1>
  ${author ? `<p style="color:#666;margin-bottom:30px;">作者：${escapedAuthor}</p>` : ''}
  ${html}
</body>
</html>`);
  printWindow.document.close();
  printWindow.print();
}

/** 给 HTML 添加微信兼容的内联样式 */
function addWechatInlineStyles(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="wx-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('wx-root');
  if (!root) return html;

  const styles = {
    h1: 'font-size:24px;font-weight:bold;color:#1a1a1a;margin:1em 0 0.5em;',
    h2: 'font-size:20px;font-weight:bold;color:#1a1a1a;margin:1em 0 0.5em;',
    h3: 'font-size:18px;font-weight:bold;color:#1a1a1a;margin:1em 0 0.5em;',
    h4: 'font-size:16px;font-weight:bold;color:#1a1a1a;margin:1em 0 0.5em;',
    h5: 'font-size:15px;font-weight:bold;color:#1a1a1a;margin:1em 0 0.5em;',
    h6: 'font-size:14px;font-weight:bold;color:#1a1a1a;margin:1em 0 0.5em;',
    p: 'font-size:16px;line-height:1.8;color:#333;margin-bottom:1em;',
    blockquote: 'border-left:4px solid #007aff;padding:15px 20px;margin:20px 0;background:#f8f9fa;color:#666;border-radius:0 8px 8px 0;',
    ul: 'padding-left:2em;margin-bottom:1em;',
    ol: 'padding-left:2em;margin-bottom:1em;',
    li: 'margin-bottom:0.5em;line-height:1.8;',
    img: 'max-width:100%;height:auto;display:block;margin:20px auto;border-radius:8px;',
    a: 'color:#007aff;text-decoration:none;',
    table: 'width:100%;border-collapse:collapse;margin:20px 0;',
    th: 'border:1px solid #ddd;padding:12px;text-align:left;background:#f5f5f5;font-weight:bold;',
    td: 'border:1px solid #ddd;padding:12px;text-align:left;',
    hr: 'border:none;border-top:2px solid #e0e0e0;margin:30px 0;'
  };

  function walk(node) {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'code' && node.parentElement && node.parentElement.tagName !== 'PRE') {
      node.setAttribute('style', 'background:#f5f5f5;color:#e83e8c;padding:2px 6px;border-radius:4px;font-family:Monaco,Menlo,"Ubuntu Mono",Consolas,monospace;font-size:0.9em;');
    } else if (styles[tag]) {
      const existing = node.getAttribute('style') || '';
      node.setAttribute('style', styles[tag] + existing);
    }
    [...node.children].forEach(walk);
  }

  [...root.children].forEach(walk);
  return root.innerHTML;
}

/** 导出公众号格式（复制到剪贴板） */
export function exportWechat(title, content, author) {
  const html = DOMPurify.sanitize(marked.parse(content));
  const styledHtml = addWechatInlineStyles(html);
  // 二次消毒
  const safeStyled = DOMPurify.sanitize(styledHtml, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li','blockquote','pre','code','table','thead','tbody','tr','th','td','a','img','em','strong','i','b','u','s','del','ins','sub','sup','span','div','section','figure','figcaption','dl','dt','dd','details','summary'],
    ALLOWED_ATTR: ['style','href','target','rel','src','alt','title','width','height','id','class','colspan','rowspan','align','valign','start','reversed','type']
  });

  const wechatHtml = `<section style="max-width:677px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;">
  <h1 style="font-size:22px;font-weight:bold;color:#1a1a1a;margin-bottom:20px;text-align:left;">${escapeHtml(title)}</h1>
  ${author ? `<p style="color:#888;font-size:14px;margin-bottom:30px;">作者：${escapeHtml(author)}</p>` : ''}
  <section style="font-size:16px;line-height:1.8;color:#333;">${safeStyled}</section>
</section>`;

  navigator.clipboard.writeText(wechatHtml).then(() => {
    return true;
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = wechatHtml;
    textarea.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  });
}

/**
 * 安全配置模块
 * 职责：DOMPurify 严格/宽松配置、HTML 消毒函数、内容长度检查
 */

import DOMPurify from 'dompurify';

/** 严格模式（用于预览渲染，不允许 style 属性） */
export const PURIFY_CONFIG_STRICT = {
  ALLOWED_TAGS: [
    'h1','h2','h3','h4','h5','h6',
    'p','br','hr',
    'ul','ol','li',
    'blockquote','pre','code',
    'table','thead','tbody','tr','th','td',
    'a','img',
    'em','strong','i','b','u','s','del','ins',
    'sub','sup','span','div',
    'dl','dt','dd','details','summary',
    'figure','figcaption'
  ],
  ALLOWED_ATTR: [
    'href','target','rel',
    'src','alt','title','width','height',
    'id','class',
    'colspan','rowspan','align','valign',
    'start','reversed','type'
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOW_ARIA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  FORBID_TAGS: ['style','form','input','select','textarea','button','noscript'],
  FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus','onblur','action','formaction','srcdoc','sandbox']
};

/** 宽松模式（用于 exportWechat，需要保留 style 属性） */
export const PURIFY_CONFIG_LOOSE = {
  ...PURIFY_CONFIG_STRICT,
  ALLOWED_ATTR: [...PURIFY_CONFIG_STRICT.ALLOWED_ATTR, 'style'],
  FORBID_ATTR: PURIFY_CONFIG_STRICT.FORBID_ATTR.filter(a => a !== 'style')
};

/** HTML 消毒函数 */
export function sanitizeHtml(html, config = PURIFY_CONFIG_STRICT) {
  return DOMPurify.sanitize(html, config);
}

/** 最大内容长度（约 10 万字） */
export const MAX_CONTENT_LENGTH = 100000;

/** 检查内容长度是否在限制内 */
export function checkContentLength(text) {
  return text.length <= MAX_CONTENT_LENGTH;
}

const fs = require('fs');

const css = fs.readFileSync('style.css', 'utf8');
const marked = fs.readFileSync('lib/marked.min.js', 'utf8');
const purify = fs.readFileSync('lib/purify.min.js', 'utf8');
const app = fs.readFileSync('script.js', 'utf8');
const template = fs.readFileSync('index.template.html', 'utf8');

let html = template;

// Inline CSS
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n    </style>');

// Inline scripts
html = html.replace('<script src="lib/marked.min.js"></script>', '<script>\n' + marked + '\n    </script>');
html = html.replace('<script src="lib/purify.min.js"></script>', '<script>\n' + purify + '\n    </script>');
html = html.replace('<script src="script.js"></script>', '<script>\n' + app + '\n    </script>');

// Verify all replacements happened
const checks = [
    ['style.css', html.includes('href="style.css"')],
    ['lib/marked', html.includes('src="lib/marked')],
    ['lib/purify', html.includes('src="lib/purify')],
    ['src="script.js"', html.includes('src="script.js"')],
];

let ok = true;
for (const [name, found] of checks) {
    if (found) {
        console.error('FAIL: External reference still present:', name);
        ok = false;
    }
}

if (!ok) process.exit(1);

// Verify new code is present
if (!html.includes('previewIframe')) {
    console.error('FAIL: iframe code not found in output');
    process.exit(1);
}

fs.writeFileSync('index.html', html);
console.log('Build complete:', (html.length / 1024).toFixed(1), 'KB');
console.log('All external references replaced. iframe code present.');

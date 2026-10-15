import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import sharp from 'sharp';
import { resolveArchiveImage } from '../src/lib/archive-images.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/archive-images.json'), 'utf8'));
const errors = [];
let local = 0;
let unavailable = 0;
const files = new Set();

function visit(node, article) {
    if (node.type === 'image') {
        const src = resolveArchiveImage(node.url, manifest);
        if (!src) {
            if (manifest[node.url]?.status === 'unavailable') unavailable++;
            else errors.push(`${article}: image has no verified local copy: ${node.url}`);
        } else {
            const file = path.resolve(root, 'public', '.' + src);
            if (!file.startsWith(path.join(root, 'public/images/')) || !fs.existsSync(file)) {
                errors.push(`${article}: missing local image: ${src}`);
            } else {
                const data = fs.readFileSync(file);
                const image = data.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
                    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
                    /GIF8[79]a/.test(data.subarray(0, 6).toString()) ||
                    (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP');
                if (!image) errors.push(`${article}: invalid image data: ${src}`);
                else {
                    local++;
                    files.add(file);
                }
            }
        }
    }
    for (const child of node.children || []) visit(child, article);
}

for (const article of fs.readdirSync(path.join(root, 'articles')).filter(f => f.endsWith('.md'))) {
    const markdown = fs.readFileSync(path.join(root, 'articles', article), 'utf8');
    visit(unified().use(remarkParse).parse(markdown), article);
}
for (const file of files) {
    try {
        await sharp(file, { failOn: 'warning' }).stats();
    } catch (error) {
        errors.push(`${file}: image cannot be fully decoded: ${error.message}`);
    }
}
console.log(`${local} local image references; ${unavailable} documented unavailable originals; ${errors.length} errors`);
if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
}

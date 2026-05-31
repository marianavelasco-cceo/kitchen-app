import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const appJs = fs.readFileSync(path.join(root, 'scripts', 'app.full.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'scripts', 'index.full.html'), 'utf8');

fs.writeFileSync(path.join(root, 'app.js'), appJs, 'utf8');
fs.writeFileSync(path.join(root, 'index.html'), indexHtml, 'utf8');
console.log('Deployed app.js', appJs.length, 'index.html', indexHtml.length);

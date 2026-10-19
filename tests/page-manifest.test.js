const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
const appRoot = path.join(root, project.miniprogramRoot);
const app = JSON.parse(fs.readFileSync(path.join(appRoot, 'app.json'), 'utf8'));

for (const page of app.pages) {
  for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
    assert(fs.existsSync(path.join(appRoot, page + extension)), `Page ${page} missing ${extension}`);
  }
  const config = JSON.parse(fs.readFileSync(path.join(appRoot, page + '.json'), 'utf8'));
  assert.equal(typeof config.usingComponents, 'object', `${page} must declare its component dependencies`);
}
console.log(`Manifest: all ${app.pages.length} pages have complete, valid page files.`);

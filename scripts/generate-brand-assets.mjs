import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const geometry = JSON.parse(await fs.readFile(new URL('src/components/brand/geometry.json', root), 'utf8'));
const palette = {navy: '#06111E', cyan: '#22D3EE', teal: '#06B6D4', white: '#F8FAFC'};
const themes = {
  dark: {ink: palette.white, accent: palette.cyan},
  light: {ink: palette.navy, accent: palette.teal},
};
function paths(theme) {
  return `<defs><mask id="bow-cutout"><rect width="32" height="32" fill="white"/><path d="${geometry.clearance}" fill="black"/></mask></defs><path d="${geometry.arch}" fill="${theme.ink}" fill-rule="evenodd" mask="url(#bow-cutout)"/><g fill="${theme.accent}" stroke="${theme.accent}"><path d="${geometry.string}" fill="none" stroke-width=".8"/><path d="${geometry.needle}" stroke="none"/><path d="${geometry.star}" fill="none" stroke-width=".65"/></g>`;
}
function svg(viewBox, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Dream Service"><title>Dream Service</title>${content}</svg>\n`;
}
function logo(theme, compact = false) {
  const wordmark = geometry.wordmark;
  const letters = (shapes, color) => `<g fill="none" stroke="${color}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round">${shapes.map(d => `<path d="${d}"/>`).join('')}</g>`;
  return svg(compact ? wordmark.compactViewBox : wordmark.viewBox,
    `<g transform="${wordmark.markTransform}">${paths(theme)}</g>${letters(wordmark.dream, theme.ink)}${letters(wordmark.service, theme.accent)}<path d="${wordmark.dot}" fill="${theme.accent}"/>`);
}
await fs.mkdir(new URL('public/images/', root), {recursive: true});
await fs.mkdir(new URL('public/icons/', root), {recursive: true});
for (const [name, theme] of Object.entries(themes)) {
  for (const [file, content] of [
    [`dreamservice-logo-${name}.svg`, logo(theme)],
    [`dreamservice-compact-${name}.svg`, logo(theme, true)],
    [`dreamservice-mark-${name}.svg`, svg(geometry.viewBox, paths(theme))],
  ]) await fs.writeFile(new URL('public/images/' + file, root), content);
}
// Preserve previous public URLs while replacing all of their old geometry.
for (const file of ['dreamservice-logo.svg', 'dreamservice-wordmark.svg']) {
  await fs.writeFile(new URL('public/images/' + file, root), logo(themes.dark));
}
await fs.writeFile(new URL('public/images/dreamservice-compact.svg', root), logo(themes.dark, true));
await fs.writeFile(new URL('public/images/dreamservice-mark.svg', root), svg(geometry.viewBox, paths(themes.dark)));
const icon = svg(geometry.viewBox, `<rect width="32" height="32" rx="7" fill="${palette.navy}"/><g transform="translate(2 2) scale(.875)">${paths(themes.dark)}</g>`);
await fs.writeFile(new URL('src/app/icon.svg', root), icon);
for (const [file, size] of [['src/app/apple-icon.png',180], ['public/icons/icon-192.png',192], ['public/icons/icon-512.png',512]]) {
  await sharp(Buffer.from(icon)).resize(size,size).png().toFile(fileURLToPath(new URL(file,root)));
}
// Keep the entire symbol inside the central maskable safe zone (80% diameter).
const maskable = svg('0 0 512 512', `<rect width="512" height="512" fill="${palette.navy}"/><g transform="translate(96 96) scale(10)">${paths(themes.dark)}</g>`);
await sharp(Buffer.from(maskable)).png().toFile(fileURLToPath(new URL('public/icons/icon-maskable-512.png', root)));
// ICO directory with PNG frames: supported by current browsers and Windows.
const sizes = [16,32,48];
const frames = await Promise.all(sizes.map(size => sharp(Buffer.from(icon)).resize(size,size).png().toBuffer()));
const directory = Buffer.alloc(6 + sizes.length*16);
directory.writeUInt16LE(1,2);
directory.writeUInt16LE(sizes.length,4);
let offset = directory.length;
frames.forEach((frame,index) => {
  const entry = 6 + index*16;
  directory[entry] = sizes[index]; directory[entry+1] = sizes[index];
  directory.writeUInt16LE(1,entry+4); directory.writeUInt16LE(32,entry+6);
  directory.writeUInt32LE(frame.length,entry+8); directory.writeUInt32LE(offset,entry+12);
  offset += frame.length;
});
await fs.writeFile(new URL('src/app/favicon.ico',root), Buffer.concat([directory,...frames]));

console.log('Generated path-based Dream Service logos, theme variants, ICO and application icons.');

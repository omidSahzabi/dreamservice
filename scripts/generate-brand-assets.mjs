import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const geometry = JSON.parse(await fs.readFile(new URL('src/components/brand/geometry.json', root), 'utf8'));
const paths = `<defs><mask id="arch-cutout"><rect width="32" height="32" fill="white"/><path d="${geometry.clearance}" fill="black"/></mask></defs><path d="${geometry.arch}" fill-rule="evenodd" mask="url(#arch-cutout)"/><path d="${geometry.needle}"/>`;
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${geometry.viewBox}" fill="currentColor">${paths}</svg>\n`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${geometry.viewBox}"><rect width="32" height="32" rx="7" fill="#0b1220"/><g fill="#47d5e2" transform="translate(2 2) scale(.875)">${paths}</g></svg>\n`;
await fs.mkdir(new URL('public/icons/', root), {recursive: true});
await fs.writeFile(new URL('public/images/dreamservice-mark.svg', root), mark);
await fs.writeFile(new URL('src/app/icon.svg', root), icon);
for (const [file, size] of [['src/app/apple-icon.png',180], ['public/icons/icon-192.png',192], ['public/icons/icon-512.png',512]]) {
  await sharp(Buffer.from(icon)).resize(size,size).png().toFile(fileURLToPath(new URL(file,root)));
}
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

// The old asset used its symbol as the D and contained only "ream Services".
// Keep the approved symbol separate from a complete, editable wordmark.
await fs.writeFile(new URL('public/images/dreamservice-wordmark.svg',root), "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 184 32\"><text x=\"4\" y=\"24\" fill=\"#172636\" font-family=\"Segoe UI, Tahoma, Arial, sans-serif\" font-size=\"24\" font-weight=\"600\" letter-spacing=\"-.65\" textLength=\"174\" lengthAdjust=\"spacingAndGlyphs\">DreamService</text></svg>\n");
console.log('Generated DreamService mark, complete wordmark, ICO and app icons.');

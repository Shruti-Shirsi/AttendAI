import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nativePath = path.join(__dirname, 'node_modules', 'rollup', 'dist', 'native.js');

if (fs.existsSync(nativePath)) {
  let content = fs.readFileSync(nativePath, 'utf8');
  if (!content.includes('@rollup/wasm-node/dist/native.js')) {
    content = content.replace(
      /const nativeModule = requireWithFriendlyError\([\s\S]*?\);/,
      `let nativeModule;
try {
  nativeModule = requireWithFriendlyError(
    existsSync(path.join(__dirname, localName)) ? localName : \`@rollup/rollup-\${packageBase}\`
  );
} catch (e) {
  try {
    nativeModule = require('@rollup/wasm-node/dist/native.js');
  } catch (_wasmErr) {
    throw e;
  }
}`
    );
    fs.writeFileSync(nativePath, content, 'utf8');
    console.log('[AttendAI] Applied WDAC Rollup WASM fallback patch successfully.');
  }
}


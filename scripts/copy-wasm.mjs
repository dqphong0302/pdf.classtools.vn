// Copies WASM binaries from node_modules into public/ before each build.
import { copyFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

function packageRoot(packageName) {
  // node_modules/<name> is a symlink under pnpm; realpath it first.
  return realpathSync(join(process.cwd(), 'node_modules', packageName));
}

function copyPackageFile(packageName, relativeFile, targetDir, targetName) {
  const root = packageRoot(packageName);
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(join(root, relativeFile), join(targetDir, targetName));
  console.log(`copied ${packageName}/${relativeFile} -> ${join(targetDir, targetName)}`);
}

copyPackageFile('@bentopdf/gs-wasm', 'assets/gs.js', 'public/wasm/gs', 'gs.js');
copyPackageFile('@bentopdf/gs-wasm', 'assets/gs.wasm', 'public/wasm/gs', 'gs.wasm');
copyPackageFile('@jspawn/qpdf-wasm', 'qpdf.wasm', 'public/wasm/qpdf', 'qpdf.wasm');

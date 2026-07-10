import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = join(projectRoot, 'dist');
const failures = [];

const fail = (message) => failures.push(message);
const requireFile = (path, label = relative(projectRoot, path)) => {
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`File mancante: ${label}`);
    return false;
  }
  return true;
};

const indexPath = join(distRoot, 'index.html');
if (requireFile(indexPath)) {
  const html = readFileSync(indexPath, 'utf8');

  if (html.includes('/src/main.tsx') || html.includes('%BASE_URL%')) {
    fail('dist/index.html contiene riferimenti sorgente non trasformati da Vite.');
  }

  if (!html.includes('/Tracce/')) {
    fail('dist/index.html non usa il percorso base /Tracce/.');
  }

  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
  const localReferences = references.filter((value) => value.startsWith('/Tracce/'));

  if (!localReferences.some((value) => /\/assets\/.*\.js(?:\?|$)/.test(value))) {
    fail('Nessun bundle JavaScript compilato è referenziato in dist/index.html.');
  }

  for (const reference of localReferences) {
    const cleanReference = reference.split('?')[0].split('#')[0];
    const relativePath = cleanReference.replace(/^\/Tracce\//, '');
    if (relativePath && !requireFile(join(distRoot, relativePath), cleanReference)) break;
  }
}

const manifestPath = join(distRoot, 'manifest.webmanifest');
if (requireFile(manifestPath)) {
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
      fail('Il manifest non contiene icone.');
    } else {
      for (const icon of manifest.icons) {
        if (!icon?.src || icon.src.startsWith('data:') || /^https?:/.test(icon.src)) continue;
        const iconPath = icon.src.split('?')[0].replace(/^\.?\//, '');
        requireFile(join(distRoot, iconPath), `icona manifest: ${icon.src}`);
      }
    }
  } catch (error) {
    fail(`Manifest non valido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const requiredAsset of [
  'icons/tracce.svg',
  'icons/tracce-light.svg',
  'icons/tracce-dark.svg',
  'icons/lascia-traccia.svg',
]) {
  requireFile(join(distRoot, requiredAsset), requiredAsset);
}

if (failures.length > 0) {
  console.error('\nVerifica build fallita:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Build verificata: bundle, percorsi, manifest e icone sono coerenti.');

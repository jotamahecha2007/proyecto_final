// Copia la lógica compartida de la app a la Cloud Function, para que ambas
// calculen el Trust Score y clasifiquen solicitudes exactamente igual.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'functions', 'src', 'shared');
mkdirSync(dest, { recursive: true });
for (const f of ['types.ts', 'trustScore.ts', 'classifierRules.ts', 'businessDays.ts']) {
  copyFileSync(join(root, 'src', 'lib', f), join(dest, f));
  console.log(`copiado src/lib/${f} → functions/src/shared/${f}`);
}

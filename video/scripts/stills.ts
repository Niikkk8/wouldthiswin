// Renders single frames of a composition, for checking layout. Usage: tsx scripts/stills.ts <id> <outDir> <frame> [<frame>...]
import { join } from "node:path";
import { preparePublic, still } from "./lib";
const [id, dir, ...frames] = process.argv.slice(2);
await preparePublic();
for (const f of frames) await still(id, join(dir, `${id}-${f}.png`), Number(f));

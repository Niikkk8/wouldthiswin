// Zoomed render of logo.svg for the smoothness gate (Playwright, exact viewport).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const svg = readFileSync(process.argv[2], "utf8");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 728, height: 528 } });
await p.setContent(`<body style="margin:0;background:#0a0a0b">${svg.replace("<svg ", '<svg style="width:728px;height:528px;display:block" ')}</body>`);
await p.screenshot({ path: process.argv[3] });
await b.close();

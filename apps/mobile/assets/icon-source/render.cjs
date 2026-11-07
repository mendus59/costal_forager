const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  const jobs = [['icon',1024,false],['fg',1024,true],['bg',1024,false],['mono',1024,true],['splash',1024,true],['icon',48,false,'favicon']];
  for (const [n,s,transp,out] of jobs) {
    await p.setViewportSize({ width: s, height: s });
    const svg = fs.readFileSync(n+'.svg','utf8').replace('width="1024" height="1024"', `width="${s}" height="${s}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: (out||n)+'.png', omitBackground: transp, clip:{x:0,y:0,width:s,height:s} });
  }
  await b.close();
})();

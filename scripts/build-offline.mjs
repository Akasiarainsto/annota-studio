import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';

const result=await build({entryPoints:['src/app.js'],bundle:true,format:'iife',platform:'browser',target:'es2022',write:false,legalComments:'eof'});
const css=await readFile('styles.css','utf8');let html=await readFile('index.html','utf8');
html=html.replace('href="team.html"','href="https://akasiarainsto.github.io/annota-studio/team.html"');
html=html.replace('<link rel="stylesheet" href="styles.css">',()=>`<style>${css}</style>`);
html=html.replace('<script type="module" src="src/app.js"></script>',()=>`<script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
await writeFile('打开演示.html',html,'utf8');process.stdout.write('Built offline annotation workspace with bundled local clip encoder.\n');

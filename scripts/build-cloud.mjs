import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('vendor',{recursive:true});
await mkdir('.server_build',{recursive:true});
await build({stdin:{contents:'export {createAuthClient} from "@neondatabase/auth";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',minify:true,outfile:'vendor/neon-auth.js',legalComments:'eof'});
await build({stdin:{contents:'import fix from "fix-webm-duration"; export function repairWebm(blob,duration){return fix(blob,duration,{logger:false});}',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',minify:true,outfile:'vendor/webm-duration.js',legalComments:'eof'});
await build({entryPoints:['server/index.js'],bundle:true,format:'esm',platform:'node',target:'node24',minify:true,outfile:'.server_build/index.mjs',legalComments:'eof',banner:{js:'import {createRequire} from "node:module"; const require=createRequire(import.meta.url);'}});

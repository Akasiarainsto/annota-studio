"""Inline the small local ES module graph for double-click preview; source stays modular."""
from pathlib import Path, PurePosixPath
import re

ROOT=Path(__file__).resolve().parents[1]
MODULES=['icons','utils','audio-peaks','seed-data','review-workflow','core','storage','validation_rules/profiles','validation_rules/common','validation_rules/image-rules','validation_rules/video-rules','validation_rules/audio-rules','validation-adapters','validation-samples','json-parser','json-validation','review-view','views','media','video-comparison','json-validator','app']

def transform_module(name):
    source=(ROOT/'src'/f'{name}.js').read_text(encoding='utf-8')
    exports=re.findall(r'^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)',source,re.M)
    def module_key(target):
        return str(PurePosixPath(name).parent/target)
    source=re.sub(r'import\s+\*\s+as\s+(\w+)\s+from\s+[\'"]\./([^\'"]+)\.js[\'"];?',lambda match:"const "+match.group(1)+"=modules['"+module_key(match.group(2))+"'];",source)
    def replace_import(match):
        names=re.sub(r'\s+as\s+',':',match.group(1))
        return "const {"+names+"}=modules['"+module_key(match.group(2))+"'];"
    source=re.sub(r'import\s*\{([^}]+)\}\s*from\s*[\'"]\./([^\'"]+)\.js[\'"];?',replace_import,source)
    source=re.sub(r'\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)','',source)
    return f"modules['{name}']=(()=>{{\n{source}\nreturn {{{','.join(exports)}}};\n}})();\n"

html=(ROOT/'index.html').read_text(encoding='utf-8')
css=(ROOT/'styles.css').read_text(encoding='utf-8')
bundle="(()=>{'use strict';const modules={};\n"+''.join(map(transform_module,MODULES))+"})();"
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+css+'</style>')
html=html.replace('<script type="module" src="src/app.js"></script>','<script>'+bundle+'</script>')
(ROOT/'打开演示.html').write_text(html,encoding='utf-8')
print(f'Built 打开演示.html with {len(MODULES)} local modules; no runtime dependency or network requests.')


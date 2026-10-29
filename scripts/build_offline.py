"""Build the double-click entry with the same pinned JavaScript bundler as cloud builds."""
from pathlib import Path
import os
import shutil
import subprocess

root=Path(__file__).resolve().parents[1]
node=os.environ.get('NODE_EXECUTABLE') or shutil.which('node')
if not node:
    raise RuntimeError('Install Node.js or set NODE_EXECUTABLE, then run npm ci before rebuilding.')
subprocess.run([node,str(root/'scripts/build-offline.mjs')],cwd=root,check=True)

"""Compare the deployed static site with its exact published Git objects."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import os
import subprocess
import urllib.request

SITE = 'https://akasiarainsto.github.io/annota-studio/'
PUBLISH_ROOT = Path(__file__).resolve().parents[2] / 'annota_pages_publish'
REPORT = Path(__file__).resolve().parents[1] / 'evidence/pages_http_report.json'


def read_published_blob(name):
    return subprocess.check_output(['git', '-C', str(PUBLISH_ROOT), 'show', 'HEAD:' + name])


def fetch_published_file(name, range_value=None):
    proxy = os.environ.get('ANNOTA_PROXY', 'http://127.0.0.1:10808')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({'https': proxy}))
    headers = {'Cache-Control': 'no-cache'}
    if range_value:
        headers['Range'] = range_value
    with opener.open(urllib.request.Request(SITE + name, headers=headers), timeout=40) as response:
        return response.status, response.headers, response.read()


def verify_file(name):
    expected = read_published_blob(name)
    media = name.endswith(('.wav', '.mp4', '.jpg'))
    status, _, actual = fetch_published_file(name, 'bytes=0-' if media else None)
    assert status in (200, 206), (name, status)
    assert hashlib.sha256(actual).digest() == hashlib.sha256(expected).digest(), name
    return {'path': name, 'bytes': len(actual), 'sha256': hashlib.sha256(actual).hexdigest()}


def verify_range(name):
    status, headers, actual = fetch_published_file(name, 'bytes=0-63')
    assert status == 206 and len(actual) == 64, (name, status, len(actual))
    assert actual == read_published_blob(name)[:64], name
    assert headers.get('Content-Range', '').startswith('bytes 0-63/'), name
    return name


if __name__ == '__main__':
    names = subprocess.check_output(['git', '-C', str(PUBLISH_ROOT), 'ls-files', '-z']).decode().split('\0')
    names = [name for name in names if name and not name.startswith('.')]
    with ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(verify_file, names))
    ranges = [verify_range(name) for name in ['assets/audio/D11_766.wav', 'assets/video/case2_veo3_1_fast.mp4', 'assets/images/street_market.jpg']]
    report = {'passed': True, 'url': SITE, 'runtime_files_matched': len(results), 'range_requests_passed': ranges, 'files': results}
    REPORT.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'files'}, indent=2))

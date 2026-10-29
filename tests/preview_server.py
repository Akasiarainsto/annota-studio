"""Static preview with byte-range responses required by media seeking."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import sys

PROJECT_ROOT=Path(__file__).resolve().parents[1]
DEFAULT_PORT=8768
COPY_CHUNK_BYTES=64*1024

class MediaPreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(PROJECT_ROOT),**kwargs)

    def send_head(self):
        self.remaining_bytes=None
        target=Path(self.translate_path(self.path))
        range_header=self.headers.get('Range')
        if not range_header or not target.is_file():
            return super().send_head()
        file_size=target.stat().st_size
        bounds=self.parse_byte_range(range_header,file_size)
        if bounds is None:
            self.send_response(416)
            self.send_header('Content-Range',f'bytes */{file_size}')
            self.send_header('Content-Length','0')
            self.end_headers()
            return None
        start,end=bounds
        source=target.open('rb')
        source.seek(start)
        self.remaining_bytes=end-start+1
        self.send_response(206)
        self.send_header('Content-Type',self.guess_type(str(target)))
        self.send_header('Content-Length',str(self.remaining_bytes))
        self.send_header('Content-Range',f'bytes {start}-{end}/{file_size}')
        self.send_header('Accept-Ranges','bytes')
        self.end_headers()
        return source

    @staticmethod
    def parse_byte_range(header,file_size):
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',header.strip())
        if not match or file_size<=0 or not any(match.groups()):
            return None
        first,last=match.groups()
        start=int(first) if first else max(0,file_size-int(last))
        end=min(file_size-1,int(last)) if first and last else file_size-1
        return (start,end) if 0<=start<=end<file_size else None

    def copyfile(self,source,outputfile):
        if self.remaining_bytes is None:
            return super().copyfile(source,outputfile)
        while self.remaining_bytes>0:
            chunk=source.read(min(COPY_CHUNK_BYTES,self.remaining_bytes))
            if not chunk:
                break
            outputfile.write(chunk)
            self.remaining_bytes-=len(chunk)

    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        super().end_headers()

if __name__=='__main__':
    port=int(sys.argv[1]) if len(sys.argv)>1 else DEFAULT_PORT
    print(f'Annota preview: http://127.0.0.1:{port}/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',port),MediaPreviewHandler).serve_forever()

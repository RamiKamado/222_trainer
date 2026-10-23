#!/usr/bin/env python3
"""src/ の部品から、リポジトリ直下の index.html（1 ファイルで完結）を作る。
使い方: python3 src/build.py
"""
import json, pathlib
SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parent
data = json.loads((SRC / 'data' / 'cases.json').read_text(encoding='utf-8'))
js_data = 'const DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
head = (SRC / 'head.html').read_text(encoding='utf-8')
body = (SRC / 'body.html').read_text(encoding='utf-8')
core = (SRC / 'core.js').read_text(encoding='utf-8')
app = (SRC / 'app.js').read_text(encoding='utf-8')
script = '<script>\n' + js_data + core + '\n' + app + '\n</script>\n'
page = ('<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<link rel="manifest" href="./manifest.webmanifest">\n'
        '<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%}</style>\n'
        + head + '</head>\n<body>\n' + body + script + '</body>\n</html>\n')
(ROOT / 'index.html').write_text(page, encoding='utf-8')
print('index.html', len(page.encode('utf-8')), 'bytes')

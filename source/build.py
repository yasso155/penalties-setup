"""Builds ../index.html from src.html (placeholders: REF_JSON, LOGO_LIGHT, LOGO_DARK).
Run:  python3 build.py   (from this folder).  Edit src.html, never index.html directly."""
import base64
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
s=open('src.html',encoding='utf-8').read()
out=(s.replace('/*REF_JSON*/null',open('ref.json',encoding='utf-8').read())
      .replace('/*LOGO_LIGHT*/',b64('logos/yaser-lockup-horizontal-color-onlight.svg'))
      .replace('/*LOGO_DARK*/',b64('logos/yaser-lockup-horizontal-color-ondark.svg')))
head=('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n')
reset=('<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
 'body{margin:0;font-size:14px}[hidden]{display:none!important}</style>\n')
i=out.index('<style>\n/* Layout'); t=out[:i]; rest=out[i:]; j=rest.index('</style>')+len('</style>')
html=head+t+reset+rest[:j]+'\n</head>\n<body>\n'+rest[j:]+'\n<script type="module" src="cloud.js"></script>\n</body>\n</html>\n'
open('../index.html','w',encoding='utf-8').write(html)
print('built ../index.html')

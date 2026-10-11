#!/usr/bin/env python3
"""Builds the deployable index.html (for Vercel) from app.html.
app.html is the single source: it is also what gets published as the Claude artifact."""
src = open('app.html', encoding='utf-8').read()
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="theme-color" content="#14110d"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg" type="image/svg+xml">'
        '<link rel="apple-touch-icon" href="icon.svg">'
        '<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}body{background:#17140f}</style>'
        '</head><body>')
open('index.html', 'w', encoding='utf-8').write(head + src + '</body></html>')
print('index.html written', len(src))

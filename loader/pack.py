"""Packs the loading screen into an HTML5 build ready for ad networks: index.html + .zip.

    python loader/pack.py                  # clean HTML5 template with the loader
    python loader/pack.py path/to/game.html  # inject the loader into an existing build

When a game is given, the loader goes in right after <body>, before any game code, and hides itself on
window "load". A game that reports real progress sets window.MOONY_LOADER_MANUAL = true and calls
MoonyLoader.setProgress(p) / MoonyLoader.finish() itself. Sibling files of the game's HTML (js, assets)
are copied into the build too.
"""
import argparse, re, shutil, sys, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build  # noqa: E402

ROOT = HERE.parent
OUT = ROOT / 'build' / 'html5'
SIZE_LIMIT = 5 * 1024 * 1024  # the strictest common network limit (AppLovin, Unity, ironSource)

BOOTSTRAP = """(function () {
  var loader = MoonyLoader.show();
  window.addEventListener('load', function () { if (!window.MOONY_LOADER_MANUAL) loader.finish(); });
})();"""

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Moony Dreams</title>
<style>html, body { margin: 0; height: 100%; overflow: hidden; background: #080a1e; }</style>
</head>
<body>
<!-- MOONY LOADER -->
<!-- Game goes here -->
</body>
</html>
"""


def inject(html, js):
    block = '<script>\n' + js + '\n</script>\n<script>\n' + BOOTSTRAP + '\n</script>\n'
    if '<!-- MOONY LOADER -->' in html:
        return html.replace('<!-- MOONY LOADER -->', block.rstrip('\n'), 1)
    if 'MoonyLoader' in html:
        sys.exit('This HTML already contains MoonyLoader. Pass the original build, not a packed one.')
    m = re.search(r'<body[^>]*>', html, re.I)
    if m:
        return html[:m.end()] + '\n' + block + html[m.end():]
    m = re.search(r'</head\s*>', html, re.I)  # no <body> tag: the parser opens one after </head>
    if m:
        return html[:m.end()] + '\n<body>\n' + block + html[m.end():]
    return block + html


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('game', nargs='?', help='game HTML to inject the loader into')
    ap.add_argument('--name', help='build name (default: game folder name, or "moony-loader")')
    ap.add_argument('--no-zip', action='store_true')
    args = ap.parse_args()

    build.main()
    js = (build.DIST / 'moony-loader.js').read_text(encoding='utf-8')

    if args.game:
        game = Path(args.game).resolve()
        if not game.is_file():
            sys.exit(f'File not found: {game}')
        name = args.name or (game.parent.name if game.stem.lower() == 'index' else game.stem)
        html = game.read_text(encoding='utf-8-sig')
    else:
        game, name, html = None, args.name or 'moony-loader', TEMPLATE

    target = OUT / name
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)

    # Multi-file builds (index.html + js/assets next to it): take the folder along.
    # Only for index.html, so a stray game.html on the Desktop doesn't drag the whole Desktop in.
    if game and game.name.lower() == 'index.html':
        others = [p for p in game.parent.iterdir() if p != game and p.name not in ('build', '.git')]
        files = [f for p in others for f in ([p] if p.is_file() else p.rglob('*')) if f.is_file()]
        if len(files) > 2000 or sum(f.stat().st_size for f in files) > 200 * 1024 * 1024:
            sys.exit(f'{game.parent} has too many files for a playable build. Put the game in its own folder.')
        for p in others:
            if p.is_dir():
                shutil.copytree(p, target / p.name)
            else:
                shutil.copy2(p, target / p.name)
        if others:
            print(f'Copied {len(others)} sibling file(s)/folder(s) from {game.parent}')

    (target / 'index.html').write_text(inject(html, js), encoding='utf-8')
    size = sum(p.stat().st_size for p in target.rglob('*') if p.is_file())
    print(f'\n{target / "index.html"}  ({size / 1024:.1f} KB total)')

    if not args.no_zip:
        zpath = OUT / f'{name}.zip'
        with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for p in sorted(target.rglob('*')):
                if p.is_file():
                    z.write(p, p.relative_to(target).as_posix())
        print(f'{zpath}  ({zpath.stat().st_size / 1024:.1f} KB)')

    if size > SIZE_LIMIT:
        print(f'\nWARNING: build is {size / 1048576:.2f} MB, over the 5 MB limit of most ad networks.')


if __name__ == '__main__':
    main()

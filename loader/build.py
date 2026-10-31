"""Builds the self-contained loader: inlines the CSS and the images (as data URIs) into dist/.

    python loader/build.py
"""
import base64, io, json, re
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / 'assets'
DIST = HERE / 'dist'

FOX_WIDTH = 512  # enough for a ~250 css px fox on 2x screens; the art is flat, so it scales well


def png_data_uri(path, width=None):
    im = Image.open(path).convert('RGBA')
    im = im.crop(im.getbbox())
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.quantize(256, method=Image.FASTOCTREE).save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), im.height / im.width


def minify_css(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{}:;,>])\s*', r'\1', css)
    return css.replace(';}', '}').strip()


def main():
    fox, fox_ratio = png_data_uri(ASSETS / 'fox.png', FOX_WIDTH)
    logo, logo_ratio = png_data_uri(ASSETS / 'moony_dreams.png')
    css = minify_css((HERE / 'src' / 'moony-loader.css').read_text(encoding='utf-8'))

    js = (HERE / 'src' / 'moony-loader.js').read_text(encoding='utf-8')
    js = (js.replace("'__FOX__'", json.dumps(fox))
            .replace("'__LOGO__'", json.dumps(logo))
            .replace('__FOX_RATIO__', f'{fox_ratio:.4f}')
            .replace('__LOGO_RATIO__', f'{logo_ratio:.4f}')
            .replace('__CSS__', json.dumps(css)))
    js = js.replace('</', '<\\/')  # safe to paste inside an inline <script>

    DIST.mkdir(exist_ok=True)
    (DIST / 'moony-loader.js').write_text(js, encoding='utf-8')

    demo = (HERE / 'src' / 'demo.html').read_text(encoding='utf-8').replace('<!-- LOADER -->', '<script>\n' + js + '\n</script>')
    (DIST / 'demo.html').write_text(demo, encoding='utf-8')

    white_js = js.replace("opts = opts || {};", "opts = opts || {}; if (opts.theme == null) opts.theme = 'white';")
    (DIST / 'moony-loader-white.js').write_text(white_js, encoding='utf-8')
    (DIST / 'demo-white.html').write_text(demo.replace(js, white_js), encoding='utf-8')

    print(f'dist/moony-loader.js  {len(js.encode()) / 1024:.1f} KB')
    print(f'dist/demo.html        {len(demo.encode()) / 1024:.1f} KB')


if __name__ == '__main__':
    main()

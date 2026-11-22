"""Build the all-in-one SVD page and a zip suitable for local classroom sharing."""
import argparse
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


HERE = Path(__file__).resolve().parent
STATIC = HERE.parent / 'dist' if (HERE.parent / 'dist').is_dir() else HERE.parent


def standalone_page():
    page = (STATIC / 'index.html').read_text(encoding='utf-8')
    style = (STATIC / 'style.css').read_text(encoding='utf-8')
    worker = (STATIC / 'svd-worker.js').read_text(encoding='utf-8')
    app = (STATIC / 'app.js').read_text(encoding='utf-8')
    # The app reads sample URLs directly from the thumbnails embedded below.
    app = re.sub(r"new Worker\('svd-worker\.js(?:\?[^']*)?'\)", "new Worker(classroomWorkerURL())", app)
    if "assets/" in app or "new Worker('svd-worker.js" in app:
        raise ValueError('The offline sample or worker path needs updating.')
    helper = """
let classroomWorkerObjectURL;
function classroomWorkerURL() {
  if (!classroomWorkerObjectURL) {
    const code = document.getElementById('classroom-worker').textContent;
    classroomWorkerObjectURL = URL.createObjectURL(new Blob([code], {type:'text/javascript;charset=utf-8'}));
  }
  return classroomWorkerObjectURL;
}
"""
    app = app.replace("'use strict';", "'use strict';\n" + helper, 1)
    assets = {'.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png'}
    def image(match):
        attr, name = match.groups()
        file = STATIC / name
        encoded = b64encode(file.read_bytes()).decode('ascii')
        return '{}="data:{};base64,{}"'.format(attr, assets[file.suffix], encoded)
    page = re.sub(r'<link rel="stylesheet" href="style\.css(?:\?[^"]*)?">',
                  lambda _: '<style>\n'+style+'\n</style>', page)
    scripts = [url.split('?', 1)[0] for url in re.findall(r'<script defer src="([^"]+)"></script>', page)]
    page = re.sub(r' *<script defer src="[^"]+"></script>\n', '', page)
    page = re.sub(r'(src|href)="(assets/[^"]+)"', image, page)
    # The downloadable copy already contains the working classroom launcher.
    page = re.sub(r'\s*<p id="classroomDownload"[^>]*>.*?</p>', '', page, flags=re.DOTALL)
    result = ['<script type="text/plain" id="classroom-worker">\n'+worker+'\n</script>']
    for path in scripts:
        text = app if path == 'app.js' else (STATIC / path).read_text(encoding='utf-8')
        if '</script' in text.lower():
            raise ValueError('Unexpected HTML closing tag in '+path)
        result.append('<script>\n'+text+'\n</script>')
    return page.replace('</body>', '\n'.join(result)+'\n</body>').encode('utf-8')


def classroom_archive(page):
    data = BytesIO()
    items = [('index.html',page,0o644)] + [
        (name,(HERE / name).read_bytes(),0o755 if name.endswith('.command') else 0o644)
        for name in ['Start-Class.command','classroom.py','README.txt']
    ]
    # Fixed metadata yields identical ZIP files for identical inputs.
    with ZipFile(data,'w',compression=ZIP_DEFLATED,compresslevel=9) as archive:
        for name, contents, mode in items:
            info = ZipInfo('Rank-Lab-Classroom/'+name)
            info.create_system = 3
            info.external_attr = (0o100000 | mode) << 16
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, contents, compresslevel=9)
    return data.getvalue()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--html', type=Path, help='Also write the standalone page to this path')
    args = parser.parse_args()
    html = standalone_page()
    (STATIC/'Rank-Lab-Classroom.zip').write_bytes(classroom_archive(html))
    if args.html:
        args.html.write_bytes(html)

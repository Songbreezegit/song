from pathlib import Path
from PIL import Image
import json
source = Path('D:/code/PNG')
target = Path('public/assets')
manifest = {}
for path in source.rglob('*.png'):
    if 'page-preview' in path.name or '-button-' in path.name: continue
    im = Image.open(path).convert('RGBA')
    # Trim transparent padding only, preserving all nontransparent artwork.
    if 'background-grid' not in path.name:
        bounds = im.getbbox()
        if bounds: im = im.crop(bounds)
    limit = 1400 if 'hero' in path.name else 700
    im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    out = target / path.parent.name.lower() / (path.stem + '.webp')
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'WEBP', quality=92, method=6)
    manifest[path.stem] = {'src': '/' + out.as_posix().removeprefix('public/'), 'width': im.width, 'height': im.height}
Path('src/data/assets.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Prepared {len(manifest)} assets; source PNGs unchanged.')

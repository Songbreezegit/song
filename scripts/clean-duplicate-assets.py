from pathlib import Path
import hashlib
root = Path.cwd().resolve()
removed = 0
for p in (root/'public/assets').rglob('*.png'):
    original = Path('D:/code/PNG') / p.parent.name.capitalize() / p.name
    if original.exists() and hashlib.sha256(p.read_bytes()).digest() == hashlib.sha256(original.read_bytes()).digest():
        assert p.resolve().is_relative_to(root/'public/assets')
        p.unlink()
        removed += 1
print('Removed', removed, 'byte-identical old PNG copies; original design source retained.')
print('WebP delivery assets:', sum(p.stat().st_size for p in (root/'public/assets').rglob('*.webp')), 'bytes')

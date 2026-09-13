from pathlib import Path
import zipfile
root = Path.cwd().resolve()
obsolete = [*Path('src/pages').glob('*.tsx'), *map(Path, ['src/components/PageLoader.tsx','src/components/Hero.tsx','src/components/NowSection.tsx','src/components/ProjectVisual.tsx','src/components/Badge.tsx','src/components/PageTransition.tsx','src/components/SearchModal.tsx','src/components/ScrollToTop.tsx','src/components/Toast.tsx','src/components/Icons.tsx'])]
obsolete = [p for p in obsolete if p.exists()]
with zipfile.ZipFile('docs/legacy-components.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in obsolete:
        assert p.resolve().is_relative_to(root / 'src')
        archive.write(p, p.as_posix())
for p in obsolete: p.unlink()
print('Archived and removed from active source:', len(obsolete), 'obsolete components/pages.')

"""Package an already-built extension; needs Python 3, no third-party modules."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
manifest = json.loads((dist / 'manifest.json').read_text())
version = json.loads((root / 'package.json').read_text())['version']
if manifest['version'] != version:
    raise SystemExit('Manifest and package versions differ; run npm run build first.')
if manifest['manifest_version'] != 3 or not (dist / manifest['chrome_url_overrides']['newtab']).is_file():
    raise SystemExit('The MV3 new-tab build is incomplete.')
for icon in manifest['icons'].values():
    if not (dist / icon).is_file():
        raise SystemExit(f'Missing icon: {icon}')
archive_path = root / f'Boardmarks-v{version}.zip'
installation = f'Boardmarks {version}\n\n' + (root / 'docs' / 'INSTALL.md').read_text(encoding='utf-8')
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(dist.rglob('*')):
        if file.is_file() and file.name != '.DS_Store':
            archive.write(file, 'Boardmarks/' + file.relative_to(dist).as_posix())
    archive.writestr('Boardmarks/安裝說明.txt', installation)
with zipfile.ZipFile(archive_path) as archive:
    if archive.testzip() is not None:
        raise SystemExit('ZIP integrity check failed.')
digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
archive_path.with_suffix('.zip.sha256').write_text(f'{digest}  {archive_path.name}\n')
print(f'{archive_path.name}: {archive_path.stat().st_size:,} bytes; integrity verified')
print(f'SHA-256 {digest}')

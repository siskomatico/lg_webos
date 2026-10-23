#!/usr/bin/env python3
"""Package the two-screen launcher. Credentials never enter tracked UI sources."""
import argparse
import importlib.util
import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT / 'app'
APP_ID = 'org.kagev.inicio'
VERSION = '0.2.0'


def build(config_path=None):
    path = pathlib.Path(config_path) if config_path else ROOT / 'config.local.json'
    if not path.is_file():
        raise SystemExit('Copy config.example.json to config.local.json and configure your TMDB token first.')
    config = json.loads(path.read_text())
    if APP.exists():
        shutil.rmtree(APP)
    APP.mkdir()
    shutil.copytree(ROOT / 'ui', APP, dirs_exist_ok=True, ignore=shutil.ignore_patterns('icons.json', 'icons.local.json'))
    shutil.copy(ROOT / 'upstream/app/webOSTV.js', APP / 'webOSTV.js')
    (APP / 'private-config.js').write_text('window.INICIO_CONFIG = ' + json.dumps({
        'city': config.get('city', 'Valencia'),
        'lat': float(config.get('lat', 39.4699)),
        'lon': float(config.get('lon', -0.3763)),
        'tmdbKey': config.get('tmdbKey', '')
    }, ensure_ascii=False) + ';\n')
    (APP / 'private-config.js').chmod(0o600)
    icons = json.loads((ROOT / 'ui/icons.json').read_text())
    local_icons = ROOT / 'ui/icons.local.json'
    if local_icons.is_file():
        icons.update(json.loads(local_icons.read_text()))
    # Imported artwork remains local. Without it, webOS-provided icons/name fallbacks are used.
    icons = {key: value for key, value in icons.items()
             if (APP / value['icon']).is_file() or (ROOT / 'upstream/app' / value['icon']).is_file()}
    (APP / 'icons.js').write_text('window.INICIO_ICONS = ' + json.dumps(icons, ensure_ascii=False) + ';\n')
    info = json.loads((ROOT / 'upstream/app/appinfo.json').read_text())
    info.update(id=APP_ID, title='Inicio LG · Personalizado', version=VERSION,
                vendor='Personal local build', handlesRelaunch=False, disableBackHistoryAPI=True)
    (APP / 'appinfo.json').write_text(json.dumps(info, ensure_ascii=False, indent=2) + '\n')
    # Preserve the launcher icon referenced by upstream appinfo.json.
    shutil.copytree(ROOT / 'upstream/app/assets', APP / 'assets', dirs_exist_ok=True)
    licenses = APP / 'licenses'
    licenses.mkdir(exist_ok=True)
    for source, name in [(ROOT / 'LICENSE', 'Inicio-LG-MIT.txt'),
                         (ROOT / 'LICENSE.upstream', 'FreeMyTvWebOS-MIT.txt'),
                         (ROOT / 'upstream/app/LICENSE-webOSTV-Apache-2.0.txt', 'webOSTV-Apache-2.0.txt'),
                         (ROOT / 'NOTICES.md', 'NOTICES.md')]:
        shutil.copy(source, licenses / name)
    spec = importlib.util.spec_from_file_location('packager', ROOT / 'scripts/build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not module.build():
        raise SystemExit('Packaging failed')
    (ROOT / 'dist' / (APP_ID + '_' + VERSION + '_all.ipk')).chmod(0o600)
    print('Built private two-screen launcher:', APP_ID, VERSION)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', help='Path to a private JSON configuration file')
    args = parser.parse_args()
    build(args.config)

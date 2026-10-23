#!/usr/bin/env python3
"""Import app icons from your own rooted TV, without publishing them to Git.
Reads installed-app metadata and image files only. Does not install, launch,
remove or modify any TV application or system setting.
"""
import argparse
import io
import json
import pathlib
import re
import shlex
import subprocess
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True, help='TV IP address or hostname')
    parser.add_argument('--user', default='root', help='SSH user (default: root)')
    parser.add_argument('--key', help='SSH private-key path; otherwise use your SSH agent/config')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.:-]*', args.host):
        parser.error('Invalid hostname')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', args.user):
        parser.error('Invalid SSH user')
    ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']
    if args.key:
        ssh += ['-o', 'IdentitiesOnly=yes', '-i', str(pathlib.Path(args.key).expanduser())]
    destination = args.user + '@' + args.host
    raw = subprocess.check_output(ssh + ['-tt', destination,
        "luna-send -n 1 luna://com.webos.applicationManager/listApps '{}'"], timeout=25)
    reply = json.loads(raw.decode().strip())
    if reply.get('returnValue') is False or not isinstance(reply.get('apps'), list):
        raise SystemExit('The TV did not return an installed-app list.')
    paths, metadata = {}, {}
    for app in reply['apps']:
        app_id = app.get('id', '')
        if not re.fullmatch(r'[A-Za-z0-9._-]+', app_id):
            continue
        if app.get('visible') is False or app.get('isHidden'):
            continue
        icon = app.get('extraLargeIcon') or app.get('largeIcon') or app.get('icon')
        folder = app.get('folderPath', '')
        if not icon or '://' in icon:
            continue
        path = icon if icon.startswith('/') else folder.rstrip('/') + '/' + icon
        pure = pathlib.PurePosixPath(path)
        if '..' in pure.parts or not path.startswith(('/media/', '/usr/', '/mnt/')):
            continue
        suffix = pure.suffix.lower()
        if suffix not in ('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'):
            continue
        relative = 'icons/' + app_id + suffix
        paths[path.lstrip('/')] = (app_id, relative)
        metadata[app_id] = {'title': app.get('title', app_id), 'icon': relative,
                            'color': app.get('iconColor', '#24252b')}
    if not paths:
        raise SystemExit('No local app icons were found.')
    command = 'tar -cf - -C / ' + ' '.join(shlex.quote(p) for p in paths)
    result = subprocess.run(ssh + [destination, command], stdout=subprocess.PIPE, timeout=60)
    # tar can return nonzero for an individual missing icon; import only entries actually received.
    received = set()
    with tarfile.open(fileobj=io.BytesIO(result.stdout), mode='r:') as archive:
        for member in archive:
            if not member.isfile() or member.name not in paths or member.size > 5 * 1024 * 1024:
                continue
            app_id, relative = paths[member.name]
            destination_file = ROOT / 'ui' / relative
            destination_file.parent.mkdir(parents=True, exist_ok=True)
            destination_file.write_bytes(archive.extractfile(member).read())
            received.add(app_id)
    metadata = {k: v for k, v in metadata.items() if k in received}
    if not metadata:
        raise SystemExit('No usable icons received; check SSH access and TV file permissions.')
    if 'youtube.leanback.v4' in metadata:
        metadata['youtube.leanback.v4'].update(icon='assets/brands/youtube.svg', color='#ff0000', brand=True)
    index = ROOT / 'ui/icons.local.json'
    index.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    index.chmod(0o600)
    print('Imported', len(metadata), 'icons into ignored local files. Rebuild to use them.')
    print('Do not publish imported artwork without checking its original permissions.')


if __name__ == '__main__':
    main()

"""Icon-import tests: all SSH calls are mocked; no real TV is accessed."""
import importlib.util
import io
import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import tarfile


class ImportIconsTest(unittest.TestCase):
    def test_only_expected_images_are_written_locally(self):
        script = pathlib.Path(__file__).resolve().parents[1] / 'scripts/import_icons.py'
        spec = importlib.util.spec_from_file_location('icon_importer', script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        app_folder = '/media/developer/apps/usr/palm/applications/test.app'
        reply = {'returnValue': True, 'apps': [
            {'id': 'test.app', 'title': 'Test', 'folderPath': app_folder, 'icon': 'icon.png'},
            {'id': '../escape', 'folderPath': app_folder, 'icon': 'icon.png'},
            {'id': 'hidden.app', 'visible': False, 'folderPath': app_folder, 'icon': 'icon.png'},
            {'id': 'unsafe.app', 'folderPath': app_folder, 'icon': '../../../../etc/shadow.png'},
        ]}
        archive_data = io.BytesIO()
        with tarfile.open(fileobj=archive_data, mode='w:') as archive:
            for name in [(app_folder + '/icon.png').lstrip('/'), '../../escape.png']:
                data = b'test-image-placeholder'
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        with tempfile.TemporaryDirectory() as directory:
            module.ROOT = pathlib.Path(directory)
            with patch('sys.argv', ['import_icons.py', '--host', 'tv.example']), \
                 patch.object(module.subprocess, 'check_output', return_value=json.dumps(reply).encode()) as query, \
                 patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, archive_data.getvalue())) as download:
                module.main()
            index = json.loads((module.ROOT / 'ui/icons.local.json').read_text())
            self.assertEqual(list(index), ['test.app'])
            self.assertTrue((module.ROOT / 'ui/icons/test.app.png').is_file())
            self.assertFalse((module.ROOT / 'escape.png').exists())
            self.assertIn('listApps', query.call_args.args[0][-1])
            self.assertTrue(download.call_args.args[0][-1].startswith('tar -cf -'))
            self.assertNotIn('shadow', download.call_args.args[0][-1])


if __name__ == '__main__':
    unittest.main()

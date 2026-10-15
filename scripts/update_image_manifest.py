#!/usr/bin/env python3
"""Build the local image map from the saved recovery report and verified assets."""
import argparse
import json
import re
from pathlib import Path
from PIL import Image
from recover_images import ROOT, local_name, sources


def verified(path):
    if not path.is_file():
        return False
    try:
        with Image.open(path) as image:
            image.load()
        return True
    except (OSError, ValueError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    manifest = {}
    files = {p.name for p in (ROOT / 'public/images').iterdir() if verified(p)}
    variants = {}
    for name in sorted(files):
        match = re.match(r'^([a-f0-9]{30,})-', name)
        if match:
            with Image.open(ROOT / 'public/images' / name) as image:
                width = image.width
            asset = match[1]
            if width > variants.get(asset, (0, None))[0]:
                variants[asset] = (width, name)
    for url in dict.fromkeys([*sources(), *report]):
        result = report.get(url, {})
        name = local_name(url)
        candidates = [result.get('file'), name, name+'.jpg', name+'.png', name+'.gif', name+'.webp']
        file = next((n for n in candidates if n and n in files), None)
        if not file:
            match = re.match(r'^([a-f0-9]{30,})-', name)
            if match:
                file = variants.get(match[1], (0, None))[1]
        if file:
            manifest[url] = {'file': file}
        elif result.get('status') == 'unavailable':
            manifest[url] = {'file': None, 'status': 'unavailable'}
        else:
            manifest[url] = {'file': None, 'status': 'pending'}
    # Map invalid local files to their recovered replacements as well.
    for path in sorted((ROOT / 'public/images').iterdir()):
        if path.name not in files:
            matches = [entry for url, entry in manifest.items() if local_name(url) == path.stem]
            recovery = next((entry for entry in matches if entry['file']),
                            matches[0] if matches else {'file': None, 'status': 'pending'})
            manifest['../images/' + path.name] = recovery
            manifest['/images/' + path.name] = recovery
    destination = ROOT / 'src/data/archive-images.json'
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(dict(sorted(manifest.items())), indent=2) + '\n')
    print({'mapped': sum(bool(e['file']) for e in manifest.values()),
           'unavailable': sum(e.get('status') == 'unavailable' for e in manifest.values()),
           'pending': sum(e.get('status') == 'pending' for e in manifest.values())})


if __name__ == '__main__':
    main()

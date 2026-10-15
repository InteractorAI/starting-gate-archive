#!/usr/bin/env python3
"""Recover archived images as validated local assets; preserve a resumable report."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
IMAGE = re.compile(r'!\[[^\]]*\]\((https?://[^\s)]+)')
USER_AGENT = 'StartingGateArchive/1.0 (image preservation; https://startinggate.miamitech.ai)'


def image_extension(data):
    if data.startswith(b'\xff\xd8\xff'):
        return '.jpg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if data.startswith((b'GIF87a', b'GIF89a')):
        return '.gif'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return '.webp'
    return None


def valid_image(path):
    return path.is_file() and image_extension(path.read_bytes()) is not None


def sources():
    result = {}
    for article in sorted((ROOT / 'articles').glob('*.md')):
        for url in IMAGE.findall(article.read_text()):
            result.setdefault(url, []).append(article.name)
    # Include the three corrupt or empty assets discovered in the original archive.
    for path in sorted((ROOT / 'public/images').iterdir()):
        if not valid_image(path):
            name = path.stem
            url = f'https://web.archive.org/web/20250901im_/https://miamiherald.typepad.com/.a/{name}'
            result.setdefault(url, [])
    return result


def local_name(url):
    original = re.sub(r'^https?://web\.archive\.org/web/\d+[^/]*/', '', url)
    name = unquote(Path(urlparse(original).path).name)
    if not name or '/' in name or '\\' in name:
        name = hashlib.sha256(url.encode()).hexdigest()
    return name


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': USER_AGENT}), timeout=35) as response:
        # Never save an error page or an unbounded response as an image.
        data = response.read(20 * 1024 * 1024 + 1)
        if len(data) > 20 * 1024 * 1024:
            raise ValueError('Response exceeds the 20 MiB image limit')
        return data


def recover(url, output):
    original = re.sub(r'^https?://web\.archive\.org/web/\d+[^/]*/', '', url)
    attempts = [url]
    last_error = None
    for candidate in attempts:
        try:
            data = fetch(candidate)
            extension = image_extension(data)
            if not extension:
                raise ValueError('Response is not image data')
            # Pillow verifies the entire downloaded file, not just its MIME type.
            from PIL import Image
            import io
            with Image.open(io.BytesIO(data)) as image:
                image.verify()
            name = local_name(url)
            if not Path(name).suffix:
                name += extension
            target = output / name
            target.write_bytes(data)
            return {'status': 'recovered', 'file': name, 'source': candidate,
                    'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
        except HTTPError as error:
            if error.code == 429:
                return {'status': 'rate_limited', 'error': str(error)}
            last_error = str(error)
        except (URLError, TimeoutError, ValueError, OSError) as error:
            last_error = str(error)
        if len(attempts) == 1 and 'web.archive.org' in url:
            try:
                query = urlencode({'url': original})
                available = json.loads(fetch('https://archive.org/wayback/available?' + query))
                closest = available.get('archived_snapshots', {}).get('closest', {})
                if closest.get('available') and closest.get('status') == '200':
                    snapshot = closest['url'].replace('http://web.archive.org', 'https://web.archive.org')
                    snapshot = re.sub(r'(/web/\d+)(/)', r'\1im_\2', snapshot)
                    if snapshot != candidate:
                        attempts.append(snapshot)
            except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
                last_error += '; availability lookup: ' + str(error)
    return {'status': 'unavailable', 'error': last_error}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'recovery-downloads')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--delay', type=float, default=1.0)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    image_dir = args.output / 'images'
    image_dir.mkdir(exist_ok=True)
    report_path = args.output / 'report.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    attempted = 0
    for url, articles in sources().items():
        name = local_name(url)
        existing = next((p for p in (ROOT / 'public/images').glob(name + '*')
                         if p.name in (name, name+'.jpg', name+'.png', name+'.gif', name+'.webp')
                         and valid_image(p)), None)
        if existing:
            report[url] = {'status': 'existing', 'file': existing.name, 'articles': articles}
            continue
        prior = report.get(url, {})
        if prior.get('status') == 'recovered' and valid_image(image_dir / prior['file']):
            continue
        if args.limit and attempted >= args.limit:
            break
        attempted += 1
        result = recover(url, image_dir)
        report[url] = {**result, 'articles': articles}
        report_path.write_text(json.dumps(report, indent=2) + '\n')
        print(f'{attempted}: {result["status"]} {name}', flush=True)
        if result['status'] == 'rate_limited':
            print('Stopping at HTTP 429; report can be resumed after the rate limit clears.', flush=True)
            break
        time.sleep(max(0, args.delay))
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    from collections import Counter
    print(dict(Counter(r['status'] for r in report.values())), flush=True)


if __name__ == '__main__':
    main()

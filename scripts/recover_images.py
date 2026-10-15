#!/usr/bin/env python3
"""Recover archived images as validated local assets; preserve a resumable report."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import time
import threading
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse, urlencode
import requests

ROOT = Path(__file__).resolve().parents[1]
IMAGE = re.compile(r'!\[(?:[^\[\]]|\[[^\]]*\])*\]\((https?://[^\s)]+)')
USER_AGENT = 'StartingGateArchive/1.0 (image preservation; https://startinggate.miamitech.ai)'
FETCH_LOCK = threading.Lock()
NEXT_FETCH = 0
FETCH_DELAY = 0.5
RATE_LIMITED = threading.Event()
SESSIONS = threading.local()


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
    if not path.is_file() or image_extension(path.read_bytes()) is None:
        return False
    from PIL import Image
    try:
        with Image.open(path) as image:
            image.load()
        return True
    except (OSError, ValueError):
        return False


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
    global NEXT_FETCH
    with FETCH_LOCK:
        time.sleep(max(0, NEXT_FETCH - time.monotonic()))
        NEXT_FETCH = time.monotonic() + FETCH_DELAY
    if RATE_LIMITED.is_set():
        raise HTTPError(url, 429, 'Rate limit circuit is open', {}, None)
    if not hasattr(SESSIONS, 'session'):
        SESSIONS.session = requests.Session()
        SESSIONS.session.headers['User-Agent'] = USER_AGENT
    try:
        response = SESSIONS.session.get(url, timeout=(8, 25), stream=True)
    except requests.RequestException as error:
        raise URLError(str(error)) from error
    with response:
        if response.status_code >= 400:
            raise HTTPError(url, response.status_code, response.reason, response.headers, None)
        # Never save an error page or an unbounded response as an image.
        try:
            data = response.raw.read(20 * 1024 * 1024 + 1, decode_content=True)
        except Exception as error:
            raise URLError(str(error)) from error
        if len(data) > 20 * 1024 * 1024:
            raise ValueError('Response exceeds the 20 MiB image limit')
        return data


def closest_snapshot(original):
    query = urlencode({'url': original})
    available = json.loads(fetch('https://archive.org/wayback/available?' + query))
    closest = available.get('archived_snapshots', {}).get('closest', {})
    if closest.get('available') and closest.get('status') == '200':
        snapshot = closest['url'].replace('http://web.archive.org', 'https://web.archive.org')
        return re.sub(r'(/web/\d+)(/)', r'\1im_\2', snapshot)
    return None


def variant_snapshots(original):
    match = re.search(r'/([a-f0-9]{30,})-[^/]+$', urlparse(original).path)
    if not match:
        return
    asset = match[1]
    prefixes = [f'https://miamiherald.typepad.com/.a/{asset}']
    prefixes += [f'https://a{i}.typepad.com/{asset}' for i in range(8)]
    for prefix in prefixes:
        query = urlencode({'url': prefix, 'matchType': 'prefix', 'output': 'json',
                           'filter': 'statuscode:200', 'collapse': 'urlkey',
                           'fl': 'timestamp,original', 'limit': 50})
        rows = json.loads(fetch('https://web.archive.org/cdx/search/cdx?' + query))
        if not rows:
            continue
        # Prefer full-size originals and larger saved renditions of this exact asset.
        def score(row):
            size = re.search(r'-(\d+)wi', row[1])
            return 100000 if row[1].endswith('-pi') else int(size[1]) if size else 0
        for timestamp, source in sorted(rows[1:], key=score, reverse=True)[:8]:
            yield f'https://web.archive.org/web/{timestamp}im_/{source}'


def recover(url, output, try_original=False, try_variants=False, resolve_closest=True):
    original = re.sub(r'^https?://web\.archive\.org/web/\d+[^/]*/', '', url)
    attempts = [url]
    last_error = None
    transient = False
    if 'web.archive.org' in url and resolve_closest:
        try:
            snapshot = closest_snapshot(original)
            if snapshot:
                attempts = [snapshot]
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
            if isinstance(error, HTTPError) and error.code == 429:
                RATE_LIMITED.set()
                return {'status': 'rate_limited', 'error': str(error)}
    for candidate in attempts:
        try:
            data = fetch(candidate)
            extension = image_extension(data)
            if not extension:
                raise ValueError('Response is not image data')
            # Pillow verifies the entire downloaded file, not just its MIME type.
            from PIL import Image
            import io
            try:
                with Image.open(io.BytesIO(data)) as image:
                    image.load()
            except (OSError, ValueError) as error:
                raise ValueError('Downloaded image cannot be decoded: ' + str(error)) from error
            name = local_name(url)
            if not Path(name).suffix:
                name += extension
            target = output / name
            target.write_bytes(data)
            return {'status': 'recovered', 'file': name, 'source': candidate,
                    'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
        except HTTPError as error:
            if error.code == 429:
                RATE_LIMITED.set()
                return {'status': 'rate_limited', 'error': str(error)}
            last_error = str(error)
            transient = transient or error.code >= 500 or error.code == 408
        except (URLError, TimeoutError, OSError) as error:
            last_error = str(error)
            transient = True
        except ValueError as error:
            last_error = str(error)
        if len(attempts) == 1 and 'web.archive.org' in url and resolve_closest:
            try:
                snapshot = closest_snapshot(original)
                if snapshot and snapshot != candidate:
                    attempts.append(snapshot)
            except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
                last_error += '; availability lookup: ' + str(error)
                if isinstance(error, HTTPError) and error.code == 429:
                    RATE_LIMITED.set()
                    return {'status': 'rate_limited', 'error': last_error}
                transient = True
    if try_original and re.search(r'typepad\.com/\.a/[a-f0-9]+-\d+wi$', original):
        try:
            full_size = re.sub(r'-\d+wi$', '-pi', original)
            snapshot = closest_snapshot(full_size)
            if snapshot:
                result = recover(snapshot, output)
                if result['status'] in ('recovered', 'rate_limited'):
                    return result
                if result['status'] == 'retry_needed':
                    transient = True
                last_error += '; full-size original: ' + str(result.get('error'))
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
            last_error += '; original image lookup: ' + str(error)
            if isinstance(error, HTTPError) and error.code == 429:
                RATE_LIMITED.set()
                return {'status': 'rate_limited', 'error': last_error}
            transient = True
    if try_variants:
        try:
            for snapshot in variant_snapshots(original):
                result = recover(snapshot, output, resolve_closest=False)
                if result['status'] in ('recovered', 'rate_limited'):
                    return result
                if result['status'] == 'retry_needed':
                    transient = True
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as error:
            if isinstance(error, HTTPError) and error.code == 429:
                RATE_LIMITED.set()
                return {'status': 'rate_limited', 'error': str(error)}
            last_error += '; variant lookup: ' + str(error)
            transient = True
    return {'status': 'retry_needed' if transient else 'unavailable', 'error': last_error}


def recover_with_retry(url, output, try_original, try_variants):
    for attempt in range(1, 4):
        result = recover(url, output, try_original, try_variants)
        result['attempts'] = attempt
        if result['status'] != 'retry_needed':
            return result
        if attempt < 3:
            time.sleep(2 ** attempt)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'recovery-downloads')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--delay', type=float, default=0.5)
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--originals', action='store_true', help='Also try full-size Typepad originals')
    parser.add_argument('--variants', action='store_true', help='Search saved sizes and Typepad CDN aliases')
    parser.add_argument('--resume', type=Path, help='Seed the report from an earlier recovery pass')
    parser.add_argument('--shard', type=int, default=0)
    parser.add_argument('--shards', type=int, default=1)
    args = parser.parse_args()
    global FETCH_DELAY
    FETCH_DELAY = max(0.5, args.delay)
    args.output.mkdir(parents=True, exist_ok=True)
    image_dir = args.output / 'images'
    image_dir.mkdir(exist_ok=True)
    report_path = args.output / 'report.json'
    prior_report = report_path if report_path.exists() else args.resume
    report = json.loads(prior_report.read_text()) if prior_report else {}
    attempted = 0
    pending = []
    for position, (url, articles) in enumerate(sources().items()):
        if position % args.shards != args.shard:
            continue
        name = local_name(url)
        prior = report.get(url, {})
        prior_file = prior.get('file')
        if prior_file and Path(prior_file).name == prior_file and valid_image(ROOT / 'public/images' / prior_file):
            continue
        existing = next((p for p in (ROOT / 'public/images').glob(name + '*')
                         if p.name in (name, name+'.jpg', name+'.png', name+'.gif', name+'.webp')
                         and valid_image(p)), None)
        if existing:
            report[url] = {'status': 'existing', 'file': existing.name, 'articles': articles}
            continue
        if prior.get('status') == 'recovered' and valid_image(image_dir / prior['file']):
            continue
        if args.limit and attempted >= args.limit:
            break
        attempted += 1
        pending.append((url, articles))
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as executor:
        futures = {executor.submit(recover_with_retry, url, image_dir, args.originals, args.variants): (url, articles)
                   for url, articles in pending}
        completed = 0
        for future in as_completed(futures):
            if future.cancelled():
                continue
            url, articles = futures[future]
            result = future.result()
            report[url] = {**result, 'articles': articles,
                           'checked_at': datetime.now(timezone.utc).isoformat()}
            report_path.write_text(json.dumps(report, indent=2) + '\n')
            completed += 1
            print(f'{completed}/{len(pending)}: {result["status"]} {local_name(url)}', flush=True)
            if result['status'] == 'rate_limited':
                print('Stopping at HTTP 429; report can be resumed after the rate limit clears.', flush=True)
                for queued in futures:
                    queued.cancel()
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    from collections import Counter
    print(dict(Counter(r['status'] for r in report.values())), flush=True)


if __name__ == '__main__':
    main()

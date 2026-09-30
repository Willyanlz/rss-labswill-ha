"""RSS sensors: XML, gzip, HTML descriptions and optional article cover images."""
import concurrent.futures
import gzip
import html
from html.parser import HTMLParser
import json
import sys
from pathlib import Path
import urllib.request
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET

FEEDS = {
    # Feeds Regionais e Gerais
    'g1_araraquara': 'https://g1.globo.com/rss/g1/sp/sao-carlos-regiao/',
    'g1_mundo': 'https://g1.globo.com/rss/g1/mundo/',

    # Fontes adicionais podem ser definidas em /config/rss-feeds.json.
}

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip'})
    with urllib.request.urlopen(request, timeout=8) as response:
        data = response.read(5_000_000)
    return gzip.decompress(data) if data.startswith(b'\x1f\x8b') else data

class Content(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.image = ''
        self.cover = ''
        self.text = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'img' and not self.image:
            self.image = attrs.get('src') or attrs.get('data-src', '')
        if tag == 'meta' and attrs.get('property', attrs.get('name')) in ('og:image', 'twitter:image'):
            self.cover = self.cover or attrs.get('content', '')
    def handle_data(self, data):
        self.text.append(data)

def cover(article):
    if not article['link']:
        return article
    try:
        request = urllib.request.Request(article['link'], method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=5) as response:
            xfo = response.headers.get('X-Frame-Options', '').upper()
            csp = response.headers.get('Content-Security-Policy', '')
            ancestors = next((s.strip().split()[1:] for s in csp.split(';') if s.strip().startswith('frame-ancestors ')), [])
            article['embed_blocked'] = xfo in ('DENY', 'SAMEORIGIN') if not ancestors else ancestors in (["'none'"], ["'self'"])
    except Exception:
        pass  # Unknown policy: the card attempts embedding and offers a QR button.
    if article['image']:
        return article
    try:
        parser = Content()
        parser.feed(fetch(article['link']).decode('utf-8', errors='replace'))
        article['image'] = urljoin(article['link'], parser.cover) if parser.cover else ''
    except Exception:
        pass  # A missing cover must not discard the article.
    return article

def parse(data):
    root = ET.fromstring(data)
    articles = []
    for item in root.findall('.//item')[:20]:
        description = Content()
        description.feed(item.findtext('description', ''))
        content = Content()
        content.feed(item.findtext('{http://purl.org/rss/1.0/modules/content/}encoded', ''))
        image = ''
        for child in item.iter():
            tag = child.tag.split('}')[-1]
            if tag in ('thumbnail', 'content', 'enclosure') and child.get('url'):
                if tag != 'enclosure' or child.get('type', '').startswith('image/'):
                    image = child.get('url'); break
        link = item.findtext('link', '').strip()
        image = image or description.image or content.image
        articles.append({
            'title': html.unescape(item.findtext('title', '')).strip(),
            'link': link if urlparse(link).scheme in ('http', 'https') else '',
            'description': ' '.join(' '.join(description.text).split()),
            'pubDate': item.findtext('pubDate', '').strip(),
            'image': urljoin(link, image) if image else '',
        })
    return articles

if __name__ == '__main__':
    settings = Path('/config/rss-feeds.json')
    if settings.is_file():
        FEEDS.update(json.loads(settings.read_text(encoding='utf-8')))
    key = sys.argv[1]
    if key not in FEEDS:
        raise SystemExit(f'Feed {key!r} sem URL. Configure-o em /config/rss-feeds.json.')
    if not isinstance(FEEDS[key], str) or urlparse(FEEDS[key]).scheme not in ('https', 'http'):
        raise SystemExit(f'URL inválida para o feed {key!r}.')
    articles = parse(fetch(FEEDS[key]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        articles = list(pool.map(cover, articles))
    print(json.dumps({'articles': articles}, ensure_ascii=False))

"""Inspect public player metadata without downloading video or printing signed URLs."""
import gzip
import json
import re
import urllib.parse
import urllib.request
import zlib
from html.parser import HTMLParser

PAGE = "https://rezka.ag/films/fantasy/85038-odisseya-2026-latest.html"

class PlayerHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.iframes = []
        self.scripts = []
        self.videos = 0
        self.sources = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        src = attrs.get("src", "")
        if tag == "video":
            self.videos += 1
        if src and tag in ("iframe", "script", "source", "video"):
            url = urllib.parse.urlsplit(urllib.parse.urljoin(PAGE, src))
            value = {"host": url.netloc, "path": url.path[:150]}
            if tag == "iframe": self.iframes.append(value)
            elif tag == "script": self.scripts.append(value)
            else: self.sources.append({"host": url.netloc})

request = urllib.request.Request(PAGE, headers={"User-Agent": "RezkaTVLite/0.1 compatibility-check"})
with urllib.request.urlopen(request, timeout=20) as response:
    body = response.read(1048577)
    if len(body) > 1048576:
        raise ValueError("Response too large")
    encoding = response.headers.get("Content-Encoding", "").lower()
    if encoding == "gzip": body = gzip.decompress(body)
    elif encoding == "deflate": body = zlib.decompress(body)
    if len(body) > 4194304:
        raise ValueError("Decoded response too large")
    html = body.decode("utf-8", errors="replace")
    status = response.status
parser = PlayerHTML()
parser.feed(html)
title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
inits = []
for match in re.finditer(r"initCDN(?:Movies|Series)Events\(", html):
    chunk = html[match.start():match.start()+100000]
    first_object = chunk.find("{")
    info = {"function": match.group(0)[:-1]}
    if first_object >= 0:
        try:
            config, _ = json.JSONDecoder().raw_decode(chunk[first_object:])
            info["keys"] = list(config) if isinstance(config, dict) else []
            if isinstance(config, dict):
                streams = config.get("streams")
                info["streams_type"] = type(streams).__name__
                info["streams_length"] = len(streams) if isinstance(streams, str) else 0
                info["default_quality"] = config.get("default_quality")
        except (ValueError, TypeError):
            info["config_parseable"] = False
    inits.append(info)
texts = []
for match in re.finditer(r"(?:еще не вышел|ещё не вышел|трейлер|Трейлер|дата выхода|Дата выхода)", html):
    snippet = re.sub(r"<[^>]*>", " ", html[max(0, match.start()-80):match.end()+180])
    snippet = re.sub(r"\s+", " ", snippet).strip()
    if snippet and len(texts) < 6: texts.append(snippet[:220])
print("PLAYER_REPORT=" + json.dumps({
    "status": status,
    "title": title.group(1)[:220] if title else None,
    "iframe_sources": parser.iframes[:6],
    "video_tags": parser.videos,
    "media_source_hosts": parser.sources[:6],
    "player_initializers": inits,
    "script_sources": parser.scripts[-12:],
    "availability_hints": texts,
}, ensure_ascii=False, separators=(",", ":")))

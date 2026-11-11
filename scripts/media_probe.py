"""Inspect public player metadata without downloading video or printing signed URLs."""
import gzip
import json
import re
import urllib.error
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
    args = re.match(r"initCDNMoviesEvents\(\s*(\d+)\s*,\s*(\d+)", chunk)
    info["numeric_arguments"] = [int(x) for x in args.groups()] if args else []
    restricted = re.search(r'class="b-player__restricted__block_message"[^>]*>(.*?)</div>', html, re.S)
    if restricted:
        info["restriction_message"] = re.sub(r"<[^>]*>", " ", restricted.group(1)).strip()[:220]
    if args and not restricted:
        form = urllib.parse.urlencode({
            "id": args.group(1), "translator_id": args.group(2),
            "is_camrip": "0", "is_ads": "0", "is_director": "0", "action": "get_movie"
        }).encode()
        ajax_request = urllib.request.Request(
            "https://rezka.ag/ajax/get_cdn_series/", data=form,
            headers={"User-Agent": "RezkaTVLite/0.1 compatibility-check", "Referer": PAGE,
                     "X-Requested-With": "XMLHttpRequest",
                     "Content-Type": "application/x-www-form-urlencoded"}
        )
        try:
            with urllib.request.urlopen(ajax_request, timeout=20) as ajax_response:
                ajax_body = ajax_response.read(262144)
                if ajax_response.headers.get("Content-Encoding") == "gzip":
                    ajax_body = gzip.decompress(ajax_body)
                payload = json.loads(ajax_body)
                info["ajax_status"] = ajax_response.status
                info["ajax_keys"] = list(payload)
                info["ajax_success"] = payload.get("success")
                value = payload.get("url")
                info["ajax_url_type"] = type(value).__name__
                info["ajax_url_length"] = len(value) if isinstance(value, str) else 0
                if isinstance(value, str):
                    info["ajax_url_kind"] = "encoded" if value.startswith("#") else ("http" if value.startswith("http") else "other")
                error = payload.get("message") or payload.get("error")
                if error:
                    info["ajax_message"] = re.sub(r"https?://\S+", "[url]", str(error))[:160]
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            info["ajax_error"] = type(error).__name__
    if first_object >= 0:
        try:
            config, _ = json.JSONDecoder().raw_decode(chunk[first_object:])
            info["keys"] = list(config) if isinstance(config, dict) else []
            if isinstance(config, dict):
                streams = config.get("streams")
                info["streams_type"] = type(streams).__name__
                info["streams_length"] = len(streams) if isinstance(streams, str) else 0
                info["default_quality"] = config.get("default_quality")
                for key in ("url", "quality"):
                    value = config.get(key)
                    info[key + "_type"] = type(value).__name__
                    if isinstance(value, str):
                        info[key + "_length"] = len(value)
                        info[key + "_prefix_kind"] = "http" if value.startswith(("http://", "https://")) else ("encoded" if value.startswith("#") else "other")
                        if key == "url" and value.startswith(("http://", "https://")):
                            source = urllib.parse.urlsplit(value)
                            info["media_host"] = source.netloc
                            info["media_path_suffix"] = source.path.rsplit("/", 1)[-1][-20:]
                            info["media_has_query"] = bool(source.query)
                            media_request = urllib.request.Request(value, method="HEAD", headers={"Origin": "https://stevenris.github.io"})
                            try:
                                with urllib.request.urlopen(media_request, timeout=15) as media_response:
                                    info["media_status"] = media_response.status
                                    info["media_content_type"] = media_response.headers.get("Content-Type")
                                    info["media_allow_origin"] = media_response.headers.get("Access-Control-Allow-Origin")
                                    info["media_accept_ranges"] = media_response.headers.get("Accept-Ranges")
                                    info["media_content_length"] = media_response.headers.get("Content-Length")
                            except (urllib.error.URLError, TimeoutError) as error:
                                info["media_request_error"] = type(error).__name__
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

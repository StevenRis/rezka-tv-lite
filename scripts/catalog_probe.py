"""Fetch one public catalog page; emit bounded metadata, never video URLs or cookies."""
import gzip
import json
import urllib.parse
import urllib.request
import zlib
from datetime import datetime, timezone
from html.parser import HTMLParser

ORIGIN = "https://rezka.ag/"


class CatalogParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.card_depth = self.link_depth = self.misc_depth = None
        self.in_title = False
        self.card = None
        self.items = []
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "div":
            self.depth += 1
            if "b-content__inline_item" in classes and self.card is None:
                self.card_depth = self.depth
                self.card = {"title": "", "details": "", "url": attrs.get("data-url", "")}
            if self.card is not None:
                if "b-content__inline_item-link" in classes:
                    self.link_depth = self.depth
                if "misc" in classes:
                    self.misc_depth = self.depth
        if tag == "a" and self.card is not None and self.link_depth is not None:
            self.in_title = True
            if not self.card["url"]:
                self.card["url"] = attrs.get("href", "")

    def handle_data(self, data):
        if self.card is not None:
            if self.in_title:
                self.card["title"] += data
            elif self.misc_depth is not None:
                self.card["details"] += data

    def handle_endtag(self, tag):
        if tag == "a":
            self.in_title = False
        if tag != "div":
            return
        if self.card is not None:
            if self.depth == self.card_depth:
                self.finish_card()
            if self.depth == self.link_depth:
                self.link_depth = None
            if self.depth == self.misc_depth:
                self.misc_depth = None
        self.depth = max(0, self.depth - 1)

    def finish_card(self):
        card, self.card = self.card, None
        self.card_depth = self.link_depth = self.misc_depth = None
        self.in_title = False
        card["title"] = " ".join(card["title"].split())[:150]
        card["details"] = " ".join(card["details"].split())[:160]
        card["url"] = urllib.parse.urljoin(ORIGIN, card["url"])
        url = urllib.parse.urlsplit(card["url"])
        if (card["title"] and url.scheme == "https" and url.netloc == "rezka.ag"
                and url.path.endswith(".html") and not url.query and not url.fragment
                and card["url"] not in self.urls and len(self.items) < 24):
            self.urls.add(card["url"])
            self.items.append(card)


def fetch_catalog():
    request = urllib.request.Request(ORIGIN, headers={
        "User-Agent": "RezkaTVLite/0.1 compatibility-check",
        "Origin": "https://stevenris.github.io",
    })
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200 or urllib.parse.urlsplit(response.geturl()).netloc != "rezka.ag":
            raise ValueError("Unexpected upstream status or domain")
        body = response.read(1048577)
        if len(body) > 1048576:
            raise ValueError("Response exceeds 1 MiB compressed limit")
        encoding = response.headers.get("Content-Encoding", "").lower()
        if encoding == "gzip":
            body = gzip.decompress(body)
        elif encoding == "deflate":
            body = zlib.decompress(body)
        elif encoding not in ("", "identity"):
            raise ValueError("Unsupported response encoding")
    if len(body) > 4194304:
        raise ValueError("Response exceeds decoded limit")
    parser = CatalogParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    if len(parser.items) < 6:
        raise ValueError("Catalog not recognized; no snapshot was produced")
    return {"schema": 1, "source": ORIGIN,
            "generated_at": datetime.now(timezone.utc).isoformat(), "items": parser.items}


if __name__ == "__main__":
    print("CATALOG_JSON=" + json.dumps(fetch_catalog(), ensure_ascii=False, separators=(",", ":")))

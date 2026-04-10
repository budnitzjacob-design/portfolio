#!/usr/bin/env python3
"""
Local dev server for jacobbudnitz.com
Usage: python3 server.py
Then open: http://localhost:8080/admin.html
"""
import http.server
import json
import sys
from pathlib import Path

PORT = 8080
SITE_DIR = Path(__file__).resolve().parent
RESEARCH_FILE = SITE_DIR / "research.html"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIR), **kwargs)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/save-research":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length)
                data = json.loads(body)
                html = data.get("html", "")
                if not html.strip():
                    raise ValueError("Empty HTML — not saving")
                # Backup original
                backup = SITE_DIR / "research.html.bak"
                if RESEARCH_FILE.exists():
                    backup.write_text(RESEARCH_FILE.read_text(encoding="utf-8"), encoding="utf-8")
                RESEARCH_FILE.write_text(html, encoding="utf-8")
                print(f"[✓] Saved research.html ({len(html)} bytes). Backup → research.html.bak")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._cors()
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception as e:
                print(f"[✗] Save error: {e}", file=sys.stderr)
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        # Suppress static file noise; only show errors
        if args and str(args[1]) not in ("200", "304"):
            print(f"  {fmt % args}")


if __name__ == "__main__":
    print(f"╔══════════════════════════════════════════╗")
    print(f"║  Jacob Budnitz — Portfolio Dev Server    ║")
    print(f"╠══════════════════════════════════════════╣")
    print(f"║  Site:   http://localhost:{PORT}            ║")
    print(f"║  Editor: http://localhost:{PORT}/admin.html ║")
    print(f"╚══════════════════════════════════════════╝")
    print()
    with http.server.HTTPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[server stopped]")

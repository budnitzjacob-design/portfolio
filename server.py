#!/usr/bin/env python3
"""
Local dev server for jacobbudnitz.com
Usage: python3 server.py
Then open: http://localhost:8080/admin.html

Saving in the editor writes research.html locally AND pushes to GitHub
so jacobbudnitz.com updates within ~30s of clicking save.
"""
import http.server
import json
import subprocess
import sys
from pathlib import Path

PORT = 8080
SITE_DIR = Path(__file__).resolve().parent
RESEARCH_FILE = SITE_DIR / "research.html"


def git(*args):
    return subprocess.run(
        ["git", *args],
        cwd=SITE_DIR,
        capture_output=True,
        text=True,
        check=False,
    )


def deploy_research():
    """Commit research.html and push to origin. Returns (ok, message)."""
    status = git("status", "--porcelain", "research.html")
    if not status.stdout.strip():
        return True, "no changes to deploy"
    add = git("add", "research.html")
    if add.returncode != 0:
        return False, f"git add: {add.stderr.strip()}"
    commit = git("commit", "-m", "CV update via admin editor")
    if commit.returncode != 0:
        return False, f"git commit: {commit.stderr.strip() or commit.stdout.strip()}"
    push = git("push", "origin", "main")
    if push.returncode != 0:
        return False, f"git push: {push.stderr.strip() or push.stdout.strip()}"
    return True, "pushed to origin/main"


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
                backup = SITE_DIR / "research.html.bak"
                if RESEARCH_FILE.exists():
                    backup.write_text(RESEARCH_FILE.read_text(encoding="utf-8"), encoding="utf-8")
                RESEARCH_FILE.write_text(html, encoding="utf-8")
                print(f"[✓] Saved research.html ({len(html)} bytes). Backup → research.html.bak")

                deployed, msg = deploy_research()
                if deployed:
                    print(f"[✓] Deploy: {msg}")
                else:
                    print(f"[!] Deploy failed: {msg}", file=sys.stderr)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._cors()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": True,
                    "deployed": deployed,
                    "deploy_message": msg,
                }).encode())
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
        if args and str(args[1]) not in ("200", "304"):
            print(f"  {fmt % args}")


if __name__ == "__main__":
    print(f"╔══════════════════════════════════════════╗")
    print(f"║  Jacob Budnitz — Portfolio Dev Server    ║")
    print(f"╠══════════════════════════════════════════╣")
    print(f"║  Site:   http://localhost:{PORT}            ║")
    print(f"║  Editor: http://localhost:{PORT}/admin.html ║")
    print(f"║  Save in editor → auto-deploys to live   ║")
    print(f"╚══════════════════════════════════════════╝")
    print()
    with http.server.HTTPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[server stopped]")

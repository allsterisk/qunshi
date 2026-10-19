"""Local development server. Run: python server/main.py"""
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from extractor import ExtractionError, extract


def load_env():
    path = Path(__file__).resolve().parents[1] / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(90)

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path != "/health":
            return self.send_json(404, {"error": "接口不存在。"})
        self.send_json(200, {"ok": True, "mode": "ai" if os.environ.get("AI_API_KEY") and os.environ.get("AI_MODEL") else "rules"})

    def do_POST(self):
        if self.path != "/api/extract":
            return self.send_json(404, {"error": "接口不存在。"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 12 * 1024 * 1024:
                return self.send_json(413, {"error": "请求为空或过大；最多4张截图，每张2MB。"})
            if not self.headers.get("Content-Type", "").startswith("application/json"):
                return self.send_json(415, {"error": "请使用 JSON 请求。"})
            payload = json.loads(self.rfile.read(length))
            result = extract(payload)
            self.send_json(200, result)
        except (ValueError, UnicodeDecodeError):
            self.send_json(400, {"error": "请求数据格式不正确。"})
        except ExtractionError as error:
            self.send_json(422, {"error": str(error)})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.send_json(500, {"error": "服务出现异常，请重试。"})

    def log_message(self, fmt, *args):
        # Never log notification text, screenshots, credentials or request bodies.
        super().log_message(fmt, *args)


if __name__ == "__main__":
    load_env()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8787"))
    print(f"Qunshi development server: http://{host}:{port}", flush=True)
    print("Local development only. Do not expose this unauthenticated server to the internet.", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()

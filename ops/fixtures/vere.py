#!/usr/bin/env python3
"""Test fixture only. Not a Vere implementation and never a real ship."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import os
from pathlib import Path
import signal
import socket
import sys
import threading

parser = argparse.ArgumentParser()
parser.add_argument("--loom")
parser.add_argument("--http-port", type=int)
parser.add_argument("--ames-port", type=int)
parser.add_argument("--http-ip")
parser.add_argument("--name")
parser.add_argument("--key-file")
parser.add_argument("-t", action="store_true")
parser.add_argument("pier", type=Path)
args = parser.parse_args()
args.pier.mkdir(exist_ok=True)
(args.pier / ".vere.lock").write_text(str(os.getpid()))
(args.pier / ".http.ports").write_text(f"{args.http_port} insecure public\n")
name = args.name or args.pier.name
if args.key_file:
    print(Path(args.key_file).read_text().strip(), flush=True)
print("~lidlut-tabwed-pillex-ridrup", flush=True)
print("Set-Cookie: urbauth-test=secret-cookie", flush=True)
print("fixture boot " + ("new" if args.name else "existing"), flush=True)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = ("~" + name).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class Server(HTTPServer):
    allow_reuse_address = True


server = Server(("127.0.0.1", args.http_port), Handler)
local = Server(("127.0.0.1", 0), Handler)
(args.pier / ".http.ports").write_text(f"{args.http_port} insecure public\n{local.server_port} insecure loopback\n")
def post(self):
    request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
    command = request["source"]["dojo"]
    (args.pier / "last-command").write_text(command)
    body = json.dumps("fixture command output").encode()
    self.send_response(200)
    self.send_header("Content-Length", str(len(body)))
    self.end_headers()
    self.wfile.write(body)
    if command == "+hood/exit" and request["sink"] == {"app": "hood"}:
        threading.Thread(target=server.shutdown).start()
Handler.do_POST = post
threading.Thread(target=local.serve_forever, daemon=True).start()
udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
udp.bind(("0.0.0.0", args.ames_port))
def stop(_sig, _frame):
    threading.Thread(target=server.shutdown).start()
signal.signal(signal.SIGTERM, stop)
try:
    server.serve_forever(poll_interval=0.05)
finally:
    server.server_close()
    local.shutdown()
    local.server_close()
    udp.close()
    (args.pier / ".vere.lock").unlink()
    print("fixture graceful shutdown", flush=True)

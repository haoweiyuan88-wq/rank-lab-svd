"""Share the bundled SVD lab from the classroom computer. Uses the Python standard library."""

import argparse
import errno
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from ipaddress import IPv4Address
import platform
from pathlib import Path
import re
import shutil
import socket
import subprocess
import threading
from urllib.parse import urlsplit
import webbrowser


def command_output(program, *args):
    if not shutil.which(program):
        return ''
    try:
        return subprocess.run([program, *args], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              text=True, timeout=3, check=False).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return ''


def mac_network_addresses():
    ports = command_output('networksetup', '-listallhardwareports')
    pairs = re.findall(r'Hardware Port: ([^\n]+)\nDevice: ([^\n]+)', ports)
    # A working Wi-Fi interface should win over a virtual adapter or tunnel.
    pairs.sort(key=lambda pair: 0 if re.search(r'wi-?fi|airport|wireless', pair[0], re.I) else 1)
    for name, interface in pairs:
        if re.search(r'wi-?fi|airport|wireless|ethernet|lan', name, re.I):
            yield command_output('ipconfig', 'getifaddr', interface.strip())


def possible_addresses():
    if platform.system() == 'Darwin':
        yield from mac_network_addresses()
    # A UDP connect performs a routing lookup. No payload is sent.
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
            route.connect(('192.0.2.1', 9))
            yield route.getsockname()[0]
    except OSError:
        pass
    try:
        for row in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET, socket.SOCK_STREAM):
            yield row[4][0]
    except OSError:
        pass


def wifi_address():
    for value in possible_addresses():
        try:
            address = IPv4Address(value)
        except ValueError:
            continue
        if address.is_loopback or address.is_unspecified or address.is_multicast or address.is_link_local:
            continue
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.bind((str(address), 0))
        except OSError:
            continue
        return str(address)
    raise RuntimeError('未找到可用的 Wi-Fi 地址。请先连接课堂 Wi-Fi 或个人热点，再重新启动。')


def handler_for(page):
    # Only the bundled HTML is available to the classroom. There is no listing or upload endpoint.
    class ClassroomHandler(BaseHTTPRequestHandler):
        def send_lab(self, body):
            path = urlsplit(self.path).path
            if path not in ('/', '/index.html'):
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(page)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            if body:
                try:
                    self.wfile.write(page)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        def do_GET(self):
            self.send_lab(True)

        def do_HEAD(self):
            self.send_lab(False)

        def log_message(self, *args):
            pass

    return ClassroomHandler


class ClassroomHTTPServer(ThreadingHTTPServer):
    # A roomful of phones may scan the same slide at once.
    request_queue_size = 64


def classroom_server(address, port, page):
    handler = handler_for(page)
    requested_port = 8765 if port is None else port
    try:
        return ClassroomHTTPServer((address, requested_port), handler)
    except OSError as error:
        if port is None and error.errno == errno.EADDRINUSE:
            return ClassroomHTTPServer((address, 0), handler)
        raise


def main():
    parser = argparse.ArgumentParser(description='在课堂电脑的 Wi-Fi 地址上启动 SVD 实验室')
    parser.add_argument('--address', metavar='IPv4', help='指定本机的 Wi-Fi IPv4 地址')
    parser.add_argument('--port', type=int, help='监听端口，默认优先使用 8765')
    parser.add_argument('--no-browser', action='store_true', help='只打印课堂网址')
    options = parser.parse_args()
    try:
        address = str(IPv4Address(options.address)) if options.address else wifi_address()
        ip = IPv4Address(address)
        if ip.is_loopback or ip.is_unspecified or ip.is_multicast:
            raise ValueError('请使用本机的 Wi-Fi IPv4 地址。')
        if options.port is not None and not 0 <= options.port <= 65535:
            raise ValueError('端口应在 0 到 65535 之间。')
        folder = Path(__file__).resolve().parent
        page_path = folder/'index.html'
        if not page_path.is_file():
            page_path = folder/'Rank-Lab-SVD.html'
        page = page_path.read_bytes()
        with classroom_server(address, options.port, page) as server:
            base = 'http://{}:{}/'.format(*server.server_address[:2])
            print('\n学生访问  ' + base, flush=True)
            print('投影二维码  ' + base + '?present=1', flush=True)
            print('请先让手机加入与电脑相同、允许设备互访的 Wi-Fi。')
            print('请保持此窗口开启。下课后按 Control+C 结束。\n', flush=True)
            if not options.no_browser:
                opener = threading.Timer(0.2, webbrowser.open, (base + '?present=1',))
                opener.daemon = True
                opener.start()
            server.serve_forever()
    except KeyboardInterrupt:
        print('\n课堂分享已结束。')
    except (ValueError, OSError, RuntimeError) as error:
        print('课堂服务未能启动：{}'.format(error))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

import argparse
import subprocess
import os
import shutil
import sys
import socket
    
CONSUL_ADDR = "127.30.0.4"
CONSUL_PORT = 8500
CONSUL_VERSION = "1.16.0"
CONSUL_ZIP = f"consul_{CONSUL_VERSION}_windows_amd64.zip"
CONSUL_URL = f"https://releases.hashicorp.com/consul/{CONSUL_VERSION}/{CONSUL_ZIP}"

def is_port_in_use(addr, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((addr, port)) == 0

def start_consul(force_restart=False):
    consul_path = shutil.which("consul")
    if not consul_path:
        print("Consul not found. Downloading...")
        subprocess.run(["curl", "-O", CONSUL_URL], check=True)
        subprocess.run(["tar", "-xvf", CONSUL_ZIP, "-C", "."], check=True)
        consul_path = os.path.abspath("consul")

    if is_port_in_use(CONSUL_ADDR, CONSUL_PORT):
        if force_restart:
            print("Killing existing Consul...")
            subprocess.run(["pkill", "-f", "consul"], check=False)
        else:
            print(f"Consul already running on {CONSUL_ADDR}:{CONSUL_PORT}.")
            return

    print(f"Starting Consul on {CONSUL_ADDR}:{CONSUL_PORT}...")
    consul_process=subprocess.Popen(
        [consul_path, "agent", "-dev", f"-client={CONSUL_ADDR}"],
        stdout=sys.
        stdout, stderr=sys.stderr
    )
    consul_process.wait()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--restart", action="store_true", help="Restart consul if already running")
    args = parser.parse_args()
    print("run start consul")
    start_consul(force_restart=args.restart)

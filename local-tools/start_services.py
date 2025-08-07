import subprocess
import os
import shutil
import socket
import sys
from pathlib import Path

tunnel_processes = []
consul_process = None

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0

def manage_consul():
    global consul_process
    consul_path = shutil.which("consul")
    if not consul_path:
        print("Consul not found. Downloading...")
        download_url = "https://releases.hashicorp.com/consul/1.16.0/consul_1.16.0_windows_amd64.zip"
        subprocess.run(["curl", "-O", download_url], check=True)
        subprocess.run(["tar", "-xvf", "consul_1.16.0_windows_amd64.zip", "-C", "."], check=True)
        consul_path = os.path.abspath("consul")
        print("Consul downloaded and extracted.")

    if is_port_in_use(8500):
        print("Consul is already listening on port 8500.")
    else:
        print("Starting Consul in developer mode...")
        consul_process = subprocess.Popen(
            [consul_path, "agent", "-dev"],
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        print(f"Consul started (PID: {consul_process.pid}).")

def start_tunnel(cmd):
    proc = subprocess.Popen(cmd)
    tunnel_processes.append(proc)
    print(f"Started tunnel: {' '.join(cmd)} (PID: {proc.pid})")

def stop_services():
    print("\nStopping services...")
    if consul_process and consul_process.poll() is None:
        print(f"Terminating Consul (PID: {consul_process.pid})...")
        consul_process.terminate()
        try:
            consul_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            consul_process.kill()
        print("Consul stopped.")

    for proc in tunnel_processes:
        if proc.poll() is None:
            print(f"Terminating tunnel (PID: {proc.pid})...")
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            print(f"Tunnel PID {proc.pid} stopped.")

    print("All services stopped, exiting.")

if __name__ == "__main__":
    try:
        manage_consul()

        # Launch tunnels
        start_tunnel(["ssh", "-N", "-L", "7474:localhost:7474", "-L", "7687:localhost:7687", "graph"])
        start_tunnel(["ssh", "-N", "-L", "5432:localhost:5432", "confidential-properties"])
        start_tunnel(["ssh", "-N", "-L", "15432:127.0.10.2:5432", "third-party"])

        print("\n✅ All services and tunnels started. Waiting until a tunnel exits or Ctrl+C.")

        # Passive waiting: block until any tunnel process exits
        for proc in tunnel_processes:
            exit_code = proc.wait()  # blocking wait, 0% CPU usage :contentReference[oaicite:1]{index=1}
            print(f"Tunnel PID {proc.pid} exited (code {exit_code}). Shutting down all services.")
            break

    except KeyboardInterrupt:
        print("\nInterrupted by user (Ctrl+C).")
    except Exception as err:
        print(f"Unexpected error: {err}")
    finally:
        stop_services()
        sys.exit(0)

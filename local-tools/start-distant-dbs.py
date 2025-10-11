import subprocess
import sys

tunnel_processes = []

def start_tunnel(cmd):
    proc = subprocess.Popen(cmd)
    tunnel_processes.append(proc)
    print(f"Started tunnel: {' '.join(cmd)} (PID: {proc.pid})")


def stop_services():
    print("\nStopping tunnels...")
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
       # Launch tunnels
        start_tunnel(["ssh", "-N", "-L", "7474:localhost:7474", "-L", "7687:localhost:7687", "graph"])
        start_tunnel(["ssh", "-N", "-L", "5432:localhost:5432", "confidential-properties"])
        start_tunnel(["ssh", "-N", "-L", "15432:127.0.10.2:5432", "third-party"])

        print("Waiting until a tunnel exits or Ctrl+C.")

        # Passive waiting: block until any tunnel process exits
        for proc in tunnel_processes:
            exit_code = proc.wait()
            print(f"Tunnel PID {proc.pid} exited (code {exit_code}). Shutting down all services.")
            break

    except KeyboardInterrupt:
        print("\nInterrupted by user (Ctrl+C).")
    except Exception as err:
        print(f"Unexpected error: {err}")
    finally:
        stop_services()
        sys.exit(0)

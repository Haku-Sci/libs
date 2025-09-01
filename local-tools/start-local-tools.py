import argparse
import subprocess
import sys
from pathlib import Path
import os, sys

#if os.getenv("LAUNCHED_UNDER_DEBUG") == "1":
#    sys.exit(0)
#os.environ["LAUNCHED_UNDER_DEBUG"] = "1"

ROOT = Path(__file__).parent

def run_script(script_path, *args):
    cmd = [sys.executable, str(script_path), *args]
    return subprocess.Popen(cmd)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--restart-consul", action="store_true")
    parser.add_argument("containers", nargs="+", help="Containers to launch")
    args = parser.parse_args()

    # Start consul
    run_script(ROOT / "consul" / "start-consul.py",
               *(["--restart"] if args.restart_consul else []))

    # Start each container
    for cname in args.containers:
        run_script(ROOT / "containers" / "start-container.py", cname)

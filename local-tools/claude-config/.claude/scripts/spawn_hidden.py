"""Start a long-running command in the background with no window, print its pid.

On Windows the process gets its own hidden console (CREATE_NO_WINDOW), which every child it
spawns inherits: no console window opens, and it outlives the shell that started it.
Usage: python -I spawn_hidden.py --log <file> --cwd <dir> -- <command line>
"""
import argparse
import os
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--log", required=True)
parser.add_argument("--cwd", required=True)
parser.add_argument("command", nargs=argparse.REMAINDER)
args = parser.parse_args()
command = " ".join(args.command[1:] if args.command[:1] == ["--"] else args.command)
if not command:
    sys.exit("missing command")

log = open(args.log, "ab")
if os.name == "nt":
    options = {"creationflags": subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP}
else:
    options = {"start_new_session": True}
process = subprocess.Popen(command, cwd=args.cwd, shell=True, stdin=subprocess.DEVNULL, stdout=log, stderr=log, **options)
print(process.pid)

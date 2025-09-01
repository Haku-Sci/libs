import argparse
import json
import subprocess
import time
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "containers.json"

def check_container_status(container_name):
    result = subprocess.run(
        ["docker", "ps", "-a", "-q", "-f", f"name=^{container_name}$"],
        stdout=subprocess.PIPE, text=True
    )
    return result.stdout.strip() != ""

def is_container_running(container_name):
    result = subprocess.run(
        ["docker", "ps", "-q", "-f", f"name=^{container_name}$"],
        stdout=subprocess.PIPE, text=True
    )
    return result.stdout.strip() != ""

def stop_container(container_name, timeout=10):
    subprocess.run(["docker", "stop", container_name], check=False)
    for _ in range(timeout):
        if not is_container_running(container_name):
            print(f"{container_name} stopped.")
            return
        time.sleep(1)

def create_and_run_container(name, config):
    image = config["image"]
    ports = config.get("ports", {})
    env_vars = config.get("env", {})
    additional_args = config.get("additional_args", [])

    port_args = [arg for hp, cp in ports.items() for arg in ["-p", f"{hp}:{cp}"]]
    env_args = [arg for k, v in env_vars.items() for arg in ["-e", f"{k}={v}"]]

    cmd = ["docker", "run", "-d", "--name", name, *port_args, *env_args, image, *additional_args]
    subprocess.run(cmd, check=True)

def start_container(name, containers):
    if name not in containers:
        raise ValueError(f"No container config found for '{name}'")

    config = containers[name]

    if check_container_status(name):
        print(f"Stopping existing {name}...")
        stop_container(name)
        subprocess.run(["docker", "rm", "-f", name], check=False)

    print(f"Creating and starting {name}...")
    create_and_run_container(name, config)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("container", help="Name of the container to start")
    args = parser.parse_args()

    with open(CONFIG_FILE) as f:
        containers = json.load(f)

    start_container(args.container, containers)

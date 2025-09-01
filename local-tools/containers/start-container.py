import argparse
import json
import subprocess
import time
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / "containers.json"


def check_container_status(container_name):
    """Check if the container exists."""
    result = subprocess.run(
        ["docker", "ps", "-a", "-q", "-f", f"name=^{container_name}$"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip() != ""  # Returns True if the container exists

def is_container_running(container_name):
    """Check if the container is running."""
    result = subprocess.run(
        ["docker", "ps", "-q", "-f", f"name=^{container_name}$"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip() != ""  # Returns True if the container is running

def stop_container(container_name, timeout=10):
    """Stop a running container."""
    subprocess.run(["docker", "stop", container_name], check=True)
    # wait for container to stop
    for _ in range(timeout):
        if not is_container_running(container_name):
            print(f"Container '{container_name}' stopped successfully.")
            return True  # Is stopped
        time.sleep(1)  # Wait for 1 second before checking again
    
    raise RuntimeError(f"Container {container_name} did not stop within {timeout} seconds.")
    
def start_container(container_name):
    """Start an existing container."""
    subprocess.run(["docker", "start", container_name], check=True)
    print(f"Container '{container_name}' started successfully.")

def create_and_run_container(service_config):
    """Create and run a new container for a service."""
    container_name = service_config["name"]
    image = service_config["image"]
    ports = service_config.get("ports", {})
    env_vars = service_config.get("env", {})
    additional_args = service_config.get("additional_args", [])

    # Build port mapping arguments
    port_args = []
    for host_port, container_port in ports.items():
        port_args.extend(["-p", f"{host_port}:{container_port}"])

    # Build environment variable arguments
    env_args = []
    for key, value in env_vars.items():
        env_args.extend(["-e", f"{key}={value}"])

    # Run the Docker container
    cmd = ["docker", "run", "-d", "--name", container_name, *port_args, *env_args, image]
    if additional_args:
        cmd.extend(additional_args)

    subprocess.run(cmd, check=True)

    if "on_load" in service_config:
            subprocess.run(["docker", *service_config["on_load"]], check=True)
    if  "postprocess" in service_config:
        process = subprocess.Popen(
        ["docker", "logs", "-f", container_name],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        )
        try:
            line=""
            while not line or service_config["postprocess"]["endCreationLog"] not in line :
                line = process.stdout.readline()
                time.sleep(0.1)  
            subprocess.run(["docker", "exec", container_name, *service_config["postprocess"]["postprocessCommand"]],check=True)
        except Exception as e:
            print(f"Error while reading logs: {e}")
        finally:
            process.terminate()
    
    print(f"Container '{container_name}' created and started successfully.")

def start_docker_container(container_name):
    """Manage a Docker service: create, start, or take no action if already running."""
    container_config = containers[container_name]
    if check_container_status(container_name):
        if is_container_running(container_name):
            stop_container(container_name)
    
        print(f"Starting {container_name}...")
        if "on_load" in container_config:
            subprocess.run(["docker", *container_config["on_load"]], check=True)
        start_container(container_name)
    else:
        print(f"Container '{container_name}' does not exist. Creating and starting...")
        create_and_run_container(container_config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("container", help="Name of the container to start")
    args = parser.parse_args()

    with open(CONFIG_FILE) as f:
        containers = json.load(f)

    start_docker_container(args.container)

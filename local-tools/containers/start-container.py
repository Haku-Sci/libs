import argparse
import json
import os
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

def create_and_run_container(container_name, service_config):
    """Create and run a new container for a service. Any key already declared in
    the config's "env" is overridable from this process's own environment - e.g.
    the "env" block of a VS Code launch.json task - without editing containers.json."""
    image = service_config["image"]
    ports = service_config.get("ports", {})
    env_vars = {k: os.environ.get(k, v) for k, v in service_config.get("env", {}).items()}
    volumes = service_config.get("volumes", {})
    additional_args = service_config.get("additional_args", [])

    # Build port mapping arguments
    port_args = []
    for host_port, container_port in ports.items():
        port_args.extend(["-p", f"{host_port}:{container_port}"])

    # Build environment variable arguments
    env_args = []
    for key, value in env_vars.items():
        env_args.extend(["-e", f"{key}={value}"])

    # Build volume mapping arguments - named volumes so data survives a recreate
    volume_args = []
    for source, target in volumes.items():
        volume_args.extend(["-v", f"{source}:{target}"])

    # Run the Docker container
    cmd = ["docker", "run", "-d", "--name", container_name, *port_args, *env_args, *volume_args, image]
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

def get_running_env(container_name):
    """Returns the KEY=value env entries an existing container was actually created
    with, as a dict. Used to tell a real override from a value that just happens to
    already match, so we don't recreate the container - and lose unvolumed data -
    for no reason."""
    result = subprocess.run(
        ["docker", "inspect", "--format", "{{json .Config.Env}}", container_name],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    entries = json.loads(result.stdout)
    return dict(entry.split("=", 1) for entry in entries if "=" in entry)


def get_changed_env(container_name, service_config):
    """The subset of this container's declared env keys whose value in the current
    process environment differs from what the running container was created with -
    e.g. via a launch.json task's "env" block. Only these actually require a
    recreate; a key merely being present with its already-applied value does not."""
    declared = service_config.get("env", {})
    overridden = {k: os.environ[k] for k in declared if k in os.environ}
    if not overridden:
        return {}
    running_env = get_running_env(container_name)
    return {
        k: v for k, v in overridden.items() if running_env.get(k) != v
    }


def start_docker_container(container_name, force_restart=False):
    """Manage a Docker service: create, start, or take no action if already running.
    A changed env value can only be applied by recreating the container - `docker
    start` does not accept new -e flags on an existing one - so recreate is reserved
    for that case; a plain reload (e.g. picking up a rebuilt plugin jar via on_load)
    only needs a restart and must not discard unvolumed data."""
    container_config = containers[container_name]
    if check_container_status(container_name):
        changed_env = get_changed_env(container_name, container_config)
        if is_container_running(container_name):
            if not force_restart and not changed_env:
                print(f"Container '{container_name}' is already running.")
                return
            print(f"Restarting {container_name}...")
            stop_container(container_name)

        if changed_env:
            print(f"Recreating '{container_name}' to apply changed env value(s): {', '.join(changed_env)}...")
            subprocess.run(["docker", "rm", container_name], check=True)
            create_and_run_container(container_name, container_config)
            return

        print(f"Starting {container_name}...")
        if "on_load" in container_config:
            subprocess.run(["docker", *container_config["on_load"]], check=True)
        start_container(container_name)
    else:
        print(f"Container '{container_name}' does not exist. Creating and starting...")
        create_and_run_container(container_name, container_config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("container", help="Name of the container to start")
    parser.add_argument("--restart", action="store_true", help="Restart the container if already running")
    args = parser.parse_args()

    with open(CONFIG_FILE) as f:
        containers = json.load(f)

    start_docker_container(args.container, force_restart=args.restart)

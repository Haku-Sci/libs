import subprocess
import os
import shutil
import socket
import time
from pathlib import Path
os.environ["VAULT_ADDR"] = "http://127.0.0.1:8200"

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0

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
    # Attendre que le conteneur soit vraiment arrêté
    for _ in range(timeout):
        if not is_container_running(container_name):
            print(f"Container '{container_name}' stopped successfully.")
            return True  # Il est bien arrêté
        time.sleep(1)  # Attente avant de vérifier à nouveau
    
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
                # Lire les lignes des logs au fur et à mesure
                line = process.stdout.readline()
                time.sleep(0.1)  
            subprocess.run(["docker", "exec", container_name, *service_config["postprocess"]["postprocessCommand"]],check=True)
        except Exception as e:
            print(f"Error while reading logs: {e}")
        finally:
            process.terminate()
    
    print(f"Container '{container_name}' created and started successfully.")

def manage_docker_service(service_config):
    """Manage a Docker service: create, start, or take no action if already running."""
    container_name = service_config["name"]
    if check_container_status(container_name):
        if is_container_running(container_name):
            print(f"Container '{container_name}' is already running.")
        else:
            print(f"Container '{container_name}' exists but is stopped. Starting...")
            if "on_load" in service_config:
                subprocess.run(["docker", *service_config["on_load"]], check=True)
            start_container(container_name)
    else:
        print(f"Container '{container_name}' does not exist. Creating and starting...")
        create_and_run_container(service_config)

def manage_consul():
    """Manage Consul: check, download, and run locally as a process."""
    consul_path = shutil.which("consul")  # Check if Consul is installed
    if not consul_path:
        print("Consul is not installed. Downloading...")
        # Download Consul (Windows 64-bit)
        download_url = "https://releases.hashicorp.com/consul/1.16.0/consul_1.16.0_windows_amd64.zip"
        subprocess.run(["curl", "-O", download_url], check=True)
        subprocess.run(["tar", "-xvf", "consul_1.16.0_windows_amd64.zip", "-C", "."], check=True)
        consul_path = os.path.abspath("consul")
        print("Consul downloaded and extracted successfully.")

    # Check if Consul is already running
    if is_port_in_use(8500):
        print("Consul is already running on port 8500.")
    else:
        print("Starting Consul...")
        subprocess.Popen(
            [consul_path, "agent", "-dev"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        time.sleep(2)
        print("Consul started successfully.")

# Docker service configurations
'''
    {
        "name": "rabbitmq",
        "image": "rabbitmq:management",
        "ports": {5672: 5672, 15672: 15672},
        "env": {},
        "additional_args": [],
    },
    {
        "name": "vault",
        "image": "hashicorp/vault:latest",
        "ports": {8200: 8200},
        "env": {
            "VAULT_DEV_ROOT_TOKEN_ID": "myroot",
            "VAULT_DEV_LISTEN_ADDRESS": "0.0.0.0:8200"
        },
        "additional_args": [
            "--cap-add=IPC_LOCK",  # required for Vault to lock memory
            "--restart=unless-stopped"
        ],
        "postprocess": {
            "endCreationLog": "Vault server started!",
            "postprocessCommand": ["vault", "status"]
        }
    },'''
services = [    
    {
        "name": "postgres",
        "image": "postgres:latest",
        "ports": {5432: 5432},
        "env": {
            "POSTGRES_USER": "admin",
            "POSTGRES_PASSWORD": "password",
            "POSTGRES_DB": "postgres",
        },
        "additional_args": [],
    },
    {
        "name": "neo4j",
        "image": "neo4j:latest",
        "ports": {7474: 7474, 7687: 7687, 5005: 5005},
        "env": {
            "NEO4J_AUTH": "neo4j/password",
            "NEO4J_PLUGINS": '["apoc", "graph-data-science"]',
            #"NEO4J_server_jvm_additional": "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
        },
        "additional_args": [],
        "on_load":["cp", f"{str(Path('../graph-libs/target/graph-libs-1.0.jar').resolve())}", f"neo4j:/var/lib/neo4j/plugins/graph-libs-1.0.jar"]
    }
]

if __name__ == "__main__":
    # Manage Docker services
    for service in services:
        manage_docker_service(service)

    # Manage Consul
    manage_consul()

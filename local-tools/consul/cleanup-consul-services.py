import requests

LOCAL = "http://hubs.haku-sci.com:8500"

def get_local_services():
    """Fetch local agent's registered services."""
    resp = requests.get(f"{LOCAL}/v1/agent/services")
    resp.raise_for_status()
    return resp.json()

def deregister_service(service_id):
    """Deregister a service by its ID."""
    resp = requests.put(f"{LOCAL}/v1/agent/service/deregister/{service_id}")
    resp.raise_for_status()
    print(f"🗑️ Deregistered service ID: {service_id}")

def cleanup_services():
    services = get_local_services()
    if not services:
        print("✅ No services to deregister.")
        return
    for sid in services:
        deregister_service(sid)
    print("✅ All services have been deregistered.")

if __name__ == "__main__":
    cleanup_services()

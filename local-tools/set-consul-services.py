import requests

REMOTE = "http://consul.haku-sci.com:8500"
LOCAL = "http://127.0.0.1:8500"

def get_remote_services():
    # Fetch list of all remote service names
    resp = requests.get(f"{REMOTE}/v1/catalog/services")
    resp.raise_for_status()
    return resp.json().keys()

def get_service_instances(service):
    # Fetch all instances for a particular remote service
    resp = requests.get(f"{REMOTE}/v1/catalog/service/{service}")
    resp.raise_for_status()
    return resp.json()

def get_local_services():
    # Fetch local agent's registered services
    resp = requests.get(f"{LOCAL}/v1/agent/services")
    resp.raise_for_status()
    return resp.json()

def register_local_instance(inst):
    # Create payload, replicating remote instance exactly
    payload = {
        "ID": inst["ServiceID"],
        "Name": inst["ServiceName"],
        "Address": inst.get("ServiceAddress", inst.get("Address", "")),
        "Port": inst["ServicePort"],
        "Tags": inst.get("ServiceTags", []),
        # Add TCP health check for every service
        "Check": {
            "TCP": f"{payload_address(inst)}:{inst['ServicePort']}",
            "Interval": "10s"
        }
    }
    resp = requests.put(f"{LOCAL}/v1/agent/service/register", json=payload)
    resp.raise_for_status()
    print(f"✅ Registered {payload['Name']} (ID={payload['ID']}, Port={payload['Port']})")

def payload_address(inst):
    return inst.get("ServiceAddress", inst.get("Address", "")) or "127.0.0.1"

def sync_services():
    local = get_local_services()
    for svc in get_remote_services():
        instances = get_service_instances(svc)
        for inst in instances:
            sid = inst["ServiceID"]
            if sid not in local:
                register_local_instance(inst)
            else:
                print(f"✓ Already registered: {sid}")

if __name__ == "__main__":
    sync_services()

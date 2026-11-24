#!/usr/bin/env python3
"""Create a GitLab issue in <GITLAB_GROUP>/<service> and print its URL."""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

GITLAB_URL = os.environ.get("GITLAB_URL", "https://git.haku-sci.com")
GITLAB_GROUP = os.environ.get("GITLAB_GROUP", "haku-sci")
SERVICE_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_.-]*$")

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--service", required=True)
parser.add_argument("--title", required=True)
parser.add_argument("--description", required=True)
args = parser.parse_args()

if not SERVICE_PATTERN.match(args.service):
    sys.exit(f"Invalid service name: {args.service!r}")

token = os.environ.get("GITLAB_TOKEN")
if not token:
    sys.exit("GITLAB_TOKEN is not set")

project = urllib.parse.quote(f"{GITLAB_GROUP}/{args.service}", safe="")
request = urllib.request.Request(
    f"{GITLAB_URL}/api/v4/projects/{project}/issues",
    method="POST",
    headers={"PRIVATE-TOKEN": token, "Content-Type": "application/json; charset=utf-8"},
    data=json.dumps({"title": args.title, "description": args.description}).encode("utf-8"),
)
with urllib.request.urlopen(request) as response:
    print(json.load(response)["web_url"])

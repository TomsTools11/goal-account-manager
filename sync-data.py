#!/usr/bin/env python3
"""
Sync MCP data to the GOAL Account Manager app's data directory.
This script runs in the sandbox and copies cached data to the user's machine.
"""
import json
import subprocess
import os
import re

DATA_DIR = "/mnt/desktop/goal-account-manager/server/data"
os.makedirs(DATA_DIR, exist_ok=True)

def run_mcp(server, tool, input_data):
    """Run MCP CLI and return parsed result."""
    cmd = f"manus-mcp-cli tool call {tool} --server {server} --input '{json.dumps(input_data)}'"
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
        output = result.stdout + result.stderr
        
        # Try to find JSON file path
        file_match = re.search(r'saved to:\s*(.+\.json)', output)
        if file_match:
            fpath = file_match.group(1).strip()
            if os.path.exists(fpath):
                with open(fpath) as f:
                    return json.load(f)
        
        # Try to parse inline JSON
        json_match = re.search(r'Tool execution result:\n(.*)', output, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1).strip())
            except:
                return {"raw": json_match.group(1).strip()}
        
        # Return raw MCP result text
        mcp_file_match = re.search(r'mcp_result_[a-f0-9]+\.json', output)
        if mcp_file_match:
            mcp_path = f"/tmp/manus-mcp/{mcp_file_match.group(0)}"
            if os.path.exists(mcp_path):
                with open(mcp_path) as f:
                    content = f.read()
                return {"raw": content}
        
        return {"raw": output}
    except Exception as e:
        return {"error": str(e)}

def run_gws(service, resource, method, params):
    """Run gws CLI and return result."""
    cmd = f"gws {service} {resource} {method} --params '{json.dumps(params)}'"
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        try:
            return json.loads(result.stdout)
        except:
            return {"raw": result.stdout}
    except Exception as e:
        return {"error": str(e)}

print("Syncing Notion accounts...")
notion = run_mcp("notion", "notion-query-database-view", {
    "view_url": "view://ffca9a8b-5213-8283-bee9-886ae9802fb9",
    "page_size": 100
})
with open(os.path.join(DATA_DIR, "notion_accounts.json"), "w") as f:
    json.dump(notion, f, indent=2)
print(f"  -> {len(notion.get('results', []))} accounts")

print("Syncing Gmail...")
gmail = run_mcp("gmail", "gmail_search_messages", {
    "q": "subject:account OR subject:GOAL OR subject:onboarding OR subject:insurance OR subject:review",
    "max_results": 50
})
with open(os.path.join(DATA_DIR, "gmail_recent.json"), "w") as f:
    json.dump(gmail, f, indent=2)
print("  -> Gmail data saved")

print("Syncing Calendar events...")
from datetime import datetime, timedelta
now = datetime.utcnow()
past = (now - timedelta(days=7)).strftime("%Y-%m-%dT00:00:00Z")
future = (now + timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")
calendar = run_mcp("google-calendar", "google_calendar_search_events", {
    "time_min": past,
    "time_max": future,
    "max_results": 100
})
with open(os.path.join(DATA_DIR, "calendar_events.json"), "w") as f:
    json.dump(calendar, f, indent=2)
print("  -> Calendar data saved")

print("Syncing Slack channels...")
slack = run_mcp("slack", "slack_search_channels", {
    "query": "",
    "channel_types": "public_channel,private_channel"
})
with open(os.path.join(DATA_DIR, "slack_channels.json"), "w") as f:
    json.dump(slack, f, indent=2)
print("  -> Slack channels saved")

print("\nAll data synced to server/data/")
print("Restart the server to pick up fresh data.")

#!/usr/bin/env python3
"""
Sync real MCP cached data to the GOAL Account Manager app's data directory.
Uses file read/write to avoid FUSE permission issues.
"""
import json
import os

DATA_DIR = "/mnt/desktop/goal-account-manager/server/data"
os.makedirs(DATA_DIR, exist_ok=True)

def copy_file(src, dst):
    with open(src, 'rb') as f:
        data = f.read()
    with open(dst, 'wb') as f:
        f.write(data)

# 1. Notion accounts
notion_file = "/home/ubuntu/.mcp/tool-results/2026-04-08_13-07-04_notion_notion-query-database-view.json"
if os.path.exists(notion_file):
    copy_file(notion_file, os.path.join(DATA_DIR, "notion_accounts.json"))
    with open(notion_file) as f:
        data = json.load(f)
    print(f"Notion: {len(data.get('results', []))} accounts")

# 2. Gmail
gmail_file = "/tmp/manus-mcp/mcp_result_aa3d81f365074e51ab616c6a76b0732e.json"
if os.path.exists(gmail_file):
    copy_file(gmail_file, os.path.join(DATA_DIR, "gmail_recent.json"))
    print("Gmail: cached")

# 3. Calendar
calendar_file = "/tmp/manus-mcp/mcp_result_bd7f3e55abcc4f679a48de982b2a0802.json"
if os.path.exists(calendar_file):
    copy_file(calendar_file, os.path.join(DATA_DIR, "calendar_events.json"))
    print("Calendar: cached")

# 4. Slack channels
slack_file = "/home/ubuntu/.mcp/tool-results/2026-04-08_12-55-06_slack_slack_search_channels.json"
if os.path.exists(slack_file):
    copy_file(slack_file, os.path.join(DATA_DIR, "slack_channels.json"))
    print("Slack: cached")

print("\nAll data synced!")
for f in os.listdir(DATA_DIR):
    fpath = os.path.join(DATA_DIR, f)
    print(f"  {f}: {os.path.getsize(fpath)} bytes")

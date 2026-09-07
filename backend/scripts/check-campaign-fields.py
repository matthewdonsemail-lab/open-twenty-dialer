import json, urllib.request

key = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMDI0NDA2LWI4ZGItNGY0ZS04ZTM5LTJlZGUyZGZhOTRiOSJ9.eyJzdWIiOiIwN2QxNGQwNy00ZWIzLTQyNzEtOTdiMS1lMmMwYzA3ZWJmMDMiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiMDdkMTRkMDctNGViMy00MjcxLTk3YjEtZTJjMGMwN2ViZjAzIiwiaWF0IjoxNzgyMjk3NjM5LCJleHAiOjQ5MzU4OTc2MjYsImp0aSI6IjY3YWQ3MTZmLWI2YzYtNDY4OS1iYmU5LTkzMDk2YzYwODgyMSJ9.IAbM33F8gfK7Ll9BPcXyoYUvsECu-m2CD0eE-mq7aYTzQESQOoQbdmH_Mm8WAaZaa2K97F92r1wpiVs5HbhBwA"
url = "https://twenty.inferencesaver.com/rest/metadata/fields?limit=200"

req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
with urllib.request.urlopen(req, timeout=15) as resp:
    data = json.load(resp)

# Find agencyCampaigns fields
campaign_id = "dd366974-3894-4137-855c-15c326b592c0"
fields = [f for f in data.get("data", []) if f.get("objectMetadataId") == campaign_id]

print(f"Found {len(fields)} fields on agencyCampaigns:")
for f in fields:
    opts = f.get("options", [])
    opts_str = json.dumps(opts) if opts else "(none)"
    print(f"  {f['name']:20s} ({f['type']:12s}): {opts_str}")

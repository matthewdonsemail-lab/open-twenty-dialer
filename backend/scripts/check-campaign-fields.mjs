import https from 'https';

const key = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMDI0NDA2LWI4ZGItNGY0ZS04ZTM5LTJlZGUyZGZhOTRiOSJ9.eyJzdWIiOiIwN2QxNGQwNy00ZWIzLTQyNzEtOTdiMS1lMmMwYzA3ZWJmMDMiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiMDdkMTRkMDctNGViMy00MjcxLTk3YjEtZTJjMGMwN2ViZjAzIiwiaWF0IjoxNzgyMjk3NjM5LCJleHAiOjQ5MzU4OTc2MjYsImp0aSI6IjY3YWQ3MTZmLWI2YzYtNDY4OS1iYmU5LTkzMDk2YzYwODgyMSJ9.IAbM33F8gfK7Ll9BPcXyoYUvsECu-m2CD0eE-mq7aYTzQESQOoQbdmH_Mm8WAaZaa2K97F92r1wpiVs5HbhBwA";
const url = 'https://twenty.inferencesaver.com/rest/metadata/fields?limit=200';

const req = https.get(url, { headers: { 'Authorization': `Bearer ${key}` } }, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const campaignId = 'dd366974-3894-4137-855c-15c326b592c0';
    const fields = parsed.data.filter(f => f.objectMetadataId === campaignId);
    console.log(`Found ${fields.length} fields on agencyCampaigns:`);
    fields.forEach(f => {
      const opts = f.options ? JSON.stringify(f.options) : '(none)';
      console.log(`  ${f.name.padEnd(20)} (${f.type.padEnd(12)}): ${opts}`);
    });
  });
});

req.on('error', e => console.error(e.message));

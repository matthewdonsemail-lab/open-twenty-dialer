import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env.local") });

const TWENTY_BASE_URL = process.env.TWENTY_BASE_URL?.replace("/rest", "") || "https://twenty.inferencesaver.com";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY?.trim();

if (!TWENTY_API_KEY) {
  console.error("Error: TWENTY_API_KEY not found in .env.local");
  process.exit(1);
}

console.log("Using API key (length):", TWENTY_API_KEY.length);
console.log("Using Twenty instance:", TWENTY_BASE_URL);

const HEADERS = {
  "Authorization": `Bearer ${TWENTY_API_KEY}`,
  "Content-Type": "application/json",
};

const CAMPAIGN_OBJECT_ID = "dd366974-3894-4137-855c-15c326b592c0";

async function fetchTwenty(pathUrl: string, options: RequestInit = {}) {
  const url = `${TWENTY_BASE_URL}${pathUrl.startsWith("/") ? "" : "/"}${pathUrl}`;
  console.log(`Fetching: ${url}`);
  const response = await fetch(url, { ...options, headers: { ...HEADERS, ...options.headers } });
  const text = await response.text();
  if (!response.ok) throw new Error(`API error (${response.status}): ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function ensureCampaignFields() {
  console.log(`\nAgency Campaigns object ID: ${CAMPAIGN_OBJECT_ID}`);

  // Get object metadata which includes all fields
  const objectsResponse = await fetchTwenty(`/rest/metadata/objects`);
  const campaignsObj = (objectsResponse.data || []).find((o: any) => o.id === CAMPAIGN_OBJECT_ID);
  
  if (!campaignsObj) {
    throw new Error(`Could not find agencyCampaigns object with ID ${CAMPAIGN_OBJECT_ID}`);
  }

  console.log(`Found agencyCampaigns object: ${campaignsObj.labelPlural}`);
  console.log(`Fields on object: ${campaignsObj.fields.map((f: any) => f.name).join(", ")}`);

  const existingFields = new Map(campaignsObj.fields.map((f: any) => [f.name, f]));

  // Check status field
  const statusField = existingFields.get("status");
  if (statusField) {
    console.log(`\nFound 'status' field (id: ${statusField.id}, type: ${statusField.type})`);
    
    // Check if options exist
    const hasOptions = statusField.options && Array.isArray(statusField.options) && statusField.options.length > 0;
    console.log(`Status options present: ${hasOptions ? `YES (${statusField.options.length} options)` : 'NO'}`);
    
    if (!hasOptions) {
      console.log("Adding options to status field...");
      
      const updated = await fetchTwenty(`/rest/metadata/fields/${statusField.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          options: [
            { label: "Active", value: "ACTIVE", color: "green", position: 0 },
            { label: "Inactive", value: "INACTIVE", color: "gray", position: 1 },
            { label: "Draft", value: "DRAFT", color: "amber", position: 2 },
          ],
        }),
      });
      console.log("✅ Updated status field with options");
    }
  }

  // Check campaignType field
  const typeField = existingFields.get("campaignType");
  if (typeField) {
    console.log(`\nFound 'campaignType' field (id: ${typeField.id}, type: ${typeField.type})`);
    const hasOptions = typeField.options && Array.isArray(typeField.options) && typeField.options.length > 0;
    console.log(`Type options present: ${hasOptions ? `YES (${typeField.options.length} options)` : 'NO'}`);
    
    if (!hasOptions) {
      console.log("Adding options to campaignType field...");
      await fetchTwenty(`/rest/metadata/fields/${typeField.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          options: [
            { label: "Outbound", value: "OUTBOUND", color: "blue", position: 0 },
            { label: "Inbound", value: "INBOUND", color: "emerald", position: 1 },
            { label: "Blended", value: "BLENDED", color: "purple", position: 2 },
            { label: "Referral", value: "REFERRAL", color: "amber", position: 3 },
            { label: "Cold Call", value: "COLD_CALL", color: "rose", position: 4 },
            { label: "Website", value: "WEBSITE", color: "cyan", position: 5 },
            { label: "Twenty Import", value: "TWENTY_IMPORT", color: "slate", position: 6 },
            { label: "Other", value: "OTHER", color: "gray", position: 7 },
          ],
        }),
      });
      console.log("✅ Updated campaignType field with options");
    }
  } else {
    console.log("\n⚠️ No 'campaignType' field found - need to create it");
    
    // Try to create campaignType field
    try {
      const created = await fetchTwenty("/rest/metadata/fields", {
        method: "POST",
        body: JSON.stringify({
          objectMetadataId: CAMPAIGN_OBJECT_ID,
          name: "campaignType",
          label: "Campaign Type",
          type: "SELECT",
          description: "Campaign source/type classification",
          isNullable: true,
          options: [
            { label: "Outbound", value: "OUTBOUND", color: "blue", position: 0 },
            { label: "Inbound", value: "INBOUND", color: "emerald", position: 1 },
            { label: "Blended", value: "BLENDED", color: "purple", position: 2 },
            { label: "Referral", value: "REFERRAL", color: "amber", position: 3 },
            { label: "Cold Call", value: "COLD_CALL", color: "rose", position: 4 },
            { label: "Website", value: "WEBSITE", color: "cyan", position: 5 },
            { label: "Twenty Import", value: "TWENTY_IMPORT", color: "slate", position: 6 },
            { label: "Other", value: "OTHER", color: "gray", position: 7 },
          ],
        }),
      });
      console.log("✅ Created campaignType field:", JSON.stringify(created.data, null, 2));
    } catch (err: any) {
      console.log("⚠️ Could not create campaignType field:", err.message);
    }
  }

  // Also check for campaignStatus field (the backend expects this name)
  const campaignStatusField = existingFields.get("campaignStatus");
  if (!campaignStatusField) {
    console.log("\n⚠️ No 'campaignStatus' field found - need to create it");
    
    try {
      const created = await fetchTwenty("/rest/metadata/fields", {
        method: "POST",
        body: JSON.stringify({
          objectMetadataId: CAMPAIGN_OBJECT_ID,
          name: "campaignStatus",
          label: "Campaign Status",
          type: "SELECT",
          description: "Campaign lifecycle status",
          isNullable: true,
          options: [
            { label: "Active", value: "ACTIVE", color: "green", position: 0 },
            { label: "Inactive", value: "INACTIVE", color: "gray", position: 1 },
            { label: "Draft", value: "DRAFT", color: "amber", position: 2 },
          ],
        }),
      });
      console.log("✅ Created campaignStatus field:", JSON.stringify(created.data, null, 2));
    } catch (err: any) {
      console.log("⚠️ Could not create campaignStatus field:", err.message);
    }
  }
}

async function main() {
  try {
    await ensureCampaignFields();
    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

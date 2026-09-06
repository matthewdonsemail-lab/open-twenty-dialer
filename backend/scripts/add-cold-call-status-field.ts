/**
 * Migration script: Add coldCallStatus field to agencyProspects in Twenty
 * 
 * This adds a custom SELECT field for cold calling workflow statuses,
 * separate from the SMS/outbound pipeline's outboundState field.
 * 
 * Usage: npx tsx backend/scripts/add-cold-call-status-field.ts
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env.local");
config({ path: envPath });

const TWENTY_BASE_URL = process.env.TWENTY_BASE_URL?.replace("/rest", "") || "https://twenty.inferencesaver.com";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;

if (!TWENTY_API_KEY) {
  console.error("Error: TWENTY_API_KEY not found in environment");
  process.exit(1);
}

const HEADERS = {
  "Authorization": `Bearer ${TWENTY_API_KEY}`,
  "Content-Type": "application/json",
};

async function twentyMetadataQuery(query: string, variables: object) {
  const response = await fetch(`${TWENTY_BASE_URL}/metadata`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  
  const text = await response.text();
  
  if (!response.ok) {
    throw new Error(`Metadata API error (${response.status}): ${text}`);
  }
  
  const json = JSON.parse(text);
  if (json.errors?.length > 0) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  
  return json.data;
}

async function ensureColdCallStatusField() {
  console.log(`Using Twenty instance: ${TWENTY_BASE_URL}`);
  console.log("Looking for agencyProspects object...");
  
  // Query for objects with their fields
  const data = await twentyMetadataQuery(
    `query {
      objects(filter: {}, paging: { first: 100 }) {
        edges {
          node {
            id
            nameSingular
            fieldsList {
              id
              name
              type
              options
            }
          }
        }
      }
    }`,
    {}
  );
  
  const objects = data.objects.edges.map((edge: any) => edge.node);
  const prospectObject = objects.find((obj: any) => obj.nameSingular === "agencyProspect");
  
  if (!prospectObject) {
    throw new Error("agencyProspects object not found in Twenty");
  }
  
  console.log(`Found agencyProspects object: ${prospectObject.id}`);
  
  // Check if field already exists
  const existingFieldNames = (prospectObject.fieldsList || []).map((field: any) => field.name);
  
  if (existingFieldNames.includes("coldCallStatus")) {
    console.log("coldCallStatus field already exists, skipping creation");
    return;
  }
  
  console.log("Creating coldCallStatus field...");
  
  // Twenty requires UPPER_CASE values for SELECT fields
  const fieldOptions = [
    { label: "New", value: "NEW", color: "gray", position: 0 },
    { label: "Contacted", value: "CONTACTED", color: "blue", position: 1 },
    { label: "Interested", value: "INTERESTED", color: "green", position: 2 },
    { label: "Not Interested", value: "NOT_INTERESTED", color: "red", position: 3 },
    { label: "Callback", value: "CALLBACK", color: "yellow", position: 4 },
    { label: "Converted", value: "CONVERTED", color: "purple", position: 5 },
    { label: "Do Not Contact", value: "DO_NOT_CONTACT", color: "black", position: 6 },
  ];
  
  const result = await twentyMetadataQuery(
    `mutation CreateOneField($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) {
        id
        name
        type
      }
    }`,
    {
      input: {
        field: {
          objectMetadataId: prospectObject.id,
          name: "coldCallStatus",
          label: "Cold Call Status",
          type: "SELECT",
          description: "Status from manual cold calling workflow (separate from SMS outbound pipeline)",
          isNullable: true,
          options: fieldOptions,
        },
      },
    }
  );
  
  console.log("Created field:", JSON.stringify(result.createOneField, null, 2));
}

async function main() {
  try {
    await ensureColdCallStatusField();
    console.log("\nMigration completed successfully!");
  } catch (error) {
    console.error("\nMigration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

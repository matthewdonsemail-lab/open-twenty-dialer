import { setupTwentyCRM } from "./src/lib/twenty-object-service.js";

async function main() {
  console.log("Running Twenty CRM setup...");
  try {
    const results = await setupTwentyCRM();
    console.log("Setup completed successfully!");
    console.log("Objects:", JSON.stringify(results.objects, null, 2));
    console.log("Fields:", JSON.stringify(results.fields, null, 2));
  } catch (err) {
    console.error("Setup failed:", err);
    process.exit(1);
  }
}

main();

import { BigQuery } from "@google-cloud/bigquery";
import { config } from "dotenv";

// Load environment variables
config();

const { GOOGLE_CLOUD_PROJECT, BIGQUERY_CREDENTIALS } = process.env;

if (!GOOGLE_CLOUD_PROJECT || !BIGQUERY_CREDENTIALS) {
  throw new Error(
    "GOOGLE_CLOUD_PROJECT and BIGQUERY_CREDENTIALS must be set in your environment variables.",
  );
}

let credentials;
try {
  // Parse and validate credentials
  console.log("Attempting to parse Google credentials...");
  if (!BIGQUERY_CREDENTIALS) {
    throw new Error("BIGQUERY_CREDENTIALS is empty or undefined");
  }

  credentials = JSON.parse(BIGQUERY_CREDENTIALS);

  // Validate required fields
  const requiredFields = ["client_email", "private_key", "project_id"];
  const missingFields = requiredFields.filter((field) => !credentials[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required fields in credentials: ${missingFields.join(", ")}`,
    );
  }

  // Log a redacted version of credentials for debugging
  console.log("Credentials validation summary:");
  console.log(`- Project ID: ${credentials.project_id}`);
  console.log(`- Client email length: ${credentials.client_email.length}`);
  console.log(`- Private key present: ${Boolean(credentials.private_key)}`);

  // Ensure private_key has proper newlines
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"');
  }

  // Log important verification details
  console.log("Credentials validation:");
  console.log("- Project ID from env:", GOOGLE_CLOUD_PROJECT);
  console.log("- Project ID from credentials:", credentials.project_id);
  console.log("- Client Email:", credentials.client_email);
  console.log("- Private key length:", credentials.private_key?.length || 0);
  console.log(
    "- Private key starts with:",
    credentials.private_key?.substring(0, 50),
  );

  // Verify project IDs match
  if (GOOGLE_CLOUD_PROJECT !== credentials.project_id) {
    console.warn(
      "Warning: Project ID mismatch between environment and credentials",
    );
  }
} catch (error) {
  console.error("Error parsing Google credentials:", error);
  throw new Error("Invalid BIGQUERY_CREDENTIALS format: " + error.message);
}

// Initialize BigQuery with credentials
export const bigquery = new BigQuery({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
  location: "US",
});

// Create dataset and tables if they don't exist
async function ensureTablesExist() {
  const datasetId = "gigflick";
  const retryDelay = 3000; // 3 seconds delay between retries
  const maxRetries = 3;

  try {
    // Verify BigQuery permissions first
    console.log("Attempting to verify BigQuery access...");
    try {
      const [datasets] = await bigquery.getDatasets();
      console.log("Successfully verified BigQuery access");
    } catch (error) {
      console.error("Failed to access BigQuery:", error);
      throw error;
    }

    // Create or get dataset
    console.log(`Creating/verifying dataset: ${datasetId}`);
    const [dataset] = await bigquery
      .createDataset(datasetId, {
        location: "US",
      })
      .catch(async (error) => {
        if (error.code === 409) {
          return await bigquery.dataset(datasetId).get();
        }
        throw error;
      });

    console.log(`Dataset ${datasetId} ready`);

    // Define table schemas
    const analysesSchema = [
      { name: "id", type: "STRING", mode: "REQUIRED" },
      { name: "fileName", type: "STRING", mode: "REQUIRED" },
      { name: "resumeUploadedAt", type: "TIMESTAMP", mode: "REQUIRED" },
      { name: "analysisFinishedAt", type: "TIMESTAMP", mode: "NULLABLE" },
      { name: "status", type: "STRING", mode: "REQUIRED" },
      { name: "results", type: "STRING", mode: "NULLABLE" },
    ];

    const scoresSchema = [
      { name: "id", type: "STRING", mode: "REQUIRED" },
      { name: "analysisId", type: "STRING", mode: "REQUIRED" },
      { name: "sectionName", type: "STRING", mode: "REQUIRED" },
      { name: "score", type: "INTEGER", mode: "REQUIRED" },
      { name: "feedback", type: "STRING", mode: "REQUIRED" },
      { name: "suggestions", type: "STRING", mode: "REQUIRED" },
    ];

    // Helper function to create table with retries
    const createTableWithRetry = async (
      tableName: string,
      schema: any,
      timePartitioning?: any,
    ) => {
      const table = dataset.table(tableName);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt} to create/verify table ${tableName}`);

          const [exists] = await table.exists();

          if (!exists) {
            const createOptions = {
              schema,
              location: "US",
              ...(timePartitioning && { timePartitioning }),
            };

            await dataset.createTable(tableName, createOptions);
            console.log(`Created table: ${tableName}`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          } else {
            console.log(`Table ${tableName} already exists`);
          }

          // Verify table exists and is accessible
          const [tableExists] = await table.exists();
          if (!tableExists) {
            throw new Error(`Table ${tableName} was not created successfully`);
          }

          // Try to query the table
          const query = `SELECT 1 FROM \`${credentials.project_id}.${datasetId}.${tableName}\` LIMIT 0`;
          await bigquery.query({ query });

          console.log(`Successfully verified table ${tableName}`);
          return;
        } catch (error: any) {
          console.error(`Attempt ${attempt} failed for ${tableName}:`, error);
          if (attempt === maxRetries) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * attempt),
          );
        }
      }
    };

    // Create tables with retries
    await createTableWithRetry("resume_analyses", analysesSchema, {
      type: "DAY",
      field: "resumeUploadedAt",
    });

    await createTableWithRetry("resume_scores", scoresSchema);
  } catch (error) {
    console.error("Error setting up BigQuery:", error);
    throw error;
  }
}

// Initialize BigQuery setup
ensureTablesExist().catch((error) => {
  console.error("Failed to initialize BigQuery setup:", error);
});

export const db = bigquery;
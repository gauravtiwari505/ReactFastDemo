import { BigQuery } from '@google-cloud/bigquery';
import { config } from 'dotenv';

// Load environment variables
config();

const { GOOGLE_CLOUD_PROJECT, BIGQUERY_CREDENTIALS } = process.env;

if (!GOOGLE_CLOUD_PROJECT || !BIGQUERY_CREDENTIALS) {
  throw new Error(
    "GOOGLE_CLOUD_PROJECT and BIGQUERY_CREDENTIALS must be set in your environment variables. Please check your .env file."
  );
}

let credentials;
try {
  credentials = JSON.parse(BIGQUERY_CREDENTIALS);
} catch (error) {
  throw new Error("Invalid BIGQUERY_CREDENTIALS JSON format in environment variables");
}

// Initialize BigQuery with correct project ID
export const bigquery = new BigQuery({
  projectId: GOOGLE_CLOUD_PROJECT,  // Use the projectId from environment variable
  credentials,
  location: 'US'
});

// Create dataset and tables if they don't exist
async function ensureTablesExist() {
  const datasetId = 'gigflick';
  const retryDelay = 3000; // 3 seconds delay between retries
  const maxRetries = 3;

  try {
    // Verify BigQuery permissions first
    const [datasets] = await bigquery.getDatasets();
    console.log('Successfully verified BigQuery access');

    // Create or get dataset
    const [dataset] = await bigquery.createDataset(datasetId, {
      location: 'US'
    }).catch(async (error) => {
      if (error.code === 409) {
        return await bigquery.dataset(datasetId).get();
      }
      throw error;
    });

    console.log(`Dataset ${datasetId} ready`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));

    // Define table schemas
    const analysesSchema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'fileName', type: 'STRING', mode: 'REQUIRED' },
      { name: 'uploadedAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'results', type: 'STRING', mode: 'NULLABLE' }  // Store JSON as STRING
    ];

    const scoresSchema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'analysisId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'sectionName', type: 'STRING', mode: 'REQUIRED' },
      { name: 'score', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'feedback', type: 'STRING', mode: 'REQUIRED' },
      { name: 'suggestions', type: 'STRING', mode: 'REQUIRED' }  // Store JSON as STRING
    ];

    // Helper function to create table with retries
    async function createTableWithRetry(tableName: string, schema: any, timePartitioning?: any) {
      const table = dataset.table(tableName);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt} to create/verify table ${tableName}`);

          // Check if table exists
          const [exists] = await table.exists();

          if (exists) {
            // Delete existing table
            await table.delete();
            console.log(`Deleted existing table: ${tableName}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }

          // Create new table with full options
          const createOptions = {
            schema,
            location: 'US',
            ...(timePartitioning && { timePartitioning })
          };

          await dataset.createTable(tableName, createOptions);
          console.log(`Created table: ${tableName}`);

          // Wait after creation
          await new Promise(resolve => setTimeout(resolve, retryDelay));

          // Verify table exists and is accessible
          const [tableExists] = await table.exists();
          if (!tableExists) {
            throw new Error(`Table ${tableName} was not created successfully`);
          }

          // Try to query the table
          const query = `SELECT 1 FROM \`${GOOGLE_CLOUD_PROJECT}.${datasetId}.${tableName}\` LIMIT 0`;
          await bigquery.query({ query });

          console.log(`Successfully verified table ${tableName} exists and is queryable`);
          return;
        } catch (error: any) {
          console.warn(`Attempt ${attempt} failed for ${tableName}: ${error.message}`);
          if (attempt === maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt)); // Exponential backoff
        }
      }
    }

    // Create tables with retries
    await createTableWithRetry('resume_analyses', analysesSchema, {
      type: 'DAY',
      field: 'uploadedAt'
    });

    await createTableWithRetry('resume_scores', scoresSchema);

  } catch (error) {
    console.error('Error setting up BigQuery:', error);
    throw error;
  }
}

// Initialize BigQuery setup
ensureTablesExist().catch(console.error);

export const db = bigquery;
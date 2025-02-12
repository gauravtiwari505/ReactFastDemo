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

export const bigquery = new BigQuery({
  projectId: GOOGLE_CLOUD_PROJECT,
  credentials
});

// Create dataset and tables if they don't exist
async function ensureTablesExist() {
  const datasetId = 'gigflick';
  const retryDelay = 2000; // 2 seconds delay between retries
  const maxRetries = 3;

  try {
    // Create dataset if it doesn't exist
    const [datasets] = await bigquery.getDatasets();
    const datasetExists = datasets.some(dataset => dataset.id === datasetId);

    if (!datasetExists) {
      await bigquery.createDataset(datasetId);
      console.log('Created dataset:', datasetId);
      // Wait a bit after dataset creation
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

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

    const dataset = bigquery.dataset(datasetId);

    // Helper function to create table with retries
    async function createTableWithRetry(tableName: string, schema: any, timePartitioning?: any) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Delete existing table if it exists
          try {
            await dataset.table(tableName).delete();
            console.log(`Deleted existing table: ${tableName}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } catch (error: any) {
            if (error.code !== 404) {
              console.warn(`Warning during table deletion: ${error.message}`);
            }
          }

          // Create new table
          const tableOptions = {
            schema,
            ...(timePartitioning && { timePartitioning })
          };

          await dataset.createTable(tableName, tableOptions);
          console.log(`Created table: ${tableName}`);

          // Verify table exists
          const [tableExists] = await dataset.table(tableName).exists();
          if (!tableExists) {
            throw new Error(`Table ${tableName} was not created successfully`);
          }

          // Wait after successful creation
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return;
        } catch (error: any) {
          console.warn(`Attempt ${attempt} failed for ${tableName}: ${error.message}`);
          if (attempt === maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
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
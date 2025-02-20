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
  projectId: GOOGLE_CLOUD_PROJECT,
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

    // Define table schemas
    const analysesSchema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'fileName', type: 'STRING', mode: 'REQUIRED' },
      { name: 'resumeUploadedAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'statusMessage', type: 'STRING', mode: 'NULLABLE' },  // Added statusMessage column
      { name: 'results', type: 'STRING', mode: 'NULLABLE' }
    ];

    const scoresSchema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'analysisId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'sectionName', type: 'STRING', mode: 'REQUIRED' },
      { name: 'score', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'feedback', type: 'STRING', mode: 'REQUIRED' },
      { name: 'suggestions', type: 'STRING', mode: 'REQUIRED' }
    ];

    // Drop and recreate tables to apply schema changes
    const tables = ['resume_analyses', 'resume_scores'];
    for (const tableName of tables) {
      const table = dataset.table(tableName);
      const [exists] = await table.exists();
      if (exists) {
        await table.delete();
        console.log(`Deleted existing table: ${tableName}`);
      }

      const schema = tableName === 'resume_analyses' ? analysesSchema : scoresSchema;
      await dataset.createTable(tableName, {
        schema,
        location: 'US'
      });
      console.log(`Created table: ${tableName} with updated schema`);
    }

  } catch (error) {
    console.error('Error setting up BigQuery:', error);
    throw error;
  }
}

// Initialize BigQuery setup
ensureTablesExist().catch(console.error);

export const db = bigquery;
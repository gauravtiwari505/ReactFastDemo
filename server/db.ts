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

  try {
    // Create dataset if it doesn't exist
    const [datasets] = await bigquery.getDatasets();
    const datasetExists = datasets.some(dataset => dataset.id === datasetId);

    if (!datasetExists) {
      await bigquery.createDataset(datasetId);
      console.log('Created dataset:', datasetId);
    }

    // Define table schemas
    const analysesSchema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'fileName', type: 'STRING', mode: 'REQUIRED' },
      { name: 'uploadedAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'results', type: 'STRING', mode: 'NULLABLE' }  // Changed from JSON to STRING to store serialized JSON
    ];

    const scoresSchema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'analysisId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'sectionName', type: 'STRING', mode: 'REQUIRED' },
      { name: 'score', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'feedback', type: 'STRING', mode: 'REQUIRED' },
      { name: 'suggestions', type: 'STRING', mode: 'REQUIRED' }  // Changed from JSON to STRING to store serialized JSON
    ];

    const dataset = bigquery.dataset(datasetId);

    // Drop and recreate tables to update schema
    const tables = ['resume_analyses', 'resume_scores'];
    for (const table of tables) {
      try {
        await dataset.table(table).delete();
      } catch (error: any) {
        // Ignore if table doesn't exist
        if (error.code !== 404) {
          console.warn(`Warning during table deletion: ${error.message}`);
        }
      }
    }

    // Create tables with updated schema
    await dataset.createTable('resume_analyses', {
      schema: analysesSchema,
      timePartitioning: {
        type: 'DAY',
        field: 'uploadedAt'
      }
    });
    console.log('Created resume_analyses table');

    await dataset.createTable('resume_scores', {
      schema: scoresSchema
    });
    console.log('Created resume_scores table');

  } catch (error) {
    console.error('Error setting up BigQuery:', error);
    throw error;
  }
}

// Initialize BigQuery setup
ensureTablesExist().catch(console.error);

export const db = bigquery;
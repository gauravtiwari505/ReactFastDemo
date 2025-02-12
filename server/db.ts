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
      { name: 'id', type: 'STRING' },
      { name: 'fileName', type: 'STRING' },
      { name: 'uploadedAt', type: 'STRING' },
      { name: 'status', type: 'STRING' },
      { name: 'results', type: 'JSON' }
    ];

    const scoresSchema = [
      { name: 'id', type: 'STRING' },
      { name: 'analysisId', type: 'STRING' },
      { name: 'sectionName', type: 'STRING' },
      { name: 'score', type: 'INTEGER' },
      { name: 'feedback', type: 'STRING' },
      { name: 'suggestions', type: 'JSON' },
      { name: 'timestamp', type: 'STRING' }
    ];

    const dataset = bigquery.dataset(datasetId);

    // Create tables if they don't exist
    try {
      await dataset.createTable('resume_analyses', {
        schema: analysesSchema
      });
      console.log('Created resume_analyses table');
    } catch (error: any) {
      if (error.code !== 409) { // 409 means table already exists
        throw error;
      }
    }

    try {
      await dataset.createTable('resume_scores', {
        schema: scoresSchema
      });
      console.log('Created resume_scores table');
    } catch (error: any) {
      if (error.code !== 409) {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error setting up BigQuery:', error);
    throw error;
  }
}

// Initialize BigQuery setup
ensureTablesExist().catch(console.error);

export const db = bigquery;
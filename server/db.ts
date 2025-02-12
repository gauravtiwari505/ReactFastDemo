import { BigQuery } from '@google-cloud/bigquery';

if (!process.env.GOOGLE_CLOUD_PROJECT || !process.env.BIGQUERY_CREDENTIALS) {
  throw new Error(
    "GOOGLE_CLOUD_PROJECT and BIGQUERY_CREDENTIALS must be set in your environment variables",
  );
}

const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);

export const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  credentials
});

// Create dataset and tables if they don't exist
async function ensureTablesExist() {
  const datasetId = 'gigflick';

  // Create dataset if it doesn't exist
  const [datasets] = await bigquery.getDatasets();
  const datasetExists = datasets.some(dataset => dataset.id === datasetId);

  if (!datasetExists) {
    await bigquery.createDataset(datasetId);
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

  // Create tables if they don't exist
  const dataset = bigquery.dataset(datasetId);

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
}

// Initialize BigQuery setup
ensureTablesExist().catch(console.error);

export const db = bigquery;
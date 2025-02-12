import { BigQuery } from '@google-cloud/bigquery';
import * as schema from "@shared/schema";

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

// Create dataset if it doesn't exist
async function ensureDatasetExists() {
  const datasetId = 'gigflick';
  const [datasets] = await bigquery.getDatasets();
  const exists = datasets.some(dataset => dataset.id === datasetId);

  if (!exists) {
    await bigquery.createDataset(datasetId);
  }
}

// Initialize BigQuery setup
ensureDatasetExists().catch(console.error);

export const db = bigquery; // Export bigquery instance directly
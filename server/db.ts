
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

// Initialize dataset if it doesn't exist
async function ensureDatasetExists() {
  const datasetId = 'gigflick';

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

  } catch (error) {
    console.error('Error setting up BigQuery:', error);
    throw error;
  }
}

// Initialize BigQuery setup
ensureDatasetExists().catch(console.error);

export const db = bigquery;

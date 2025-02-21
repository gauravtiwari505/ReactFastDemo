import { bigquery } from "./db";
import type { 
  ResumeAnalysis, 
  InsertAnalysis, 
  ResumeScore, 
  InsertScore 
} from "@shared/schema";

const DATASET = 'gigflick';

// Get credentials and project ID
const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS || '{}');
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || credentials.project_id;

if (!PROJECT_ID) {
  throw new Error('Project ID not found in BIGQUERY_CREDENTIALS or GOOGLE_CLOUD_PROJECT');
}

console.log('Using BigQuery Project ID:', PROJECT_ID);

export interface IStorage {
  createAnalysis(analysis: InsertAnalysis): Promise<ResumeAnalysis>;
  getAnalysis(id: string): Promise<ResumeAnalysis | undefined>;
  updateAnalysis(id: string, analysis: Partial<ResumeAnalysis>): Promise<ResumeAnalysis>;
  createScore(score: InsertScore): Promise<ResumeScore>;
  getAnalytics(): Promise<{
    totalResumes: number;
    averageScore: number;
    sectionAverages: Array<{
      sectionName: string;
      averageScore: number;
      totalAnalyses: number;
    }>;
  }>;
}

export class BigQueryStorage implements IStorage {
  private _tableAccessVerified = false; // Flag to track table access verification
  private tables = {
    analyses: 'resume_analyses',
    scores: 'resume_scores'
  };

  private async verifyTableAccess(tableName: string): Promise<void> {
    console.log(`Verifying access to table: ${PROJECT_ID}.${DATASET}.${tableName}`);
    const query = `SELECT 1 FROM \`${PROJECT_ID}.${DATASET}.${tableName}\` LIMIT 0`;
    try {
      await bigquery.query({ query });
      console.log(`Successfully verified access to ${tableName}`);
    } catch (error) {
      console.error(`Failed to verify access to ${tableName}:`, error);
      throw error;
    }
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<ResumeAnalysis> {
    console.log('Starting createAnalysis...');
    try {
      // Verify access only on initialization
      if (!this._tableAccessVerified) {
        await this.verifyTableAccess(this.tables.analyses);
        this._tableAccessVerified = true;
      }

      const timestamp = new Date().toISOString();
      const id = Date.now().toString();
      console.log('Generated ID:', id);

      const row = {
        id,
        fileName: insertAnalysis.fileName,
        resumeUploadedAt: timestamp,
        status: insertAnalysis.status,
        results: JSON.stringify({})
      };

      console.log('Attempting to insert row:', JSON.stringify(row));

      const insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.resume_analyses\`
        (id, fileName, resumeUploadedAt, status, results)
        VALUES(@id, @fileName, @resumeUploadedAt, @status, @results)
      `;

      await bigquery.query({
        query: insertQuery,
        params: row
      });

      console.log('Successfully inserted row');

      return {
        id,
        fileName: insertAnalysis.fileName,
        uploadedAt: timestamp,
        status: insertAnalysis.status,
        results: {}
      };
    } catch (error: any) {
      console.error('Error in createAnalysis:', error);
      throw new Error(`Failed to create analysis record: ${error.message}`);
    }
  }

  async getAnalysis(id: string): Promise<ResumeAnalysis | undefined> {
    try {
      // Verify access only on initialization
      if (!this._tableAccessVerified) {
        await this.verifyTableAccess(this.tables.analyses);
        this._tableAccessVerified = true;
      }
      const [rows] = await bigquery.query({
        query: `
          SELECT 
            id,
            fileName,
            resumeUploadedAt as uploadedAt,
            status,
            results
          FROM \`${PROJECT_ID}.${DATASET}.resume_analyses\`
          WHERE id = @id
        `,
        params: { id }
      });

      if (!rows[0]) return undefined;

      return {
        ...rows[0],
        results: rows[0].results ? JSON.parse(rows[0].results) : {}
      } as ResumeAnalysis;
    } catch (error) {
      console.error('Error in getAnalysis:', error);
      throw new Error('Failed to retrieve analysis');
    }
  }

  async updateAnalysis(id: string, update: Partial<ResumeAnalysis>): Promise<ResumeAnalysis> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Verify access only on initialization
        if (!this._tableAccessVerified) {
          await this.verifyTableAccess(this.tables.analyses);
          this._tableAccessVerified = true;
        }

        // Prepare update data
        const updateData: any = {
          ...update,
          results: update.results ? JSON.stringify(update.results) : undefined
        };

        const setClause = Object.entries(updateData)
          .filter(([_, value]) => value !== undefined)
          .map(([key, _]) => `${key} = @${key}`)
          .join(', ');

        if (!setClause) {
          throw new Error('No fields to update');
        }

        const updateQuery = `
          UPDATE \`${PROJECT_ID}.${DATASET}.resume_analyses\`
          SET ${setClause}
          WHERE id = @id
        `;

        await bigquery.query({
          query: updateQuery,
          params: { ...updateData, id }
        });

        return this.getAnalysis(id) as Promise<ResumeAnalysis>;
    } catch (error: any) {
      if (error?.code === 400 && error?.errors?.[0]?.reason === 'invalidQuery' && retryCount < maxRetries - 1) {
        console.log(`Retry attempt ${retryCount + 1} for analysis update`);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        continue;
      }
      console.error('Error in updateAnalysis:', error);
      throw new Error('Failed to update analysis');
    }
  }
  return this.getAnalysis(id) as Promise<ResumeAnalysis>;
}

  async createScore(insertScore: InsertScore): Promise<ResumeScore> {
    try {
      // Verify access only on initialization
      if (!this._tableAccessVerified) {
        await this.verifyTableAccess(this.tables.scores);
        this._tableAccessVerified = true;
      }
      const id = Date.now().toString();

      const row = {
        id,
        analysisId: insertScore.analysisId,
        sectionName: insertScore.sectionName,
        score: insertScore.score,
        feedback: insertScore.feedback,
        suggestions: JSON.stringify(insertScore.suggestions || [])
      };

      const table = bigquery.dataset(DATASET).table('resume_scores');
      await table.insert([row]);
      console.log('Successfully inserted row into resume_scores');

      const [result] = await bigquery.query({
        query: `
          SELECT 
            id,
            analysisId,
            sectionName,
            score,
            feedback,
            suggestions
          FROM \`${PROJECT_ID}.${DATASET}.resume_scores\`
          WHERE id = @id
        `,
        params: { id }
      });

      if (!result || !result[0]) {
        throw new Error('Failed to retrieve inserted score record');
      }

      return {
        ...result[0],
        suggestions: result[0].suggestions ? JSON.parse(result[0].suggestions) : []
      } as ResumeScore;
    } catch (error) {
      console.error('Error in createScore:', error);
      throw new Error('Failed to create score record');
    }
  }

  async getAnalytics() {
    try {
      // Verify access only on initialization
      if (!this._tableAccessVerified) {
        await this.verifyTableAccess(this.tables.analyses);
        await this.verifyTableAccess(this.tables.scores);
        this._tableAccessVerified = true;
      }
      const [rows] = await bigquery.query({
        query: `
          WITH ScoreStats AS (
            SELECT
              COUNT(DISTINCT a.id) as totalResumes,
              AVG(s.score) as averageScore
            FROM \`${PROJECT_ID}.${DATASET}.resume_analyses\` a
            LEFT JOIN \`${PROJECT_ID}.${DATASET}.resume_scores\` s ON a.id = s.analysisId
          ),
          SectionStats AS (
            SELECT
              sectionName,
              AVG(score) as averageScore,
              COUNT(*) as totalAnalyses
            FROM \`${PROJECT_ID}.${DATASET}.resume_scores\`
            GROUP BY sectionName
          )
          SELECT
            s.totalResumes,
            s.averageScore,
            ARRAY_AGG(STRUCT(
              ss.sectionName,
              ss.averageScore,
              ss.totalAnalyses
            )) as sectionAverages
          FROM ScoreStats s
          CROSS JOIN SectionStats ss
          GROUP BY s.totalResumes, s.averageScore
        `
      });

      const result = rows[0];

      return {
        totalResumes: Number(result?.totalResumes || 0),
        averageScore: Number(result?.averageScore || 0),
        sectionAverages: (result?.sectionAverages || []).map((section: any) => ({
          sectionName: section.sectionName,
          averageScore: Number(section.averageScore || 0),
          totalAnalyses: Number(section.totalAnalyses || 0),
        }))
      };
    } catch (error) {
      console.error('Error in getAnalytics:', error);
      throw new Error('Failed to retrieve analytics');
    }
  }
}

export const storage = new BigQueryStorage();
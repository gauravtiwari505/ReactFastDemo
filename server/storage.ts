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
const PROJECT_ID = credentials.project_id;

if (!PROJECT_ID) {
  throw new Error('Project ID not found in BIGQUERY_CREDENTIALS');
}

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
      // Verify table access first
      await this.verifyTableAccess('resume_analyses');

      const timestamp = new Date().toISOString();
      const id = Date.now().toString();
      console.log('Generated ID:', id);

      // Prepare row data
      const row = {
        id,
        fileName: insertAnalysis.fileName,
        uploadedAt: timestamp,
        status: insertAnalysis.status,
        results: '{}'  // Initialize with empty JSON object
      };

      console.log('Attempting to insert row:', JSON.stringify(row));

      // Insert using direct SQL to ensure consistency
      const insertQuery = `
        INSERT INTO \`${PROJECT_ID}.${DATASET}.resume_analyses\`
        (id, fileName, uploadedAt, status, results)
        VALUES(@id, @fileName, @uploadedAt, @status, @results)
      `;

      await bigquery.query({
        query: insertQuery,
        params: row
      });

      console.log('Successfully inserted row');

      // Fetch the inserted row
      const [result] = await bigquery.query({
        query: `
          SELECT *
          FROM \`${PROJECT_ID}.${DATASET}.resume_analyses\`
          WHERE id = @id
        `,
        params: { id }
      });

      if (!result || !result[0]) {
        throw new Error('Failed to retrieve inserted record');
      }

      console.log('Successfully retrieved inserted record');

      return {
        ...result[0],
        results: {}
      } as ResumeAnalysis;
    } catch (error) {
      console.error('Error in createAnalysis:', error);
      throw new Error(`Failed to create analysis record: ${error.message}`);
    }
  }

  async getAnalysis(id: string): Promise<ResumeAnalysis | undefined> {
    try {
      await this.verifyTableAccess('resume_analyses');
      const [rows] = await bigquery.query({
        query: `
          SELECT 
            id,
            fileName,
            uploadedAt,
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
    try {
      await this.verifyTableAccess('resume_analyses');
      const updateData = {
        ...update,
        results: update.results ? JSON.stringify(update.results) : undefined
      };

      const setClause = Object.entries(updateData)
        .filter(([_, value]) => value !== undefined)
        .map(([key, _]) => `${key} = @${key}`)
        .join(', ');

      await bigquery.query({
        query: `
          UPDATE \`${PROJECT_ID}.${DATASET}.resume_analyses\`
          SET ${setClause}
          WHERE id = @id
        `,
        params: { ...updateData, id }
      });

      return this.getAnalysis(id) as Promise<ResumeAnalysis>;
    } catch (error) {
      console.error('Error in updateAnalysis:', error);
      throw new Error('Failed to update analysis');
    }
  }

  async createScore(insertScore: InsertScore): Promise<ResumeScore> {
    try {
      await this.verifyTableAccess('resume_scores');
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
      await this.verifyTableAccess('resume_analyses');
      await this.verifyTableAccess('resume_scores');
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
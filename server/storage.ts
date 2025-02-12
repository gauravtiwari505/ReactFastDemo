import { bigquery } from "./db";
import type { 
  ResumeAnalysis, 
  InsertAnalysis, 
  ResumeScore, 
  InsertScore 
} from "@shared/schema";

// Get project ID from environment
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const DATASET = 'gigflick';

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
  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<ResumeAnalysis> {
    const table = bigquery
      .dataset(DATASET)
      .table('resume_analyses');

    // Convert any JSON fields to strings for storage
    const rows = [{
      ...insertAnalysis,
      id: Date.now().toString(),
      results: typeof insertAnalysis.results === 'object' 
        ? JSON.stringify(insertAnalysis.results)
        : insertAnalysis.results
    }];

    try {
      await table.insert(rows);

      // Return the inserted row
      const [result] = await bigquery.query({
        query: `
          SELECT 
            id,
            fileName,
            uploadedAt,
            status,
            PARSE_JSON(results) as results
          FROM \`${PROJECT_ID}.${DATASET}.resume_analyses\`
          WHERE id = @id
        `,
        params: { id: rows[0].id }
      });

      return {
        ...result[0],
        results: JSON.parse(result[0].results || '{}')
      } as ResumeAnalysis;
    } catch (error) {
      console.error('Error in createAnalysis:', error);
      throw new Error('Failed to create analysis record');
    }
  }

  async getAnalysis(id: string): Promise<ResumeAnalysis | undefined> {
    try {
      const [rows] = await bigquery.query({
        query: `
          SELECT 
            id,
            fileName,
            uploadedAt,
            status,
            PARSE_JSON(results) as results
          FROM \`${PROJECT_ID}.${DATASET}.resume_analyses\`
          WHERE id = @id
        `,
        params: { id }
      });

      if (!rows[0]) return undefined;

      return {
        ...rows[0],
        results: JSON.parse(rows[0].results || '{}')
      } as ResumeAnalysis;
    } catch (error) {
      console.error('Error in getAnalysis:', error);
      throw new Error('Failed to retrieve analysis');
    }
  }

  async updateAnalysis(id: string, update: Partial<ResumeAnalysis>): Promise<ResumeAnalysis> {
    try {
      // Convert any JSON fields to strings for storage
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
    const table = bigquery
      .dataset(DATASET)
      .table('resume_scores');

    const rows = [{
      ...insertScore,
      id: Date.now().toString(),
      suggestions: typeof insertScore.suggestions === 'object'
        ? JSON.stringify(insertScore.suggestions)
        : insertScore.suggestions
    }];

    try {
      await table.insert(rows);

      // Return the inserted row
      const [result] = await bigquery.query({
        query: `
          SELECT 
            id,
            analysisId,
            sectionName,
            score,
            feedback,
            PARSE_JSON(suggestions) as suggestions
          FROM \`${PROJECT_ID}.${DATASET}.resume_scores\`
          WHERE id = @id
        `,
        params: { id: rows[0].id }
      });

      return {
        ...result[0],
        suggestions: JSON.parse(result[0].suggestions || '[]')
      } as ResumeScore;
    } catch (error) {
      console.error('Error in createScore:', error);
      throw new Error('Failed to create score record');
    }
  }

  async getAnalytics() {
    try {
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
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

    const rows = [{
      ...insertAnalysis,
      id: Date.now().toString()
    }];

    await table.insert(rows);

    // Return the inserted row
    const [result] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${PROJECT_ID}.${DATASET}.resume_analyses\`
        WHERE id = @id
      `,
      params: { id: rows[0].id }
    });

    return result[0] as ResumeAnalysis;
  }

  async getAnalysis(id: string): Promise<ResumeAnalysis | undefined> {
    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${PROJECT_ID}.${DATASET}.resume_analyses\`
        WHERE id = @id
      `,
      params: { id }
    });

    return rows[0] as ResumeAnalysis | undefined;
  }

  async updateAnalysis(id: string, update: Partial<ResumeAnalysis>): Promise<ResumeAnalysis> {
    const setClause = Object.entries(update)
      .map(([key, _]) => `${key} = @${key}`)
      .join(', ');

    await bigquery.query({
      query: `
        UPDATE \`${PROJECT_ID}.${DATASET}.resume_analyses\`
        SET ${setClause}
        WHERE id = @id
      `,
      params: { ...update, id }
    });

    return this.getAnalysis(id) as Promise<ResumeAnalysis>;
  }

  async createScore(insertScore: InsertScore): Promise<ResumeScore> {
    const table = bigquery
      .dataset(DATASET)
      .table('resume_scores');

    const rows = [{
      ...insertScore,
      id: Date.now().toString()
    }];

    await table.insert(rows);

    // Return the inserted row
    const [result] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${PROJECT_ID}.${DATASET}.resume_scores\`
        WHERE id = @id
      `,
      params: { id: rows[0].id }
    });

    return result[0] as ResumeScore;
  }

  async getAnalytics() {
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
  }
}

export const storage = new BigQueryStorage();
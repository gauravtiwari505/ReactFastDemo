import { bigquery } from "./db";
import type { 
  ResumeAnalysis, 
  InsertAnalysis, 
  ResumeScore, 
  InsertScore 
} from "@shared/schema";

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
    const [job] = await bigquery
      .dataset(DATASET)
      .table('resume_analyses')
      .insert([{
        ...insertAnalysis,
        id: Date.now().toString()
      }]);

    const [analysis] = await job.getQueryResults();
    return analysis as ResumeAnalysis;
  }

  async getAnalysis(id: string): Promise<ResumeAnalysis | undefined> {
    const query = `
      SELECT *
      FROM ${DATASET}.resume_analyses
      WHERE id = @id
    `;

    const options = {
      query,
      params: { id }
    };

    const [rows] = await bigquery.query(options);
    return rows[0] as ResumeAnalysis | undefined;
  }

  async updateAnalysis(id: string, update: Partial<ResumeAnalysis>): Promise<ResumeAnalysis> {
    const query = `
      UPDATE ${DATASET}.resume_analyses
      SET ${Object.entries(update)
        .map(([key, _]) => `${key} = @${key}`)
        .join(', ')}
      WHERE id = @id
    `;

    const options = {
      query,
      params: { ...update, id }
    };

    await bigquery.query(options);
    return this.getAnalysis(id) as Promise<ResumeAnalysis>;
  }

  async createScore(insertScore: InsertScore): Promise<ResumeScore> {
    const [job] = await bigquery
      .dataset(DATASET)
      .table('resume_scores')
      .insert([{
        ...insertScore,
        id: Date.now().toString()
      }]);

    const [score] = await job.getQueryResults();
    return score as ResumeScore;
  }

  async getAnalytics() {
    const query = `
      WITH ScoreStats AS (
        SELECT
          COUNT(DISTINCT a.id) as totalResumes,
          AVG(s.score) as averageScore
        FROM ${DATASET}.resume_analyses a
        LEFT JOIN ${DATASET}.resume_scores s ON a.id = s.analysisId
      ),
      SectionStats AS (
        SELECT
          sectionName,
          AVG(score) as averageScore,
          COUNT(*) as totalAnalyses
        FROM ${DATASET}.resume_scores
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
    `;

    const [rows] = await bigquery.query({ query });
    const result = rows[0];

    return {
      totalResumes: Number(result.totalResumes || 0),
      averageScore: Number(result.averageScore || 0),
      sectionAverages: result.sectionAverages.map((section: any) => ({
        sectionName: section.sectionName,
        averageScore: Number(section.averageScore || 0),
        totalAnalyses: Number(section.totalAnalyses || 0),
      })),
    };
  }
}

export const storage = new BigQueryStorage();
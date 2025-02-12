import { BigQuery } from '@google-cloud/bigquery';
import type { 
  ResumeAnalysis, 
  InsertAnalysis, 
  ResumeScore, 
  InsertScore 
} from "@shared/schema";

// Initialize BigQuery client
const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  credentials: JSON.parse(process.env.BIGQUERY_CREDENTIALS || '{}'),
});

// Dataset configuration
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
      .table('resume_analysis')
      .insert([{
        ...insertAnalysis,
        timestamp: new Date().toISOString()
      }]);

    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_analysis\`
        WHERE document_id = @documentId
        ORDER BY timestamp DESC
        LIMIT 1
      `,
      params: { documentId: insertAnalysis.document_id }
    });

    return rows[0] as ResumeAnalysis;
  }

  async getAnalysis(id: string): Promise<ResumeAnalysis | undefined> {
    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_analysis\`
        WHERE id = @id
      `,
      params: { id }
    });

    return rows[0] as ResumeAnalysis | undefined;
  }

  async updateAnalysis(id: string, update: Partial<ResumeAnalysis>): Promise<ResumeAnalysis> {
    const setClause = Object.entries(update)
      .map(([key]) => `${key} = @${key}`)
      .join(', ');

    await bigquery.query({
      query: `
        UPDATE \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_analysis\`
        SET ${setClause}
        WHERE id = @id
      `,
      params: { id, ...update }
    });

    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_analysis\`
        WHERE id = @id
      `,
      params: { id }
    });

    return rows[0] as ResumeAnalysis;
  }

  async createScore(insertScore: InsertScore): Promise<ResumeScore> {
    const [job] = await bigquery
      .dataset(DATASET)
      .table('resume_scores')
      .insert([insertScore]);

    const [rows] = await bigquery.query({
      query: `
        SELECT *
        FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_scores\`
        WHERE analysis_id = @analysisId
        AND section_name = @sectionName
        ORDER BY timestamp DESC
        LIMIT 1
      `,
      params: { 
        analysisId: insertScore.analysis_id,
        sectionName: insertScore.section_name
      }
    });

    return rows[0] as ResumeScore;
  }

  async getAnalytics() {
    const [rows] = await bigquery.query({
      query: `
        WITH ScoreStats AS (
          SELECT
            COUNT(DISTINCT a.id) as total_resumes,
            AVG(s.score) as average_score
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_analysis\` a
          LEFT JOIN \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_scores\` s 
          ON a.id = s.analysis_id
        ),
        SectionStats AS (
          SELECT
            section_name,
            AVG(score) as average_score,
            COUNT(*) as total_analyses
          FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.${DATASET}.resume_scores\`
          GROUP BY section_name
        )
        SELECT
          s.total_resumes,
          s.average_score,
          ARRAY_AGG(STRUCT(
            ss.section_name as sectionName,
            ss.average_score as averageScore,
            ss.total_analyses as totalAnalyses
          )) as section_averages
        FROM ScoreStats s
        CROSS JOIN SectionStats ss
        GROUP BY s.total_resumes, s.average_score
      `
    });

    const result = rows[0];
    return {
      totalResumes: Number(result?.total_resumes || 0),
      averageScore: Number(result?.average_score || 0),
      sectionAverages: (result?.section_averages || []).map((section: any) => ({
        sectionName: section.sectionName,
        averageScore: Number(section.averageScore || 0),
        totalAnalyses: Number(section.totalAnalyses || 0)
      }))
    };
  }
}

export const storage = new BigQueryStorage();
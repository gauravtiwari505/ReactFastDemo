import { BigQuery } from '@google-cloud/bigquery';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Schema validation
export const resumeAnalysisSchema = z.object({
  id: z.string(),
  candidateName: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  timestamp: z.string()
});

export const resumeScoreSchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  sectionName: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string()
});

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;
export type ResumeScore = z.infer<typeof resumeScoreSchema>;

// BigQuery client initialization with error handling
let bigquery: BigQuery;
try {
  bigquery = new BigQuery({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    credentials: JSON.parse(process.env.BIGQUERY_CREDENTIALS || '{}'),
  });
} catch (error) {
  console.error('Failed to initialize BigQuery client:', error);
  throw new Error('BigQuery initialization failed');
}

export async function analyzeResume(documentId: string): Promise<ResumeAnalysis> {
  const analysisId = randomUUID();
  const timestamp = new Date().toISOString();

  try {
    // Insert analysis record into BigQuery
    const analysisQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT}.gigflick.resume_analysis\`
      (id, document_id, candidate_name, score, feedback, timestamp)
      VALUES(?, ?, ?, ?, ?, ?)
    `;

    await bigquery.query({
      query: analysisQuery,
      params: [analysisId, documentId, "Test Candidate", 85, "Good resume overall", timestamp]
    });

    const analysis = {
      id: analysisId,
      candidateName: "Test Candidate",
      score: 85,
      feedback: "Good resume overall",
      timestamp
    };

    return resumeAnalysisSchema.parse(analysis);
  } catch (error) {
    console.error('Error analyzing resume:', error);
    throw new Error('Failed to analyze resume');
  }
}

export async function getResumeAnalysis(analysisId: string): Promise<ResumeAnalysis | null> {
  try {
    const query = `
      SELECT id, candidate_name as candidateName, score, feedback, timestamp
      FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.gigflick.resume_analysis\`
      WHERE id = ?
    `;

    const [rows] = await bigquery.query({
      query,
      params: [analysisId]
    });

    if (!rows[0]) return null;
    return resumeAnalysisSchema.parse(rows[0]);
  } catch (error) {
    console.error('Error getting resume analysis:', error);
    throw new Error('Failed to get resume analysis');
  }
}

export async function saveResumeScore(score: Omit<ResumeScore, "id">): Promise<ResumeScore> {
  try {
    const id = randomUUID();
    const scoreQuery = `
      INSERT INTO \`${process.env.GOOGLE_CLOUD_PROJECT}.gigflick.resume_scores\`
      (id, analysis_id, section_name, score, feedback)
      VALUES(?, ?, ?, ?, ?)
    `;

    await bigquery.query({
      query: scoreQuery,
      params: [id, score.analysisId, score.sectionName, score.score, score.feedback]
    });

    const savedScore = {
      id,
      ...score
    };

    return resumeScoreSchema.parse(savedScore);
  } catch (error) {
    console.error('Error saving resume score:', error);
    throw new Error('Failed to save resume score');
  }
}
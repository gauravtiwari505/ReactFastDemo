import { BigQuery } from '@google-cloud/bigquery';
import { randomUUID } from 'crypto';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  credentials: JSON.parse(process.env.BIGQUERY_CREDENTIALS || '{}'),
});

export interface ResumeAnalysis {
  id: string;
  candidateName: string;
  score: number;
  feedback: string;
  timestamp: string;
}

export interface ResumeScore {
  id: string;
  analysisId: string;
  sectionName: string;
  score: number;
  feedback: string;
}

export async function analyzeResume(documentId: string): Promise<ResumeAnalysis> {
  const analysisId = randomUUID();
  const timestamp = new Date().toISOString();

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

  return {
    id: analysisId,
    candidateName: "Test Candidate",
    score: 85,
    feedback: "Good resume overall",
    timestamp
  };
}

export async function getResumeAnalysis(analysisId: string): Promise<ResumeAnalysis | null> {
  const query = `
    SELECT id, candidate_name as candidateName, score, feedback, timestamp
    FROM \`${process.env.GOOGLE_CLOUD_PROJECT}.gigflick.resume_analysis\`
    WHERE id = ?
  `;

  const [rows] = await bigquery.query({
    query,
    params: [analysisId]
  });

  return rows[0] || null;
}

export async function saveResumeScore(score: Omit<ResumeScore, "id">): Promise<ResumeScore> {
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

  return {
    id,
    ...score
  };
}

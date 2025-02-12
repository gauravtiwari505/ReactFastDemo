import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { z } from 'zod';
import { storage } from '../storage';

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


export async function analyzeResume(documentId: string): Promise<ResumeAnalysis> {
  try {
    const analysis = await storage.createAnalysis({
      document_id: documentId,
      candidate_name: "Test Candidate",
      score: 85,
      feedback: "Good resume overall"
    });

    return resumeAnalysisSchema.parse(analysis);
  } catch (error) {
    console.error('Error analyzing resume:', error);
    throw new Error('Failed to analyze resume');
  }
}

export async function getResumeAnalysis(analysisId: string): Promise<ResumeAnalysis | null> {
  try {
    const analysis = await storage.getAnalysis(analysisId);
    if (!analysis) return null;
    return resumeAnalysisSchema.parse(analysis);
  } catch (error) {
    console.error('Error getting resume analysis:', error);
    throw new Error('Failed to get resume analysis');
  }
}

export async function saveResumeScore(score: Omit<ResumeScore, "id">): Promise<ResumeScore> {
  try {
    const savedScore = await storage.createScore({
      analysis_id: score.analysisId,
      section_name: score.sectionName,
      score: score.score,
      feedback: score.feedback
    });

    return resumeScoreSchema.parse(savedScore);
  } catch (error) {
    console.error('Error saving resume score:', error);
    throw new Error('Failed to save resume score');
  }
}
import { z } from "zod";

// Type definitions for BigQuery tables
export const resumeAnalysisSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  candidate_name: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  timestamp: z.string(),
  results: z.object({
    overview: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    overallScore: z.number(),
    sections: z.array(z.object({
      name: z.string(),
      score: z.number(),
      content: z.string(),
      suggestions: z.array(z.string())
    }))
  }).optional()
});

export const resumeScoreSchema = z.object({
  id: z.string(),
  analysis_id: z.string(),
  section_name: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string()
});

// Types for TypeScript
export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;
export type ResumeScore = z.infer<typeof resumeScoreSchema>;

// Insert types without auto-generated fields
export type InsertAnalysis = Omit<ResumeAnalysis, 'id' | 'timestamp'>;
export type InsertScore = Omit<ResumeScore, 'id'>;
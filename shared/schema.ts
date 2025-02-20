import { z } from "zod";

// Type definitions for BigQuery tables
export const resumeAnalysisSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  uploadedAt: z.string(),  // Keep the old name in the interface for backward compatibility
  status: z.string(),
  statusMessage: z.string().optional(),
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
  analysisId: z.string(), 
  sectionName: z.string(),
  score: z.number(),
  feedback: z.string(),
  suggestions: z.array(z.string()),
  timestamp: z.string()
});

// Types for TypeScript
export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;
export type ResumeScore = z.infer<typeof resumeScoreSchema>;

// Insert types without auto-generated fields
export type InsertAnalysis = Omit<ResumeAnalysis, 'id' | 'results'>;
export type InsertScore = Omit<ResumeScore, 'id'>;
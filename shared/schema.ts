import { z } from "zod";

// BigQuery schema definitions
export const resumeAnalysisSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  uploadedAt: z.string(),
  status: z.string(),
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

// Insert schemas (without auto-generated fields)
export const insertAnalysisSchema = resumeAnalysisSchema.omit({ 
  id: true,
  results: true 
});

export const insertScoreSchema = resumeScoreSchema.omit({ 
  id: true 
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type InsertScore = z.infer<typeof insertScoreSchema>;
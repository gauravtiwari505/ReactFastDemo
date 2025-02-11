import { pgTable, text, serial, json, integer, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const resumeAnalyses = pgTable("resume_analyses", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
  status: text("status").notNull(),
  results: json("results").$type<{
    overview: string;
    strengths: string[];
    weaknesses: string[];
    overallScore: number;
    sections: {
      name: string;
      score: number;
      content: string;
      suggestions: string[];
    }[];
    accessibility: {
      score: number;
      issues: {
        type: string;
        description: string;
        severity: 'high' | 'medium' | 'low';
        suggestion: string;
      }[];
      overallFeedback: string;
    };
  }>(),
  emailTo: text("email_to"),
  emailSentAt: text("email_sent_at"),
});

export const resumeScores = pgTable("resume_scores", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").references(() => resumeAnalyses.id).notNull(),
  sectionName: text("section_name").notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback").notNull(),
  suggestions: json("suggestions").$type<string[]>(),
  timestamp: text("timestamp").notNull(),
});

// Schema for inserting new analysis
export const insertAnalysisSchema = createInsertSchema(resumeAnalyses).pick({
  fileName: true,
  uploadedAt: true,
  status: true,
  emailTo: true,
});

// Schema for inserting new scores
export const insertScoreSchema = createInsertSchema(resumeScores).omit({
  id: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof resumeAnalyses.$inferSelect;
export type InsertScore = z.infer<typeof insertScoreSchema>;
export type Score = typeof resumeScores.$inferSelect;
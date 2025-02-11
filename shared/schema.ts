import { pgTable, text, serial, json } from "drizzle-orm/pg-core";
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
  }>(),
});

export const insertAnalysisSchema = createInsertSchema(resumeAnalyses).pick({
  fileName: true,
  uploadedAt: true,
  status: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof resumeAnalyses.$inferSelect;
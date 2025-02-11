import { resumeAnalyses, resumeScores, type Analysis, type InsertAnalysis, type Score, type InsertScore } from "@shared/schema";
import { db } from "./db";
import { eq, avg, count } from "drizzle-orm";

export interface IStorage {
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: number): Promise<Analysis | undefined>;
  updateAnalysis(id: number, analysis: Partial<Analysis>): Promise<Analysis>;
  createScore(score: InsertScore): Promise<Score>;
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

export class DatabaseStorage implements IStorage {
  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const [analysis] = await db
      .insert(resumeAnalyses)
      .values(insertAnalysis)
      .returning();
    return analysis;
  }

  async getAnalysis(id: number): Promise<Analysis | undefined> {
    const [analysis] = await db
      .select()
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.id, id));
    return analysis;
  }

  async updateAnalysis(id: number, update: Partial<Analysis>): Promise<Analysis> {
    const [analysis] = await db
      .update(resumeAnalyses)
      .set(update)
      .where(eq(resumeAnalyses.id, id))
      .returning();

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    return analysis;
  }

  async createScore(insertScore: InsertScore): Promise<Score> {
    const [score] = await db
      .insert(resumeScores)
      .values(insertScore)
      .returning();
    return score;
  }

  async getAnalytics() {
    // Get total number of resumes and average overall score
    const [totals] = await db
      .select({
        totalResumes: count(resumeAnalyses.id),
        averageScore: avg(resumeScores.score),
      })
      .from(resumeAnalyses)
      .leftJoin(resumeScores, eq(resumeAnalyses.id, resumeScores.analysisId));

    // Get average scores by section
    const sectionAverages = await db
      .select({
        sectionName: resumeScores.sectionName,
        averageScore: avg(resumeScores.score),
        totalAnalyses: count(resumeScores.id),
      })
      .from(resumeScores)
      .groupBy(resumeScores.sectionName);

    return {
      totalResumes: Number(totals?.totalResumes || 0),
      averageScore: Number(totals?.averageScore || 0),
      sectionAverages: sectionAverages.map(section => ({
        sectionName: section.sectionName,
        averageScore: Number(section.averageScore || 0),
        totalAnalyses: Number(section.totalAnalyses || 0),
      })),
    };
  }
}

export const storage = new DatabaseStorage();
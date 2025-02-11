import { resumeAnalyses, type Analysis, type InsertAnalysis } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: number): Promise<Analysis | undefined>;
  updateAnalysis(id: number, analysis: Partial<Analysis>): Promise<Analysis>;
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
}

export const storage = new DatabaseStorage();
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { insertAnalysisSchema } from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export function registerRoutes(app: Express): Server {
  app.post("/api/analyze", upload.single("resume"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No PDF file provided" });
    }

    const analysis = await storage.createAnalysis({
      fileName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      status: "processing"
    });

    // Simulate analysis after 2 seconds
    setTimeout(async () => {
      await storage.updateAnalysis(analysis.id, {
        status: "completed",
        results: {
          sections: [
            {
              name: "Professional Summary",
              score: 85,
              suggestions: ["Add more quantifiable achievements"]
            },
            {
              name: "Work Experience",
              score: 90,
              suggestions: ["Use more action verbs"]
            },
            {
              name: "Education",
              score: 95,
              suggestions: ["Consider adding relevant coursework"]
            }
          ],
          overallScore: 90
        }
      });
    }, 2000);

    res.json(analysis);
  });

  app.get("/api/analysis/:id", async (req, res) => {
    const analysis = await storage.getAnalysis(Number(req.params.id));
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }
    res.json(analysis);
  });

  const httpServer = createServer(app);
  return httpServer;
}

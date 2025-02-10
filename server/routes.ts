import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { insertAnalysisSchema } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";

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

async function analyzePDF(fileBuffer: Buffer, filename: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [
      "server/resume_service.py",
    ]);

    let resultData = "";

    pythonProcess.stdout.on("data", (data) => {
      resultData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python Error: ${data}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}`));
        return;
      }
      try {
        const results = JSON.parse(resultData);
        resolve(results);
      } catch (err) {
        reject(new Error("Failed to parse Python output"));
      }
    });

    // Send the PDF data to Python process
    pythonProcess.stdin.write(JSON.stringify({
      file_bytes: fileBuffer.toString("base64"),
      filename: filename
    }));
    pythonProcess.stdin.end();
  });
}

export function registerRoutes(app: Express): Server {
  app.post("/api/analyze", upload.single("resume"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No PDF file provided" });
    }

    try {
      const analysis = await storage.createAnalysis({
        fileName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        status: "processing"
      });

      // Process the PDF using our Python service
      const results = await analyzePDF(req.file.buffer, req.file.originalname);

      // Update analysis with results
      await storage.updateAnalysis(analysis.id, {
        status: "completed",
        results: results
      });

      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze resume" });
    }
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
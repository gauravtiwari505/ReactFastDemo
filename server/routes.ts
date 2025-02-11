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

    let stdoutData = "";
    let stderrData = "";

    // Collect stdout data
    pythonProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    // Collect stderr data separately for debugging
    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python Error: ${data}`);
      stderrData += data.toString();
    });

    pythonProcess.on("close", (code) => {
      console.log("Python process output:", stdoutData);

      if (code !== 0) {
        reject(new Error(`Python process failed with code ${code}. Error: ${stderrData}`));
        return;
      }

      try {
        const cleanedOutput = stdoutData.trim();
        if (!cleanedOutput) {
          reject(new Error("No output from Python process"));
          return;
        }

        const results = JSON.parse(cleanedOutput);
        if (results.error) {
          reject(new Error(results.message));
          return;
        }

        resolve(results);
      } catch (err) {
        console.error("Failed to parse Python output. Raw output:", stdoutData);
        reject(new Error(`Failed to parse Python output: ${err.message}`));
      }
    });

    // Send input to Python process
    pythonProcess.stdin.write(JSON.stringify({
      file_bytes: fileBuffer.toString("base64"),
      filename: filename
    }));
    pythonProcess.stdin.end();
  });
}

async function checkAccessibility(fileBuffer: Buffer): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [
      "server/pdf_accessibility.py",
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

    pythonProcess.stdin.write(JSON.stringify({
      file_bytes: fileBuffer.toString("base64")
    }));
    pythonProcess.stdin.end();
  });
}

async function generateAndSendReport(analysis: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [
      "server/report_service.py",
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
      resolve();
    });

    pythonProcess.stdin.write(JSON.stringify(analysis));
    pythonProcess.stdin.end();
  });
}

export function registerRoutes(app: Express): Server {
  // Initial analysis endpoint without email
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

      // Check accessibility
      const accessibilityResults = await checkAccessibility(req.file.buffer);
      results.accessibility = accessibilityResults;

      // Update analysis with results
      const updatedAnalysis = await storage.updateAnalysis(analysis.id, {
        status: "completed",
        results: results
      });

      // Store section scores
      if (results.sections) {
        for (const section of results.sections) {
          await storage.createScore({
            analysisId: analysis.id,
            sectionName: section.name,
            score: section.score,
            feedback: section.content,
            suggestions: section.suggestions,
            timestamp: new Date().toISOString()
          });
        }
      }

      res.json(updatedAnalysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: error.message || "Failed to analyze resume" });
    }
  });

  // New endpoint for sending email report
  app.post("/api/analysis/:id/send-report", async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email address is required" });
    }

    try {
      const analysis = await storage.getAnalysis(Number(req.params.id));
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      await generateAndSendReport(analysis);

      // Update analysis with email information
      await storage.updateAnalysis(analysis.id, {
        emailTo: email,
        emailSentAt: new Date().toISOString()
      });

      res.json({ message: "Report sent successfully" });
    } catch (error) {
      console.error("Failed to send report:", error);
      res.status(500).json({ message: "Failed to send report" });
    }
  });

  app.get("/api/analysis/:id", async (req, res) => {
    const analysis = await storage.getAnalysis(Number(req.params.id));
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }
    res.json(analysis);
  });

  app.get("/api/analytics", async (_req, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
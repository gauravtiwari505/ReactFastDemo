import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { insertAnalysisSchema, insertScoreSchema } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";

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

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gaurav@metalytics.uk',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function generateAnalysisPDF(analysis: any): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Generate HTML content with styling
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              color: #333;
            }
            h1 {
              color: #1a365d;
              text-align: center;
              font-size: 28px;
              margin-bottom: 30px;
            }
            .overview {
              background: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .score-section {
              background: #f0f9ff;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .score {
              font-size: 24px;
              color: #0369a1;
              font-weight: bold;
            }
            .section {
              margin-bottom: 30px;
            }
            .section h2 {
              color: #0369a1;
              font-size: 20px;
              margin-bottom: 15px;
            }
            .strengths {
              color: #15803d;
            }
            .improvements {
              color: #b91c1c;
            }
            ul {
              margin: 0;
              padding-left: 20px;
            }
            li {
              margin-bottom: 8px;
              line-height: 1.5;
            }
            .section-analysis {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 20px;
              margin-bottom: 20px;
            }
            .section-score {
              color: #0369a1;
              font-weight: bold;
            }
            .suggestions {
              background: #f0f9ff;
              padding: 15px;
              border-radius: 4px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <h1>Resume Analysis Report</h1>

          <div class="overview">
            <h2>Overview</h2>
            <p>${analysis.results.overview}</p>
          </div>

          <div class="score-section">
            <h2>Overall Score</h2>
            <div class="score">${analysis.results.overallScore}%</div>
          </div>

          <div class="section">
            <h2 class="strengths">Key Strengths</h2>
            <ul>
              ${analysis.results.strengths.map((s: string) => `<li>${s}</li>`).join('')}
            </ul>
          </div>

          <div class="section">
            <h2 class="improvements">Areas for Improvement</h2>
            <ul>
              ${analysis.results.weaknesses.map((w: string) => `<li>${w}</li>`).join('')}
            </ul>
          </div>

          <div class="section">
            <h2>Detailed Section Analysis</h2>
            ${analysis.results.sections.map((section: any) => `
              <div class="section-analysis">
                <h3>${section.name} <span class="section-score">${section.score}%</span></h3>
                <p>${section.content}</p>
                <div class="suggestions">
                  <h4>Suggestions for Improvement:</h4>
                  <ul>
                    ${section.suggestions.map((s: string) => `<li>${s}</li>`).join('')}
                  </ul>
                </div>
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `;

    await page.setContent(content);
    await page.emulateMediaType('screen');

    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    return pdf;
  } finally {
    await browser.close();
  }
}

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

  app.post("/api/analysis/:id/send-pdf", async (req, res) => {
    try {
      const { email } = req.body;
      const analysis = await storage.getAnalysis(Number(req.params.id));

      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      // Generate PDF
      const pdfBuffer = await generateAnalysisPDF(analysis);

      // Send email with PDF attachment
      await transporter.sendMail({
        from: 'gaurav@metalytics.uk',
        to: email,
        subject: 'Your Resume Analysis Report',
        text: 'Please find attached your resume analysis report from GigFlick.',
        attachments: [{
          filename: 'resume-analysis.pdf',
          content: pdfBuffer
        }]
      });

      res.json({ message: "PDF sent successfully" });
    } catch (error) {
      console.error("Error sending PDF:", error);
      res.status(500).json({ message: "Failed to send PDF" });
    }
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
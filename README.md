CREATE TABLE resume_analyses (
    id STRING,
    fileName STRING,
    uploadedAt STRING,
    status STRING,
    results JSON
);
```

### Resume Scores Table
```sql
CREATE TABLE resume_scores (
    id STRING,
    analysisId STRING,
    sectionName STRING,
    score INTEGER,
    feedback STRING,
    suggestions JSON,
    timestamp STRING
);
```

## 🚀 Installation

1. **Clone the Repository**
```bash
git clone <repository-url>
cd gigflick
```

2. **Install Dependencies**
```bash
npm install
```

3. **Environment Setup**
- Copy `.env.example` to `.env`
- Configure required credentials:
  - `BIGQUERY_CREDENTIALS`: BigQuery service account credentials
  - `GEMINI_API_KEY`: Google Gemini API key
  - `GMAIL_APP_PASSWORD`: Gmail app password for notifications
  - `DATABASE_URL`: PostgreSQL database URL

4. **Gmail Configuration**
- Enable 2-Step Verification in your Google Account
- Generate an App Password:
  1. Go to Google Account Settings
  2. Security > 2-Step Verification
  3. Scroll to "App passwords"
  4. Generate a new password for "Mail"
- Add the generated password to `.env` as `GMAIL_APP_PASSWORD`

5. **Start Development Server**
```bash
npm run dev
```

## 🏗️ Project Structure

```
gigflick/
├── client/          # React frontend
│   ├── src/
│   ├── components/  # Reusable UI components
│   └── pages/       # Route components
├── server/          # Express backend
│   ├── routes/      # API endpoints
│   ├── services/    # Business logic
│   └── resume_service.py  # Python AI service
├── shared/          # Shared types and schemas
└── ...
```

## 📚 API Documentation

### Resume Analysis Endpoints

#### Upload and Analyze Resume
```http
POST /api/analyze
Content-Type: multipart/form-data

file: <resume.pdf>
```

#### Get Analysis Results
```http
GET /api/analysis/:id
```

#### Send PDF Report
```http
POST /api/analysis/:id/send-pdf
Content-Type: application/json

{
    "email": "user@example.com"
}
```

### Response Format
```json
{
    "id": "string",
    "fileName": "string",
    "status": "processing|completed|error",
    "results": {
        "sections": [{
            "name": "string",
            "score": number,
            "feedback": "string",
            "suggestions": []
        }]
    }
}
CREATE TABLE resume_analyses (
    id STRING,
    fileName STRING,
    uploadedAt STRING,
    status STRING,
    results JSON
);
```

#### Table: resume_scores
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

### Installation Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd gigflick
```

2. Install Dependencies:
```bash
npm install
```

3. Set up Environment Variables:
   1. Copy `.env.example` to `.env`
   2. Fill in your BigQuery credentials and other configuration
   3. For Gmail configuration:
      - Enable 2-Step Verification in your Google Account
      - Generate an App Password:
        - Go to Google Account Settings
        - Security > 2-Step Verification
        - Scroll to "App passwords"
        - Generate a new password for "Mail"
      - Add the generated password to your .env file as GMAIL_APP_PASSWORD

4. Start Development Server:
```bash
npm run dev
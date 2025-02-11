# Database (for local development)
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/gigflick

# Email (Gmail)
GMAIL_APP_PASSWORD=your_app_password
```

### Database Schema
The application uses PostgreSQL with Drizzle ORM. Here's the current schema:

#### Table: resume_analyses
```sql
CREATE TABLE resume_analyses (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    status TEXT NOT NULL,
    results JSONB,
    email_to TEXT,
    email_sent_at TEXT
);
```

#### Table: resume_scores
```sql
CREATE TABLE resume_scores (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES resume_analyses(id),
    section_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    suggestions JSONB,
    timestamp TEXT NOT NULL
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

3. Set up Local Database:
```bash
# Create PostgreSQL database
createdb gigflick

# Push schema to database (this will create all tables)
npm run db:push
```

4. Configure Gmail for PDF Sending:
   1. Enable 2-Step Verification in your Google Account
   2. Generate an App Password:
      - Go to Google Account Settings
      - Security > 2-Step Verification
      - Scroll to "App passwords"
      - Generate a new password for "Mail"
   3. Add the generated password to your .env file as GMAIL_APP_PASSWORD

5. Start Development Server:
```bash
npm run dev
```

The application will be available at http://localhost:3000

### Key Files and Their Purposes
- `shared/schema.ts`: Database schema and type definitions using Drizzle ORM
- `server/db.ts`: Database connection configuration
- `server/storage.ts`: Data access layer implementation
- `server/routes.ts`: API endpoints implementation
- `drizzle.config.ts`: Drizzle ORM configuration

### API Routes
- POST `/api/analyze`: Upload and analyze resume
- GET `/api/analysis/:id`: Get analysis results
- POST `/api/analysis/:id/send-pdf`: Send PDF report
- GET `/api/analytics`: Get analytics data

### Frontend Routes
- `/`: Home page with resume upload
- `/analysis/:id`: Analysis results page
- `/analytics`: Analytics dashboard

### Database Migration from Production to Local
If you need to migrate data from the production Neon database to your local instance:

1. Export data from production:
```bash
pg_dump -h <neon-host> -U <neon-user> -d neondb > gigflick_backup.sql
```

2. Import to local database:
```bash
psql -d gigflick < gigflick_backup.sql
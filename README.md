# FinonexETL

A Node.js-based ETL (Extract, Transform, Load) system for processing financial events and managing user revenue data.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Running Instructions](#running-instructions)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

FinonexETL is a financial data processing system that:
- Processes event data from JSONL files
- Calculates and stores user revenue information
- Provides RESTful API endpoints for data access
- Ensures data integrity with file locking mechanisms
- Supports batch processing for large datasets

## Features

- 📊 **Event Processing**: Processes financial events from JSONL files
- 💰 **Revenue Calculation**: Automatically calculates and updates user revenue
- 🔒 **Data Integrity**: Uses file locking to prevent concurrent processing issues
- 🚀 **Batch Processing**: Efficiently handles large datasets in configurable batches
- 🔍 **REST API**: Query user revenue data via HTTP endpoints
- 📦 **PostgreSQL Integration**: Robust database storage and retrieval

## Prerequisites

Before running this application, ensure you have:

- **Node.js** (v14+ recommended)
- **PostgreSQL** (v12+ recommended)
- **npm** package manager
- **Windows:** Administrator privileges (required for PostgreSQL service management)

## Installation

### 1. Package Dependencies

The `package.json` file contains all project metadata and dependencies:

```cmd
# Windows Command Prompt / PowerShell:
# Install all dependencies listed in package.json
npm install

# This installs:
# - express: Web server framework
# - pg: PostgreSQL client
# - axios: HTTP client for API calls
# - proper-lockfile: File locking mechanism
# - nodemon: Development auto-reload (dev dependency)
```

**Available Scripts in package.json:**
- `npm run server` - Start production server
- `npm run dev-server` - Start development server with auto-reload
- `npm run client` - Run the event client
- `npm run data-processor` - Process events from files

### 2. Clone Repository
```cmd
# Windows Command Prompt / PowerShell (Run as Administrator):
git clone https://github.com/dardar4/FinonexETL.git
cd FinonexETL
npm install
```

**⚠️ Important:** Run Command Prompt or PowerShell **as Administrator** for proper service management and permissions.

## Database Setup

### Setting up PostgreSQL Database

The `db.sql` file contains the database schema. You can run it using several methods:

#### Option 1: PostgreSQL Command Line (psql)
```cmd
# IMPORTANT: Run these commands from the project directory (where db.sql is located)
# Windows Command Prompt / PowerShell (as Administrator):
cd C:\path\to\FinonexETL

# Connect to PostgreSQL and run the script
psql -U postgres -d postgres -f db.sql

# Or step by step:
psql -U postgres -d postgres
\i db.sql
\q
```

#### Option 2: Using DBeaver or other PostgreSQL IDE
1. Open DBeaver or your preferred PostgreSQL IDE
2. Connect to your PostgreSQL instance
3. Open the `db.sql` file in the SQL editor
4. Execute the script (usually Ctrl+Enter or F5)


## Configuration

### Database Configuration

Update the database settings in **both** `server.js` and `data_processor.js`:

```javascript
// Change these values to match your PostgreSQL setup
const dbConfig = {
    user: 'postgres',        // Your PostgreSQL username
    host: 'localhost',       // Database host
    database: 'postgres',    // Database name ('postgres' is the default db)
    password: '1234',        // Your PostgreSQL password
    port: 5432,             // PostgreSQL port (default: 5432)
};
```

**To use a different database:**
1. Create a new database: `CREATE DATABASE finonex_etl;`
2. Update the `database` field in both files
3. Run the `db.sql` script on the new database

## Running Instructions

### 1. 🚀 Server (server.js)

**Purpose:** Express.js server providing REST API endpoints for revenue data.

**How to run:**
```cmd
# Windows Command Prompt / PowerShell:
# Production mode
npm run server
# OR
node server.js

# Development mode (auto-restart on changes)
npm run dev-server
# OR
nodemon server.js
```

**Server Configuration:**
- **Port:** 8000 (configurable in server.js)
- **Database:** Update `dbConfig` object in server.js
- **Authentication:** Uses 'secret' as auth token

**Important Files Created:**
- `events-to-process.jsonl` - This file is created by the server when it receives live events via the `/liveEvent` endpoint. The data processor then reads from this file.

**Server Features:**
- **GET /ping** - Health check endpoint (no authentication required)
- **POST /liveEvent** - Receive events and append to `events-to-process.jsonl`
- **GET /users/:userId/revenue** - Get revenue data for specific user

### 2. 📤 Client (client.js)

**Purpose:** Sends events from JSONL files to the server via HTTP API.

**How to run:**
```cmd
# Windows Command Prompt / PowerShell:
npm run client
# OR
node client.js
```

**Event File Format:**
Events must be in JSONL (JSON Lines) format - one JSON object per line:

```json
{"userId": "user1", "name": "add_revenue", "value": 100}
{"userId": "user2", "name": "subtract_revenue", "value": 50}
{"userId": "user1", "name": "add_revenue", "value": 25}
```

**Required Event Fields:**
- `userId` (string): User identifier
- `name` (string): Event type - must be either `"add_revenue"` or `"subtract_revenue"`
- `value` (number): Revenue amount to add or subtract

**File Location:**
- Events files should be in the **same directory** as the project root
- Example files: `events.jsonl`, `events-to-process.jsonl`, `large_revenue.jsonl`

**Client Configuration:**
- **Server URL:** `http://localhost:8000` (default)
- **Auth Token:** `'secret'` (must match server configuration)

### 3. ⚙️ Data Processor (data_processor.js)

**Purpose:** Processes event files and updates user revenue in the database.

**How to run:**

#### Default File Processing:
```cmd
# Windows Command Prompt / PowerShell:
# Processes default file: ./events-to-process.jsonl
npm run data-processor
# OR
node data_processor.js
```

#### Specific File Processing:
```cmd
# Windows Command Prompt / PowerShell:
# Process a specific file from the same directory
node data_processor.js events.jsonl
node data_processor.js large_revenue.jsonl
node data_processor.js my-custom-events.jsonl

# File must be in the same directory as the script
```

**Processing Features:**
- **File Locking:** Prevents concurrent processing of the same file
- **Batch Processing:** Processes users in batches of 500 (configurable)
- **Error Handling:** Skips invalid JSON lines and continues processing
- **Upsert Operations:** Updates existing users or creates new ones

**Event Processing Logic:**
- `add_revenue`: Adds the value to user's total revenue
- `subtract_revenue`: Subtracts the value from user's total revenue
- Invalid event names are logged and skipped

## Project Structure

```
FinonexETL/
├── server.js                   # Express server with API endpoints
├── data_processor.js           # ETL logic for processing events
├── client.js                   # Client for sending events to server
├── db.sql                      # Database schema (users_revenue table)
├── package.json                # Dependencies and npm scripts
├── package-lock.json           # Dependency lock file (auto-generated)
├── events.jsonl                # Sample events file (102 events) *
├── events-to-process.jsonl     # Queue file (created by server) *
└── README.md                   # This documentation
```

**Note:** Files marked with `*` are not source controlled and should be placed manually:
- `events.jsonl` - You need to create this file with your event data
- `events-to-process.jsonl` - This file is automatically created by the server when receiving live events

## API Documentation

### GET /ping
Health check endpoint (no authentication required).

**Response:**
```json
{"status": "ok", "message": "pong"}
```

### POST /liveEvent
Receives events and queues them for processing.

**Headers:**
```bash
Authorization: secret
Content-Type: application/json
```

**Body:**
```json
{"userId": "user123", "name": "add_revenue", "value": 100}
```

### GET /users/:userId/revenue
Returns revenue data for a specific user.

**Parameters:**
- `userId` (string): The user identifier

**Response:**
```json
[
  {
    "user_id": "user123",
    "revenue": 1500,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

**Example:**
```cmd
# Windows Command Prompt / PowerShell:
# If curl is installed:
curl http://localhost:8000/users/user123/revenue

# PowerShell alternative (recommended):
Invoke-RestMethod http://localhost:8000/users/user123/revenue
```

## Development

### Typical Workflow

1. **Start the database:**
   
   **Method 1: Command Line (Administrator required)**
   ```cmd
   # Windows Command Prompt / PowerShell (as Administrator):
   # Check if PostgreSQL service is running (service name may vary by version):
   sc query postgresql-x64-17
   # or try: sc query postgresql-x64-[version]
   # or try: sc query postgresql
   
   # Check the STATE column in the output - should show RUNNING
   # Start if not running:
   net start postgresql-x64-17
   ```
   
   **Method 2: Windows Services GUI**
   ```cmd
   # Open Windows Services Manager:
   services.msc
   ```
   1. Press `Win + R`, type `services.msc`, and press Enter
   2. Look for "postgresql-x64-17" (or your PostgreSQL version) in the list
   3. Check the **Status** column - should show "Running"
   4. If **Status** is blank or "Stopped", right-click the service and select **"Start"**

2. **Setup the database:**
   ```cmd
   # Windows Command Prompt / PowerShell:
   psql -U postgres -d postgres -f db.sql
   ```

3. **Start the server:**
   ```cmd
   # Windows Command Prompt / PowerShell:
   npm run dev-server
   ```

4. **Process existing events:**
   ```cmd
   # Windows Command Prompt / PowerShell:
   node data_processor.js events.jsonl
   ```

5. **Send live events (optional):**
   ```cmd
   # Windows Command Prompt / PowerShell:
   npm run client
   ```

### File Formats and Examples

**Valid Event Format:**
```json
{"userId": "user1", "name": "add_revenue", "value": 100}
{"userId": "user2", "name": "subtract_revenue", "value": 50}
```

**Invalid Examples:**
```json
{"userId": "user1", "name": "invalid_event", "value": 100}  // Invalid event name
{"user": "user1", "name": "add_revenue", "value": 100}      // Wrong field name
{"userId": "user1", "name": "add_revenue"}                  // Missing value
```

## Troubleshooting

### Common Issues

**Database Connection Error:**
- Verify PostgreSQL service is running: `sc query postgresql-x64-17` (service name may vary: try `postgresql-x64-14`, `postgresql-x64-15`, or `postgresql`)
- Or use Windows Services: Press `Win + R`, type `services.msc`, look for PostgreSQL service
- Check database credentials in both `server.js` and `data_processor.js`
- Ensure the database and table exist: `\dt` in psql

**File Lock Issues:**
- Make sure no other processes are accessing the event files
- Check file permissions in File Explorer or use `dir *.jsonl`
- Restart the application if locks persist

**Server Not Starting:**
- Check if port 8000 is available: `netstat -an | findstr :8000`
- Verify all dependencies are installed: `npm install`
- Check Node.js version: `node --version`

**Events Not Processing:**
- Verify JSONL format is correct (one JSON object per line)
- Check file exists in the correct directory
- Review console output for specific error messages

**Client Connection Issues:**
- Ensure server is running on port 8000
- Verify the auth token matches between client and server
- Check network connectivity: `curl http://localhost:8000/ping` (if curl installed) or use PowerShell: `Invoke-RestMethod http://localhost:8000/ping`

## License

ISC License - see the [LICENSE](LICENSE) file for details.

## Author

**Amir Dar**
- GitHub: [@dardar4](https://github.com/dardar4)
- Repository: [FinonexETL](https://github.com/dardar4/FinonexETL)

---

For questions or support, please open an issue on the GitHub repository. 


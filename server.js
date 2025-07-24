import express from 'express';
import fs from 'fs/promises';
import { Pool } from 'pg';
import lockfile from 'proper-lockfile';

const EVENTS_FILE = 'events-to-process.jsonl';
const SECRET_KEY = 'secret';

// Initialize express app and port
const app = express();
const port = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// Database configuration - Change this to your own database configuration
const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '1234',
    port: 5432,
};

// users_revenue Repository class
class UserRevenueRepository {
    constructor() {
        this.pool = new Pool(dbConfig); 
    }

    // Get all revenue records for a user
    async getUserRevenue(userId) {

        // Validate userId is not empty and is a string
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
            throw new Error('userId must be a non-empty string');
        }

        const query = 'SELECT * FROM users_revenue WHERE user_id = $1';
        const values = [userId];
        const result = await this.pool.query(query, values);
        return result.rows; // returns an array of rows
    }

    // Optionally, close the pool when your app shuts down
    async close() {
        await this.pool.end();
    }
}

// Create a single shared instance
const userRevenueRepo = new UserRevenueRepository();

// EventStorage class to handle event file operations
class EventFileWriter {
    constructor(filename) {
        this.filename = filename;
        this.ensureFileExists();
    }

    async ensureFileExists() {
        try {
            await fs.access(this.filename);
        } catch (err) {
            // File does not exist, create it empty
            await fs.writeFile(this.filename, '');
        }
    }

    async appendEvent(event) {
        let releaseLock;
        try {
            releaseLock = await lockfile.lock(this.filename, {
                retries: {
                    retries: 3,
                    factor: 1,
                    minTimeout: 1000,
                    maxTimeout: 1000
                },
            });

            await fs.appendFile(this.filename, JSON.stringify(event) + '\n');
        } catch (err) {
            throw err;
        } finally {
            if (releaseLock) {
                await releaseLock();
            }
        }
    }
}


function validateEvent(event) {

    if (!event || typeof event !== 'object') {
        return { valid: false, error: 'Invalid or missing event data (not an object).' };
    }

    if (typeof event.userId !== 'string') {
        return { valid: false, error: 'Invalid or missing userId type (expected string).' };
    }

    if (event.userId.length > 255) {
        return { valid: false, error: 'Invalid userId length (expected <= 255).' };
    }

    if (typeof event.name !== 'string') {
        return { valid: false, error: 'Invalid or missing name type (expected string).' };
    }

    if (!['add_revenue', 'subtract_revenue'].includes(event.name)) {
        return { valid: false, error: 'Invalid event name (must be add_revenue or subtract_revenue).' };
    }

    if (!Number.isInteger(event.value)) {
        return { valid: false, error: 'Invalid or missing value type (expected integer).' };
    }

    return { valid: true };
}


// Authentication middleware
function authenticate(req, res, next) {
    const auth = req.headers['authorization'];

    if (auth !== SECRET_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}



app.post('/liveEvent', authenticate, async (req, res) => {
    const event = req.body;

    // Validate event data
    const validation = validateEvent(event);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const eventStorage = new EventFileWriter(EVENTS_FILE);
        await eventStorage.appendEvent(event);
        return res.status(200).json({ message: 'Event processed and saved successfully!' });
    } 
    catch (err) {
        if (err.code === 'ELOCKED' || /timed out/i.test(err.message)) {
            return res.status(423).json({ error: 'File is currently locked, please try again later.' });
        }
        return res.status(500).json({ error: 'Failed to save event', details: err.message });
    }
});

app.get('/userEvents/:userid', authenticate, async (req, res) => {
    const userId = req.params.userid;
    try {
        const events = await userRevenueRepo.getUserRevenue(userId);
        if (events.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json(events[0]);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch user events', details: err.message });
    }
});

// Health check endpoint
app.get('/ping', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'pong' });
});


// #region server-setup
const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await userRevenueRepo.close();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// #endregion

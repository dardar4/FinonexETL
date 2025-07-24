import lockfile from 'proper-lockfile';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const DEFAULT_FILE_PATH = './events-to-process.jsonl';


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

    // insert or update user revenue
    async upsertUserRevenue(userRevenueDict, batchSize = 500) {

        // Convert userRevenueDict to an array of [userId, revenue]
        const entries = Object.entries(userRevenueDict);
        if (entries.length === 0) 
            return;

        // Process users in batches to avoid memory issues
        for (let i = 0; i < entries.length; i += batchSize) {
            const userRevenueBatch = entries.slice(i, i + batchSize);
            console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(entries.length / batchSize)}`);
            console.log(`Batch size: ${userRevenueBatch.length}`);
            await this.upsertUserRevenueBatch(userRevenueBatch);
        }
    }

    async upsertUserRevenueBatch(userRevenueBatch) {
        const values = [];
        const params = [];
        userRevenueBatch.forEach(([userId, revenue], i) => {
            values.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
            params.push(userId, revenue);
        });

        const query = `
            INSERT INTO users_revenue (user_id, revenue)
            VALUES ${values.join(', ')}
            ON CONFLICT (user_id)
            DO UPDATE SET revenue = users_revenue.revenue + EXCLUDED.revenue
        `;

        try {
            await this.pool.query(query, params);
        } catch (err) {
            console.error('Database error during batch upsert:', err);
            throw new Error(`Failed to update user revenue batch: ${err.message}`);
        }
    }

    // Optionally, close the pool when your app shuts down
    async close() {
        await this.pool.end();
    }
}


async function processEventsFile(filePath) {
    console.log(`Processing file: ${filePath}`);

    // Check if file exists before proceeding
    try {
        await fs.access(filePath);
    } catch (err) {
        console.error(`File does not exist: ${filePath}`);
        return;
    }

    let releaseLock;
    try {

        releaseLock = await lockfile.lock(filePath, {
            retries: {
                retries: 3,
                factor: 1,
                minTimeout: 1000,
                maxTimeout: 1000
            },
        });

        const fileStream = createReadStream(filePath);

        fileStream.on('error', (err) => {
          console.error('Failed to open file:', err.message);
          process.exit(1);
        });

        const readlineInterface = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let userRevenueDict = {};
        for await (const line of readlineInterface) {
            if (!line.trim()) 
                continue;

            try {
                const event = JSON.parse(line);
                await parseEventRevenue(event, userRevenueDict);
            } catch (err) {
                console.error('Invalid JSON line:', line, err.message);
                continue;
            }
        }   

        // Save events to DB - only clear file if this succeeds
        await saveUserRevenueToDB(userRevenueDict);

        // After successful processing, clear the file
        await fs.writeFile(filePath, '');
        console.log('File cleared after processing.');
    } 
    catch (err) {
        console.error('Error during processing:', err);
    } 
    finally {
        if (releaseLock) 
            await releaseLock();
    }
}

async function saveUserRevenueToDB(userRevenueDict) {
    let repository = new UserRevenueRepository();
    try {
        await repository.upsertUserRevenue(userRevenueDict);
        console.log('Successfully saved user revenue data to database');
    } catch (err) {
        console.error('Failed to save user revenue to database:', err);
        throw err;
    } finally {
        await repository.close();
    }
}

async function parseEventRevenue(event, userRevenueDict) {
    const userId = event.userId;

    // Validate userId is a non-empty string
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        console.error('Invalid userId:', userId);
        return;
    }

    if (!(userId in userRevenueDict))
        userRevenueDict[userId] = 0;

    switch (event.name) {
        case 'add_revenue':
            userRevenueDict[userId] += event.value || 0;
            break;
        case 'subtract_revenue':
            userRevenueDict[userId] -= (event.value || 0);
            break;
        default:
            console.error('Invalid event name:', event.name);
            return;
    }
}

// Main execution check for Node.js
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
    processEventsFile(process.argv[2] || DEFAULT_FILE_PATH)
    .catch(err => {
      console.error('Error in main:', err);
      process.exit(1);
    });
}

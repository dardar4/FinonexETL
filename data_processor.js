import lockfile from 'proper-lockfile';
import fs from 'fs';
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

        await this.pool.query(query, params);
    }

    // Optionally, close the pool when your app shuts down
    async close() {
        await this.pool.end();
    }
}


async function processEventsFile(filePath) {
    console.log(`Processing file: ${filePath}`);

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


        const readlineInterface = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity
        });

        let userRevenueDict = {};
        for await (const line of readlineInterface) {
            if (!line.trim()) 
                continue;

            const event = JSON.parse(line);
            await parseEventRevenue(event, userRevenueDict);
        }   

        // 2. Save events to DB
        await saveUserRevenueToDB(userRevenueDict);

        // After processing all lines, clear the file
        fs.writeFileSync(filePath, '');
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
    await repository.upsertUserRevenue(userRevenueDict);
    await repository.close();
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

const __filename = fileURLToPath(import.meta.url);
const __main = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (__main) {
    processEventsFile(process.argv[2] || DEFAULT_FILE_PATH)
    .catch(err => {
      console.error("Error in main:", err);
      process.exit(1);
    });
}

import lockfile from 'proper-lockfile';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_FILE_PATH = './events-to-process.jsonl';

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
    // TODO: Implement this function
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

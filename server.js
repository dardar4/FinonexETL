const express = require('express');
const fs = require('fs').promises;

const EVENTS_FILE = 'events-to-process.jsonl';
const SECRET_KEY = 'secret';

// Initialize express app and port
const app = express();
const port = 8000;

// Middleware to parse JSON bodies
app.use(express.json());

// EventStorage class to handle event file operations
class EventFileWriter {
    constructor(filename) {
        this.filename = filename;
    }

    async appendEvent(event) {
         // Save event to a local file (jsonl format) 
        await fs.appendFile(this.filename, JSON.stringify(event) + '\n');
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

// POST /liveEvent: receive event and append to file
app.post('/liveEvent', authenticate, async (req, res) => {
    const event = req.body;
    console.log(event);

    // Validate event data
    const validation = validateEvent(event);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const eventStorage = new EventFileWriter(EVENTS_FILE);
        await eventStorage.appendEvent(event);
        return res.status(200).json({ message: 'Event processed and saved successfully!' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to save event', details: err.message });
    }
});

// GET /userEvents/:userid: return all events for a user
app.get('/userEvents/:userid', authenticate , (req, res) => {
    const userId = req.params.userid;

    // TODO: Read user events from DB
    let events = [];

    return res.status(200).json({ events });
});



// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
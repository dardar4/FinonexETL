const express = require('express');
const app = express();
const port = 8000;
const SECRET_KEY = 'secret';

app.use(express.json());

// Authentication middleware
function authenticate(req, res, next) {
    const auth = req.headers['authorization'];

    if (auth !== SECRET_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}

// POST /liveEvent: receive event and append to file
app.post('/liveEvent', authenticate, (req, res) => {
    const event = req.body;

    // Validate event data
    if (!event || typeof event !== 'object') {
        return res.status(400).json({ error: 'Invalid event data' });
    }

    // TODO: Save event to a local file

    return res.status(200).json({ message: 'Event processed successfully' });
});

// GET /userEvents/:userid: return all events for a user
app.get('/userEvents/:userid', (req, res) => {
    const userId = req.params.userid;

    // TODO: Read user events from DB
    let events = [];

    return res.status(200).json({ events });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
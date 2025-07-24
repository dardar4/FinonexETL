import fs from 'fs';
import readline from 'readline';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

class EventSender {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  addAuthHeader() {
    return {
        'Authorization': this.authToken,
        'Accept': 'application/json'
    }
  }

  getPingUrl = () => { return this.baseUrl + 'ping'; }
  getLiveEventUrl = () => { return this.baseUrl + 'liveEvent'; }
    
  
  async testConnection() {
    try {
      const response = await axios.get(this.getPingUrl(), { headers: this.addAuthHeader() });

      if (response.status === 200) 
        return true;
    } 
    catch (err) {
      console.error('Connection error:', err.message || err);
      return false;
    }

    console.error(`Ping failed with status ${response.status}`);
    return false;
  }
  
  async sendEvent(event) {
    try {
      console.log('Sent event:', event);

      const headers = this.addAuthHeader();
      const response = await axios.post(this.getLiveEventUrl(), event, { headers });
      if (response.status !== 200) {
        console.error(`Server returned error status ${response.status}: ${response.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`Failed event: ${JSON.stringify(event)}, Error Code: ${err.code}, Failed to send event: ${err.message}`);
    }
  }
}

class EventProcessor {
  constructor(eventsFile, eventSender) {
    this.eventsFile = eventsFile;
    this.eventSender = eventSender;
  }

  validateEvent(event) {
    if (typeof event.userId !== 'string' || event.userId.length > 255) {
      console.error('Invalid userId type - expected string:', event);
      return false;
    }

    if (typeof event.name !== 'string') {
      console.error('Invalid name type - expected string:', event);
      return false;
    }

    if (!['add_revenue', 'subtract_revenue'].includes(event.name)) {
      console.error('Invalid event name - must be add_revenue or subtract_revenue:', event);
      return false;
    }

    if (!Number.isInteger(event.value)) {
      console.error('Invalid value type - expected integer:', event);
      return false;
    }

    return true;
  }

  async processEventsFile() {
    const fileStream = fs.createReadStream(this.eventsFile);

    fileStream.on('error', (err) => {
      console.error('Failed to open file:', err.message);
      process.exit(1);
    });

    const readlineInterface = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of readlineInterface) {
      if (line.trim() === '') 
        continue; 

      let event;
      try {
        event = JSON.parse(line);
        if (!this.validateEvent(event)) {
          continue;
        }
      } catch (err) {
        console.error('Invalid JSON:', line);
        continue;
      }

      await this.eventSender.sendEvent(event);
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __main = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (__main) {
  (async () => {
    const sender = new EventSender('http://localhost:8000/', 'secret');

    if (!await sender.testConnection()) {
      console.error("Failed to connect to server");
      process.exit(1);
    }
  
    const processor = new EventProcessor('events.jsonl', sender);
    try {
      await processor.processEventsFile();
    } catch (err) {
      console.error("Error in main:", err);
      process.exit(1);
    }
  })();
}

import express from 'express';
import cors from 'cors';
import https from 'https';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { networkInterfaces } from 'os';
import { getWeatherData } from './services/api.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

const isDev = process.env.NODE_ENV === 'development';

// Add this line to serve static files from the cricket-extension directory
app.use(express.static(path.join(__dirname)));

let server;
if (isDev) {
  server = require('http').createServer(app);
} else {
  const options = {
    key: fs.readFileSync(path.join(__dirname, '..', 'keys', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
  };
  server = https.createServer(options, app);
}

const wss = new WebSocketServer({ server });

let matchData = {
  lastUpdated: new Date(),
  data: {
    matchTitle: '',
    teams: {
      team1: { 
        name: '', 
        score: '', 
        overs: '', 
        logo: '' 
      },
      team2: { 
        name: '', 
        score: '', 
        overs: '', 
        logo: '' 
      }
    },
    currentInnings: {
      CRR: '',
      RRR: ''
    },
    batsmen: [],
    bowler: null,
    recentOvers: [],
    partnership: {
      runs: '',
      balls: '',
      runRate: ''
    },
    lastBat: {
      name: '',
      runs: '',
      balls: ''
    },
    fallOfWicket: {
      score: '',
      overs: ''
    },
    reviews: {
      team1: '',
      team2: ''
    },
    last5: {
      runs: '',
      wickets: '',
      runRate: ''
    },
    last10: {
      runs: '',
      wickets: '',
      runRate: ''
    },
    stadium: '',
    currentEvent: {
      text: '',
      additionalInfo: ''
    },
    matchStatus: '',
    winProbability: {},
    projectedScore: {},
    groundTime: '',
    additionalInfo: ''
  },
  source: null
};

let rightTeamConfig = {
    name: "AUS",
    score: "140-9", 
    overs: "31.5",
    logoUrl: "https://192.168.1.11:5000/teams/aus"
};

let weatherConfig = {
  city: null
};

let showBasicInfo = false;
let currentBasicInfo = null;

let showTeamForm = false;
let currentTeamForm = null;

let showHeadToHead = false;
let currentHeadToHead = null;

let showVenueStats = false;
let currentVenueStats = null;

let showTeamComparison = false;
let currentTeamComparison = null;

let showPlayingXI = false;
let currentPlayingXI = null;

let showInnings1Batting = false;
let currentInnings1Batting = null;

let showInnings1Bowling = false;
let currentInnings1Bowling = null;

let showInnings1Partnerships = false;
let currentInnings1Partnerships = null;

let showInnings1FallOfWickets = false;
let currentInnings1FallOfWickets = null;

let showInnings2Batting = false;
let currentInnings2Batting = null;

let showInnings2Bowling = false;
let currentInnings2Bowling = null;

let showInnings2Partnerships = false;
let currentInnings2Partnerships = null;

let showInnings2FallOfWickets = false;
let currentInnings2FallOfWickets = null;

// Add state variables for innings 3 and 4 after the existing innings variables
let showInnings3Batting = false;
let currentInnings3Batting = null;

let showInnings3Bowling = false;
let currentInnings3Bowling = null;

let showInnings3Partnerships = false;
let currentInnings3Partnerships = null;

let showInnings3FallOfWickets = false;
let currentInnings3FallOfWickets = null;

let showInnings4Batting = false;
let currentInnings4Batting = null;

let showInnings4Bowling = false;
let currentInnings4Bowling = null;

let showInnings4Partnerships = false;
let currentInnings4Partnerships = null;

let showInnings4FallOfWickets = false;
let currentInnings4FallOfWickets = null;

// Add new state variables for Sofascore data
let currentSofascoreData = null;

// Add function to read Sofascore data
const readSofascoreData = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'sofascore_data.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading Sofascore data:', error);
    return null;
  }
};

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(express.json());

// Add a specific route for updateScore.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'updateScore.html'));
});

app.get('/updateScore.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'updateScore.html'));
});

// Update the static middleware path to use absolute path
const teamsPath = 'C:/Users/Cric Blast Radio/Desktop/To work on/New folder/Crex Scorecard More Data/cricket-extension/public/images/teams';

// Add new path for players images
const playersPath = 'C:/Users/Cric Blast Radio/Desktop/To work on/New folder/Crex Scorecard More Data/cricket-extension/public/images/players';

// Debug: Check if directory exists and list its contents
console.log('Checking teams directory...');
if (fs.existsSync(teamsPath)) {
    console.log('Teams directory found!');
    const files = fs.readdirSync(teamsPath);
    console.log('Files in teams directory:', files);
} else {
    console.log('Teams directory not found at:', teamsPath);
}

console.log('Checking players directory...');
if (fs.existsSync(playersPath)) {
    console.log('Players directory found!');
    const files = fs.readdirSync(playersPath);
    console.log('Files in players directory:', files);
} else {
    console.log('Players directory not found at:', playersPath);
}

app.use('/teams', express.static(teamsPath));
app.use('/players', express.static(playersPath));

// Update the teams route to handle files with extensions
app.get('/teams/:teamName', (req, res) => {
  const teamName = req.params.teamName;
  const teamsDir = fs.readdirSync(teamsPath);
  
  console.log('Requested team:', teamName);
  console.log('Directory contents:', teamsDir);
  
  // Find the first file that starts with the requested team name
  const teamFile = teamsDir.find(file => file.toLowerCase().startsWith(teamName.toLowerCase() + '.'));
  
  if (teamFile) {
    const teamImagePath = path.join(teamsPath, teamFile);
    console.log('File found! Sending:', teamImagePath);
    res.sendFile(teamImagePath);
  } else {
    console.error(`Team image not found for ${teamName}. Available files:`, teamsDir);
    res.status(404).send('Team image not found');
  }
});

// Add players endpoint similar to teams
app.get('/players/:playerName', (req, res) => {
  const playerName = req.params.playerName;
  const playersDir = fs.readdirSync(playersPath);
  
  console.log('Requested player:', playerName);
  console.log('Directory contents:', playersDir);
  
  // Find the first file that starts with the requested player name
  const playerFile = playersDir.find(file => 
    file.toLowerCase().startsWith(playerName.toLowerCase() + '.')
  );
  
  if (playerFile) {
    const playerImagePath = path.join(playersPath, playerFile);
    console.log('File found! Sending:', playerImagePath);
    res.sendFile(playerImagePath);
  } else {
    // If player image not found, send the default player image
    console.log(`Player image not found for ${playerName}. Sending default player image.`);
    const defaultPlayerPath = path.join(playersPath, 'player.png');
    if (fs.existsSync(defaultPlayerPath)) {
      res.sendFile(defaultPlayerPath);
    } else {
      console.error('Default player image not found!');
      res.status(404).send('Player image not found');
    }
  }
});

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send current data on connection
  if (matchData.data) {
    ws.send(JSON.stringify(matchData.data));
  }

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

app.get('/match-data', (req, res) => {
  res.json(matchData);
});

app.post('/update-data', (req, res) => {
  try {
    // Update both matchData and log detailed info
    const newData = req.body;
    
    // Only update recentOvers if new data explicitly includes it
    const recentOvers = newData.hasOwnProperty('recentOvers') 
      ? newData.recentOvers 
      : matchData.data.recentOvers;

    matchData.data = {
      ...matchData.data,
      ...newData,
      recentOvers: recentOvers
    };
    
    matchData.source = newData.source || 'unknown';
    matchData.lastUpdated = new Date();

    // Broadcast updates via WebSocket
    broadcast(matchData.data);

    // Log detailed info like in server.js
    console.log('\nReceived new cricket data:', util.inspect(newData, {
      depth: null,
      colors: true,
      maxArrayLength: null,
      compact: false
    }));

    res.json({ success: true, message: 'Data updated successfully' });
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ success: false, message: 'Error updating data' });
  }
});

app.get('/get-right-team', (req, res) => {
  res.json(rightTeamConfig);
});

app.post('/update-right-team', (req, res) => {
  rightTeamConfig = {
    ...rightTeamConfig,
    score: req.body.score,
    overs: req.body.overs
  };
  console.log('Updated right team config:', rightTeamConfig);
  
  // Also update matchData.teams.team2 to keep data in sync
  matchData.data.teams.team2 = {
    ...matchData.data.teams.team2,
    score: rightTeamConfig.score,
    overs: rightTeamConfig.overs
  };

  // Broadcast the update
  broadcast(matchData.data);
  
  res.json({ success: true });
});

app.post('/update-weather-config', (req, res) => {
    try {
        const { city } = req.body;
        if (!city) {
            return res.status(400).json({ success: false, message: 'City name is required' });
        }
        
        weatherConfig.city = city;
        console.log('Updated weather config:', weatherConfig);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating weather config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/get-weather-config', (req, res) => {
    res.json(weatherConfig);
});

app.get('/test-weather', async (req, res) => {
    try {
        const { city } = req.query;
        if (!city) {
            return res.status(400).json({ success: false, message: 'City name is required' });
        }

        const weatherData = await getWeatherData(city);
        if (!weatherData) {
            return res.status(404).json({ success: false, message: 'Weather data not found' });
        }

        res.json(weatherData);
    } catch (error) {
        console.error('Error fetching weather:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Add these new endpoints
app.get('/get-match-info', (req, res) => {
    try {
        const matchInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cricket-extension', 'match-info', 'current-match.json'), 'utf8'));
        res.json(matchInfo);
    } catch (error) {
        console.error('Error reading match info:', error);
        res.status(500).json({ error: 'Failed to read match info' });
    }
});

app.post('/toggle-match-info', (req, res) => {
    try {
        const { type, show, data } = req.body;
        
        // Update the relevant state based on type
        switch (type) {
            case 'basicInfo':
                showBasicInfo = show;
                currentBasicInfo = data;
                break;
            case 'teamForm':
                showTeamForm = show;
                currentTeamForm = data;
                break;
            case 'headToHead':
                showHeadToHead = show;
                currentHeadToHead = data;
                break;
            case 'venueStats':
                showVenueStats = show;
                currentVenueStats = data;
                break;
            case 'teamComparison':
                showTeamComparison = show;
                currentTeamComparison = data;
                break;
            case 'playingXI':
                showPlayingXI = show;
                currentPlayingXI = data;
                break;
            default:
                throw new Error(`Unknown info type: ${type}`);
        }
        
        // Broadcast the update to all connected clients
        const updateData = {
            type: type,
            show: show,
            data: data
        };
        broadcast(updateData);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error toggling match info:', error);
        res.status(500).json({ error: 'Failed to toggle match info' });
    }
});

// Add this endpoint after the other endpoints
app.post('/update-match-info', (req, res) => {
  console.log('Received request to /update-match-info');
  try {
    const newData = req.body;
    
    // Save to file system
    const matchInfoPath = path.join(__dirname, '..', 'cricket-extension', 'match-info', 'current-match.json');
    fs.writeFileSync(matchInfoPath, JSON.stringify(newData, null, 2));
    
    // Update the server's state
    matchData.data = {
      ...matchData.data,
      ...newData
    };
    matchData.lastUpdated = new Date();
    
    // Broadcast updates via WebSocket
    broadcast(matchData.data);
    
    console.log('\nReceived new match info:', util.inspect(newData, {
      depth: null,
      colors: true,
      maxArrayLength: null,
      compact: false
    }));

    res.json({ success: true, message: 'Match info updated successfully' });
  } catch (error) {
    console.error('Error updating match info:', error);
    res.status(500).json({ success: false, message: 'Error updating match info' });
  }
});

// Add this endpoint after the other toggle endpoints
app.post('/toggle-scorecard-info', (req, res) => {
  try {
    const { type, inningsNumber, show, data } = req.body;
    console.log(`Toggling ${type} for innings ${inningsNumber}. Show: ${show}`);
    console.log('Data received:', data);

    // Update the state variables based on innings number and type
    switch (inningsNumber) {
      case 1:
        switch (type) {
          case 'batting':
            showInnings1Batting = show;
            currentInnings1Batting = data;
            break;
          case 'bowling':
            showInnings1Bowling = show;
            currentInnings1Bowling = data;
            break;
          case 'details':
            showInnings1Partnerships = show;
            currentInnings1Partnerships = data?.partnerships;
            showInnings1FallOfWickets = show;
            currentInnings1FallOfWickets = data?.fallOfWickets;
            break;
        }
        break;
      case 2:
        switch (type) {
          case 'batting':
            showInnings2Batting = show;
            currentInnings2Batting = data;
            break;
          case 'bowling':
            showInnings2Bowling = show;
            currentInnings2Bowling = data;
            break;
          case 'details':
            showInnings2Partnerships = show;
            currentInnings2Partnerships = data?.partnerships;
            showInnings2FallOfWickets = show;
            currentInnings2FallOfWickets = data?.fallOfWickets;
            break;
        }
        break;
      case 3:
        switch (type) {
          case 'batting':
            showInnings3Batting = show;
            currentInnings3Batting = data;
            break;
          case 'bowling':
            showInnings3Bowling = show;
            currentInnings3Bowling = data;
            break;
          case 'details':
            showInnings3Partnerships = show;
            currentInnings3Partnerships = data?.partnerships;
            showInnings3FallOfWickets = show;
            currentInnings3FallOfWickets = data?.fallOfWickets;
            break;
        }
        break;
      case 4:
        switch (type) {
          case 'batting':
            showInnings4Batting = show;
            currentInnings4Batting = data;
            break;
          case 'bowling':
            showInnings4Bowling = show;
            currentInnings4Bowling = data;
            break;
          case 'details':
            showInnings4Partnerships = show;
            currentInnings4Partnerships = data?.partnerships;
            showInnings4FallOfWickets = show;
            currentInnings4FallOfWickets = data?.fallOfWickets;
            break;
        }
        break;
      default:
        throw new Error(`Invalid innings number: ${inningsNumber}`);
    }

    const sofascoreData = readSofascoreData();
    if (!sofascoreData || !sofascoreData[inningsNumber - 1]) {
      console.log(`No Sofascore data available for innings ${inningsNumber}`);
      return res.status(404).json({ error: 'No data available for this innings' });
    }

    const inningsData = sofascoreData[inningsNumber - 1];
    let sectionData = null;

    switch (type) {
      case 'batting':
        sectionData = {
          teamName: inningsData.teamName,
          summary: inningsData.summary,
          batting: inningsData.batting
        };
        break;
      case 'bowling':
        sectionData = {
          teamName: inningsData.teamName,
          bowling: inningsData.bowling
        };
        break;
      case 'details':
        sectionData = {
          teamName: inningsData.teamName,
          partnerships: inningsData.partnerships,
          fallOfWickets: inningsData.fallOfWickets
        };
        break;
      default:
        throw new Error(`Unknown scorecard type: ${type}`);
    }

    // Create the update message
    const updateData = {
      type: `innings${inningsNumber}${type.charAt(0).toUpperCase() + type.slice(1)}`,
      show,
      data: sectionData
    };

    console.log('Broadcasting update:', updateData);
    broadcast(updateData);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling scorecard info:', error);
    res.status(500).json({ error: 'Failed to toggle scorecard info', details: error.message });
  }
});

// Add endpoint to get Sofascore data
app.get('/get-sofascore-data', (req, res) => {
  try {
    const data = readSofascoreData();
    res.json(data || []);
  } catch (error) {
    console.error('Error getting Sofascore data:', error);
    res.status(500).json({ error: 'Failed to get Sofascore data' });
  }
});

// Add new endpoint for Sofascore updates
app.post('/update-sofascore', (req, res) => {
    try {
        const { data } = req.body;
        
        // Save to sofascore_data.json
        fs.writeFileSync(
            path.join(__dirname, 'sofascore_data.json'),
            JSON.stringify(data, null, 2)
        );

        // Broadcast update via WebSocket
        broadcast({
            type: 'sofascoreUpdate',
            data: data,
            timestamp: Date.now()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error handling Sofascore update:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add this with your other endpoints
app.post('/update-speed', (req, res) => {
    try {
        const { data, timestamp } = req.body;
        
        // Use the same broadcast function as Sofascore
        broadcast({
            type: 'speedUpdate',
            data: data,
            timestamp: timestamp
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error handling speed update:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add endpoint for live matches updates
app.post('/update-live', (req, res) => {
    try {
        const { data, timestamp } = req.body;
        
        broadcast({
            type: 'liveMatchesUpdate',
            data: data,
            timestamp: timestamp
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error handling live matches update:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update the server listen
server.listen(5000, '0.0.0.0', () => {
  const networks = networkInterfaces();
  const ipAddresses = [];
  
  // Get all IPv4 addresses
  Object.keys(networks).forEach((interfaceName) => {
    networks[interfaceName].forEach((netInterface) => {
      if (netInterface.family === 'IPv4' && !netInterface.internal) {
        ipAddresses.push(netInterface.address);
      }
    });
  });

  console.log('\nServer is running and accessible at:');
  ipAddresses.forEach(ip => {
    console.log(`HTTPS: https://${ip}:5000`);
    console.log(`WebSocket: wss://${ip}:5000`);
  });
  console.log('\nLocal access:');
  console.log('HTTPS: https://localhost:5000');
  console.log('WebSocket: wss://localhost:5000');
  
  console.log('\nAvailable endpoints:', app._router.stack
    .filter(r => r.route)
    .map(r => ({
      path: r.route.path,
      methods: Object.keys(r.route.methods)
    }))
  );
}).on('error', (error) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error('Port 5000 is already in use. Please close other servers or use a different port.');
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
const currentTab = null;
const isScrapingActive = false;

// Constants for URLs and selectors
const CREX_URLS = {
  PLAYER_STATS: (playerId) => `https://crex.live/cricket/player/${playerId}/stats`,
  TEAM_STATS: (teamId) => `https://crex.live/cricket/team/${teamId}/stats`,
  HEAD_TO_HEAD: (team1Id, team2Id) => `https://crex.live/cricket/teams/${team1Id}-vs-${team2Id}/stats`,
  VENUE_STATS: (venueId) => `https://crex.live/cricket/ground/${venueId}/stats`
};

const SELECTORS = {
  MATCH: {
    TITLE: '.series-name .name-wrapper',
    TEAM_NAME: '.team-name',
    BATSMEN: '.batsmen-name',
    VENUE: '.venue-details'
  },
  STATS: {
    TOTAL_MATCHES: '.total-matches',
    WINS: '.head-to-head-wins',
    LOSSES: '.head-to-head-losses',
    RECENT_FORM: '.recent-form-item',
    RANKING: '.team-ranking',
    WIN_PERCENTAGE: '.win-percentage'
  }
};

// Initialize data cache
const dataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to get cached data
function getCachedData(key) {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

// Helper function to set cached data
function setCachedData(key, data) {
  dataCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Helper function to execute script in tab with retry logic
async function executeScriptInTab(tabId, func, ...args) {
  let retries = 3;
  while (retries > 0) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args
      });
      return result;
    } catch (error) {
      console.warn(`Script execution attempt failed. Retries left: ${retries-1}`);
      retries--;
      if (retries === 0) {
        console.error('Script execution failed after all retries:', error);
        return null;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Function to check if tab is still valid
async function isTabValid(tabId) {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

// Scrape additional data with improved error handling
async function scrapeAdditionalData(data, tabId) {
  console.log('🔍 Starting data scraping for tab:', tabId);
  
  try {
    // Check if tab is still valid
    if (!(await isTabValid(tabId))) {
      console.error('Tab no longer exists');
      return null;
    }

    const additionalData = {
      teamStats: {},
      playerStats: {},
      headToHead: {},
      venueStats: {}
    };

    // Extract team IDs from URL
    const matchIdMatch = data.matchUrl.match(/\/scoreboard\/([^\/]+)\/([^\/]+)\//);
    if (!matchIdMatch) {
      console.warn('⚠️ No team IDs found in URL');
      return additionalData;
    }

    const [team1Id, team2Id] = matchIdMatch.slice(1);
    console.log('📊 Found team IDs:', { team1Id, team2Id });

    // Check cache first
    const cacheKey = `${team1Id}-${team2Id}`;
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log('📦 Using cached data');
      return cachedData;
    }

    // Execute content script for head-to-head stats with timeout
    const headToHeadStats = await Promise.race([
      executeScriptInTab(tabId, (t1Id, t2Id, selectors) => {
        return new Promise((resolve) => {
          fetch(`https://crex.live/cricket/teams/${t1Id}-vs-${t2Id}/stats`)
            .then(response => response.text())
            .then(html => {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');
              resolve({
                totalMatches: doc.querySelector(selectors.STATS.TOTAL_MATCHES)?.textContent?.trim(),
                wins: doc.querySelector(selectors.STATS.WINS)?.textContent?.trim(),
                losses: doc.querySelector(selectors.STATS.LOSSES)?.textContent?.trim()
              });
            })
            .catch(() => resolve(null));
        });
      }, team1Id, team2Id, SELECTORS),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]).catch(error => {
      console.warn('Head-to-head stats fetch failed:', error);
      return null;
    });

    if (headToHeadStats) {
      additionalData.headToHead = headToHeadStats;
      // Cache only if we got valid data
      setCachedData(cacheKey, additionalData);
    }
    
    console.log('✅ Scraping completed successfully');
    return additionalData;

  } catch (error) {
    console.error('❌ Scraping error:', error);
    return null;
  }
}

// Message handling with improved error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab) {
    console.warn('Message received without tab information');
    return true;
  }

  console.log('📨 Received message:', message.type, 'from tab:', sender.tab.id);
  
  if (message.type === 'SCRAPE_ADDITIONAL_DATA') {
    // Handle scraping request
    scrapeAdditionalData(message.data, sender.tab.id)
      .then(additionalData => {
        if (additionalData) {
          // Check if tab still exists before sending response
          chrome.tabs.get(sender.tab.id)
            .then(() => {
              chrome.tabs.sendMessage(sender.tab.id, {
                type: 'ADDITIONAL_DATA_SCRAPED',
                data: additionalData
              }).catch(error => {
                console.warn('Failed to send scraped data:', error);
              });
            })
            .catch(error => {
              console.warn('Tab no longer exists:', error);
            });
        }
      })
      .catch(error => {
        console.error('Error handling scrape request:', error);
        // Only try to send error if tab might still exist
        chrome.tabs.get(sender.tab.id)
          .then(() => {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'SCRAPE_ERROR',
              error: error.message
            }).catch(console.warn);
          })
          .catch(() => {});
      });
  }
  
  return true;
});

// Initialize when extension loads
console.log('🚀 Background script initialized');

// Handle unhandled rejections
self.addEventListener('unhandledrejection', event => {
  console.warn('Unhandled promise rejection:', event.reason);
});

// Function to fetch innings data
async function fetchSofascoreInnings(matchId) {
    try {
        const response = await fetch(`https://www.sofascore.com/api/v1/event/${matchId}/innings`, {
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'sec-fetch-site': 'same-origin',
                'x-requested-with': '002e6d'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Sofascore data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching Sofascore innings:', error);
        return null;
    }
}

// Make it globally available for testing
self.fetchSofascoreInnings = fetchSofascoreInnings;

// Listen for messages to fetch data
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchInnings') {
        fetchSofascoreInnings(request.matchId);
    }
    return true;
});

// Example: Fetch data for a specific match
// fetchSofascoreInnings('12303205');
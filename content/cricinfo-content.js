let lastData = null;

// Define strict default state
const DEFAULT_MATCH_DATA = {
  stadium: '',
  groundTime: '',
  partnership: null,  // Changed to null for strict checking
  lastBat: null,      // Changed to null for strict checking
  fallOfWicket: null, // Changed to null for strict checking
  last5: null,        // Changed to null for strict checking
  last10: null,       // Changed to null for strict checking
  reviews: null       // Changed to null for strict checking
};

// Track current match URL
let currentMatchUrl = window.location.href;

// Add reconnection logic similar to crex-content.js
let retryCount = 0;
const MAX_RETRIES = 3;

const sendDirectUpdate = (data) => {
  console.log('📤 Cricinfo: Sending update via DOM:', {
    timestamp: Date.now(),
    data: data
  });
  
  try {
    // Primary method: DOM Events
    const event = new CustomEvent('CRICKET_DATA_UPDATE', { detail: data });
    document.dispatchEvent(event);
    
    // Secondary method: Try Chrome messaging if available
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_CRICKET_DATA',
        source: 'cricinfo',
        data: data,
        timestamp: Date.now()
      }).catch(error => {
        console.log('Chrome messaging unavailable - continuing with DOM events only');
      });
    }

    // Update HTTP request to use HTTPS and correct IP
    fetch('https://192.168.1.11:5000/update-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'cricinfo',
        ...data,
        timestamp: Date.now()
      })
    }).catch(error => {
      console.log('Express server update failed - continuing with WebSocket');
    });

  } catch (error) {
    console.error('❌ Failed to send update:', error);
  }
};

// Modify the observer callback to handle data persistence
const observer = new MutationObserver(async () => {
  try {
    // Reset on URL change
    if (window.location.href !== currentMatchUrl) {
      console.log('%c🔄 New match detected - Clearing data', 'color: #FFA500');
      lastData = null;
      currentMatchUrl = window.location.href;
      
      // Send null data to clear the display
      sendDirectUpdate(null);
      return;
    }

    // Direct data extraction
    const currentData = await extractCricinfoData();
    
    // Only send update if we have valid data
    if (currentData && Object.keys(currentData).some(key => currentData[key] !== null && currentData[key] !== '')) {
      // Real-time data mirroring with default values
      const mirroredData = {
        ...DEFAULT_MATCH_DATA,
        ...(currentData || {})
      };

      // Only update if data actually changed
      if (JSON.stringify(lastData) !== JSON.stringify(mirroredData)) {
        console.log('\n%c📊 Real-time Data Mirror', 'color: #4CAF50; font-weight: bold;');
        console.group();
        Object.entries(mirroredData).forEach(([key, value]) => {
          if (value !== null) {
            console.log(`%c${key}:`, 'color: #2196F3; font-weight: bold;', value);
          }
        });
        console.groupEnd();

        lastData = mirroredData;
        sendDirectUpdate(mirroredData);
      }
    } else {
      // If no valid data is found, clear the display
      if (lastData !== null) {
        console.log('%c🧹 No valid data found - Clearing display', 'color: #FFA500');
        lastData = null;
        sendDirectUpdate(null);
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (error.message.includes('Extension context invalidated')) {
      observer.disconnect();
      startObserver();
    }
  }
});

// Modified extractCricinfoData for strict real-time mirroring
async function extractCricinfoData() {
  try {
    const data = {};

    // Stadium extraction
    const stadiumElement = document.querySelector('a[href*="/cricket-grounds/"] .ds-text-tight-s');
    data.stadium = stadiumElement?.textContent?.trim() || '';

    // Ground time extraction
    const groundTimeElement = document.querySelector('.data');
    if (groundTimeElement?.textContent?.includes('Ground time:')) {
      data.groundTime = groundTimeElement.textContent.replace('Ground time:', '').trim();
    }

    // Match info extraction with modified partnership handling
    const matchInfoElement = document.querySelector('.ds-text-tight-s.ds-font-regular.ds-px-4.ds-py-2.ds-border-line.ds-text-typo-mid1');
    if (matchInfoElement?.textContent) {
      const text = matchInfoElement.textContent;
      
      // Partnership extraction - more flexible approach
      if (text.includes('Partnership:')) {
        const partnershipInfo = text.split('Partnership:')[1].split('•')[0].trim();
        const runsMatch = partnershipInfo.match(/(\d+)\s*Runs?/);
        const ballsMatch = partnershipInfo.match(/(\d+)\s*b/i);
        const oversMatch = partnershipInfo.match(/([\d.]+)\s*Ov/i);
        const rrMatch = partnershipInfo.match(/RR:\s*([\d.]+)/);
        
        if (runsMatch || ballsMatch || oversMatch) {
          data.partnership = {
            runs: runsMatch?.[1] || '',
            balls: ballsMatch ? ballsMatch[0] : '',
            overs: oversMatch ? oversMatch[0] : '',
            runRate: rrMatch?.[1] || ''
          };
        }
      }

      // Last bat extraction - more flexible approach
      if (text.includes('Last Bat:')) {
        const lastBatInfo = text.split('Last Bat:')[1].split('•')[0].trim();
        const nameMatch = lastBatInfo.match(/([^0-9]+)/);
        const runsMatch = lastBatInfo.match(/(\d+)\s*\(/);
        const ballsMatch = lastBatInfo.match(/\((\d+)b\)/);
        
        if (nameMatch || runsMatch || ballsMatch) {
          data.lastBat = {
            name: nameMatch?.[1]?.trim() || '',
            runs: runsMatch?.[1] || '',
            balls: ballsMatch?.[1] || ''
          };
        }
      }

      // FOW extraction - more flexible approach
      if (text.includes('FOW:')) {
        const fowInfo = text.split('FOW:')[1].split('•')[0].trim();
        const scoreMatch = fowInfo.match(/(\d+)\/(\d+)/);
        const oversMatch = fowInfo.match(/([\d.]+)\s*Ov/);
        
        if (scoreMatch || oversMatch) {
          data.fallOfWicket = {
            score: scoreMatch ? `${scoreMatch[1]}/${scoreMatch[2]}` : '',
            overs: oversMatch?.[1] || ''
          };
        }
      }
    }

    // Run rates extraction
    const runRatesElement = document.querySelector('.ds-text-tight-s.ds-font-regular.ds-overflow-x-auto');
    if (runRatesElement?.textContent) {
      const divElements = runRatesElement.querySelectorAll('div > div');
      
      divElements.forEach(div => {
        const text = div?.textContent || '';
        
        // Last 5 overs - more flexible approach
        if (text.includes('Last 5 ov')) {
          const runsMatch = text.match(/(\d+)\/(\d+)/);
          const rrMatch = text.match(/\(([\d.]+)\)/);
          
          if (runsMatch || rrMatch) {
            data.last5 = {
              runs: runsMatch?.[1] || '',
              wickets: runsMatch?.[2] || '',
              runRate: rrMatch?.[1] || ''
            };
          }
        }
        
        // Last 10 overs - more flexible approach
        if (text.includes('Last 10 ov')) {
          const runsMatch = text.match(/(\d+)\/(\d+)/);
          const rrMatch = text.match(/\(([\d.]+)\)/);
          
          if (runsMatch || rrMatch) {
            data.last10 = {
              runs: runsMatch?.[1] || '',
              wickets: runsMatch?.[2] || '',
              runRate: rrMatch?.[1] || ''
            };
          }
        }
      });
    }

    // Reviews extraction - more flexible approach
    const reviewsElements = document.querySelectorAll('.ds-text-tight-s.ds-font-regular.ds-px-4.ds-py-2');
    reviewsElements.forEach(element => {
      if (element?.textContent?.includes('Reviews Remaining')) {
        const reviewsText = element.textContent;
        const teams = reviewsText.split('Reviews Remaining:')[1]?.split(',').map(text => text.trim());
        
        if (teams?.length === 2) {
          data.reviews = {
            team1: teams[0] || '',
            team2: teams[1] || ''
          };
        }
      }
    });

    return data;
  } catch (error) {
    console.error('Extraction Error:', error);
    return null;
  }
}

// Modify the startObserver function to include auto-refresh
function startObserver() {
  console.log('%c🚀 Starting Real-time Mirror', 'color: #9C27B0; font-weight: bold;');
  
  // Check extension context before starting
  if (!chrome.runtime?.id) {
    console.warn('Extension context invalid on start, using DOM events only');
    return;
  }
  
  lastData = null;
  currentMatchUrl = window.location.href;
  
  // Initial data extraction
  extractCricinfoData().then(data => {
    if (data && Object.keys(data).some(key => data[key] !== null && data[key] !== '')) {
      const mirroredData = {
        ...DEFAULT_MATCH_DATA,
        ...data
      };
      lastData = mirroredData;
      sendDirectUpdate(mirroredData);
    } else {
      sendDirectUpdate(null);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'data-*', 'href']
  });
}

// Start observer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserver);
} else {
  startObserver();
}

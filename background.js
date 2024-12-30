// Track connected ports
let ports = new Set();

// Handle port connections
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'cricket_live_updates') {
    ports.add(port);
    console.log('New connection established');
    
    port.onDisconnect.addListener(() => {
      ports.delete(port);
      console.log('Connection closed');
    });
  }
});

// Relay messages from content scripts to all connected ports
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(`🕒 [${new Date().toISOString()}] Background received message:`, {
    type: message.type,
    source: message.source,
    timestamp: message.timestamp,
    delay: Date.now() - message.timestamp + 'ms'
  });

  // Forward to all tabs, but only to allowed URLs
  chrome.tabs.query({
    url: [
      "*://*.espncricinfo.com/*",
      "http://localhost:3000/*",
      "https://crex.live/*"
    ]
  }, (tabs) => {
    tabs.forEach(tab => {
      try {
        // Send message to tab
        chrome.tabs.sendMessage(tab.id, {
          type: 'CRICKET_DATA_UPDATE',
          detail: message.data,
          timestamp: Date.now()
        }).catch(error => {
          console.log('Message send skipped for tab:', tab.url);
        });

        // Only inject script into allowed URLs
        if (tab.url.includes('localhost:3000') || 
            tab.url.includes('espncricinfo.com') || 
            tab.url.includes('crex.live')) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (data) => {
              window.postMessage({
                type: 'CRICKET_DATA_UPDATE',
                detail: data,
                timestamp: Date.now()
              }, '*');
            },
            args: [message.data]
          }).catch(error => {
            console.log('Script injection skipped for tab:', tab.url);
          });
        }
      } catch (error) {
        console.error('Error sending to tab:', tab.url, error);
      }
    });
  });

  // Return true to indicate we'll handle the response asynchronously
  return true;
}); 
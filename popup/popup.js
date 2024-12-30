const scoreContent = document.getElementById('score-content');

// Add performance tracking for direct DOM updates
document.addEventListener('CRICKET_DATA_UPDATE', (event) => {
  if (event.detail) {
    console.log(`🕒 [${new Date().toISOString()}] Popup received direct update:`, {
      receivedTimestamp: Date.now(),
      data: event.detail
    });
    
    console.time('renderTime');
    updateUI(event.detail);
    console.timeEnd('renderTime');
  }
});

// Add timing to updateUI function
function updateUI(data) {
  console.log('🎨 Starting UI update:', Date.now());
  scoreContent.innerHTML = `
    <div class="score">
      <div class="team">${data?.teams?.team1?.name || 'Team 1'}</div>
      <div class="runs">${data?.teams?.team1?.score || '0/0'}</div>
      <div class="overs">${data?.teams?.team1?.overs || '0.0'} overs</div>
    </div>
  `;
  console.log('🎨 Finished UI update:', Date.now());
} 
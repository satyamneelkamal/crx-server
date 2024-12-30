const fs = require('fs').promises;
const path = require('path');

async function restructureProject(reverse = false) {
  const rootDir = path.resolve(__dirname, '..');
  
  // Define file moves (original -> destination)
  const fileMoves = [
    // Data Server
    { from: 'server.js', to: 'data-server/server.js' },
    { from: 'cricinfo-server.js', to: 'data-server/routes/cricinfo.js' },
    
    // Control Panel
    { from: 'components/ControlPanel.js', to: 'control-panel/public/scripts/panel.js' },
    { from: 'styles/control-panel.css', to: 'control-panel/public/styles/panel.css' },
    
    // Frontend
    { from: 'components/FullScorecard.js', to: 'frontend/components/FullScorecard.js' },
    { from: 'styles/full-scorecard.css', to: 'frontend/public/styles/full-scorecard.css' },
    
    // Extension
    { from: 'cricinfo-content.js', to: 'extension/content-scripts/cricinfo.js' },
    { from: 'crex-content.js', to: 'extension/content-scripts/crex.js' },
    { from: 'manifest.json', to: 'extension/manifest.json' },
    
    // App.js
    { from: 'frontend/src/App.js', to: 'cricket-extension/App.js' }
  ];

  // Create directories needed for reverse move
  if (reverse) {
    const originalDirs = ['components', 'styles', 'frontend/src'];
    console.log('🏗️ Recreating original directories...');
    
    for (const dir of originalDirs) {
      const fullPath = path.join(rootDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`📁 Recreated: ${dir}`);
    }
  }

  console.log(`\n🚚 ${reverse ? 'Reversing' : 'Moving'} files...`);
  
  for (const move of fileMoves) {
    try {
      // Reverse the from/to if we're reversing the restructure
      const fromPath = path.join(rootDir, reverse ? move.to : move.from);
      const toPath = path.join(rootDir, reverse ? move.from : move.to);
      
      // Create the destination directory if it doesn't exist
      await fs.mkdir(path.dirname(toPath), { recursive: true });
      
      // Check if source file exists
      await fs.access(fromPath);
      
      // Copy file to new location
      await fs.copyFile(fromPath, toPath);
      console.log(`📄 ${reverse ? 'Reversed' : 'Moved'}: ${fromPath} -> ${toPath}`);
      
      // Delete original file
      await fs.unlink(fromPath);
    } catch (error) {
      console.error(`❌ Error ${reverse ? 'reversing' : 'moving'} ${move.from}: ${error.message}`);
    }
  }

  // Clean up directories if not reversing
  if (!reverse) {
    const oldDirs = ['components', 'styles'];
    console.log('\n🧹 Cleaning up old directories...');
    
    for (const dir of oldDirs) {
      try {
        await fs.rmdir(path.join(rootDir, dir));
        console.log(`🗑️ Removed: ${dir}`);
      } catch (error) {
        console.error(`❌ Error removing ${dir}: ${error.message}`);
      }
    }
  }

  console.log(`\n✅ Project ${reverse ? 'reversal' : 'restructuring'} complete!`);
}

// Check for --reverse flag
const isReverse = process.argv.includes('--reverse');

// Run the restructuring
restructureProject(isReverse).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 
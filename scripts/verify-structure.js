const fs = require('fs').promises;
const path = require('path');

async function verifyStructure() {
  const rootDir = path.resolve(__dirname, '..');
  
  // Define expected structure
  const expectedStructure = {
    'data-server': {
      files: ['server.js'],
      dirs: {
        'routes': ['cricinfo.js', 'crex.js']
      }
    },
    'control-panel': {
      files: ['server.js'],
      dirs: {
        'public': {
          files: ['index.html'],
          dirs: {
            'styles': ['panel.css'],
            'scripts': ['panel.js']
          }
        }
      }
    },
    'frontend': {
      files: ['server.js'],
      dirs: {
        'public': {
          files: ['index.html'],
          dirs: {
            'styles': []
          }
        },
        'components': [
          'CrexScorecard.js',
          'FullScorecard.js',
          'Partnerships.js',
          'FallOfWickets.js'
        ]
      }
    },
    'extension': {
      files: ['manifest.json'],
      dirs: {
        'content-scripts': [
          'cricinfo.js',
          'crex.js'
        ]
      }
    }
  };

  // Current file mapping
  const currentFiles = {
    'server.js': 'data-server/server.js',
    'cricinfo-server.js': 'data-server/routes/cricinfo.js',
    'crex-content.js': 'extension/content-scripts/crex.js',
    'cricinfo-content.js': 'extension/content-scripts/cricinfo.js',
    'components/ControlPanel.js': 'control-panel/public/scripts/panel.js',
    'components/FullScorecard.js': 'frontend/components/FullScorecard.js',
    'styles/control-panel.css': 'control-panel/public/styles/panel.css',
    'styles/full-scorecard.css': 'frontend/public/styles/full-scorecard.css',
    'manifest.json': 'extension/manifest.json'
  };

  console.log('🔍 Verifying project structure...\n');

  // Check existing files
  console.log('📁 Current Files:');
  for (const [source, target] of Object.entries(currentFiles)) {
    try {
      await fs.access(path.join(rootDir, source));
      console.log(`✅ Found: ${source}`);
    } catch {
      console.log(`❌ Missing: ${source}`);
    }
  }

  // Check directory structure
  console.log('\n📁 Directory Structure:');
  for (const [dir, content] of Object.entries(expectedStructure)) {
    const dirPath = path.join(rootDir, dir);
    try {
      await fs.access(dirPath);
      console.log(`✅ Directory exists: ${dir}`);
    } catch {
      console.log(`❌ Missing directory: ${dir}`);
    }
  }

  // Generate move commands
  console.log('\n📝 Required Actions:');
  for (const [source, target] of Object.entries(currentFiles)) {
    const sourcePath = path.join(rootDir, source);
    const targetPath = path.join(rootDir, target);
    try {
      await fs.access(sourcePath);
      console.log(`➡️  Move ${source} to ${target}`);
    } catch {
      console.log(`⚠️  Skip ${source} (not found)`);
    }
  }

  console.log('\n✨ Verification complete!');
}

// Run verification
verifyStructure().catch(error => {
  console.error('❌ Error during verification:', error);
  process.exit(1);
}); 
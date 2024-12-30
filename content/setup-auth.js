import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function recordWithCodegen() {
    console.log('Please close Chrome completely before continuing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const sourceDir = path.join(
        process.env.LOCALAPPDATA, 
        'Google', 
        'Chrome', 
        'User Data', 
        'Default'
    );
    console.log('Looking for Chrome data in:', sourceDir);

    const targetDir = path.join(process.cwd(), 'chrome-data', 'Default');
    const targetNetworkDir = path.join(targetDir, 'Network');
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    if (!fs.existsSync(targetNetworkDir)) {
        fs.mkdirSync(targetNetworkDir);
    }

    const essentialFiles = [
        { source: 'Network/Cookies', target: 'Network/Cookies' },
        { source: 'Login Data', target: 'Login Data' },
        { source: 'Web Data', target: 'Web Data' }
    ];

    essentialFiles.forEach(file => {
        const filePath = path.join(sourceDir, file.source);
        if (!fs.existsSync(filePath)) {
            console.error(`Required file not found: ${filePath}`);
            console.log('Please make sure Chrome is installed and you have logged in at least once');
            process.exit(1);
        }
    });

    console.log('Copying authentication files...');
    for (const file of essentialFiles) {
        try {
            fs.copyFileSync(
                path.join(sourceDir, file.source),
                path.join(targetDir, file.target)
            );
            console.log(`Successfully copied: ${file.source}`);
        } catch (error) {
            console.warn(`Warning: Could not copy ${file.source}:`, error.message);
            if (error.code === 'EBUSY') {
                console.error('Error: Chrome is still running. Please close Chrome completely and try again.');
                process.exit(1);
            }
        }
    }

    console.log('Starting browser...');
    const browser = await chromium.launchPersistentContext(targetDir, {
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--start-maximized',
            '--disable-features=IsolateOrigins,site-per-process',
            '--flag-switches-begin --disable-site-isolation-trials --flag-switches-end'
        ],
        slowMo: 50,
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://www.cricbuzz.com/premium-subscription/user/login');
        
        console.log('\n Please login to Cricbuzz...');
        console.log('Waiting for login to complete...');
        
        // Wait for either successful login or browser close
        const authPath = path.join(process.cwd(), 'auth.json');
        
        // Set up an interval to check and save auth state periodically
        const checkInterval = setInterval(async () => {
            try {
                await browser.storageState({ path: authPath });
                const authContent = fs.readFileSync(authPath, 'utf8');
                const authData = JSON.parse(authContent);
                if (authData.cookies && authData.cookies.length > 0) {
                    console.log('\n✅ Authentication state saved successfully!');
                    console.log(`Found ${authData.cookies.length} cookies`);
                    console.log('Auth file location:', authPath);
                    clearInterval(checkInterval);
                    await browser.close();
                    process.exit(0);
                }
            } catch (error) {
                // Ignore errors during checks
            }
        }, 2000);

        // Handle browser closing
        browser.on('close', () => {
            clearInterval(checkInterval);
            console.log('\n⚠️ Browser was closed. Checking if auth state was saved...');
            if (fs.existsSync(authPath)) {
                console.log('✅ Auth file exists at:', authPath);
            } else {
                console.error('❌ Auth file was not created');
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('Error:', error);
        await browser.close();
        process.exit(1);
    }
}

recordWithCodegen().catch(console.error); 
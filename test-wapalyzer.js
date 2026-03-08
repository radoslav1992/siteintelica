import Wappalyzer from 'wapalyzer';

const options = {
    debug: false,
    delay: 500,
    maxDepth: 3,
    maxUrls: 10,
    maxWait: 5000,
    recursive: false,
    probe: false,
    proxy: false,
    userAgent: 'Wappalyzer',
    htmlMaxCols: 2000,
    htmlMaxRows: 2000,
    noScripts: false,
    noRedirect: false,
};

async function test() {
    const url = 'https://example.com';
    console.log('Testing URL:', url);
    const wappalyzer = new Wappalyzer(options);

    try {
        await wappalyzer.init();
        console.log('Wappalyzer initialized');

        const site = await wappalyzer.open(url);
        console.log('Site opened');

        const results = await site.analyze();
        console.log('Analysis results:', JSON.stringify(results, null, 2));

    } catch (error) {
        console.error('Error during analysis:', error);
    } finally {
        await wappalyzer.destroy();
        console.log('Wappalyzer destroyed');
    }
}

test();

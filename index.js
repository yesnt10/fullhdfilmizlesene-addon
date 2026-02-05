const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const puppeteer = require("puppeteer");

let browser;

async function getBrowser() {
    if (!browser) {
        console.log("Launching browser...");
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });
        
        // Handle browser disconnect/crash
        browser.on('disconnected', () => {
            console.log("Browser disconnected, clearing instance...");
            browser = null;
        });
    }
    return browser;
}

async function scrapeCatalog(url) {
    const b = await getBrowser();
    const page = await b.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const movies = await page.evaluate(() => {
            const items = [];
            // Selectors based on site structure
            document.querySelectorAll("a[href^='https://www.fullhdfilmizlesene.tv/film/']").forEach(el => {
                const img = el.querySelector("img");
                if (img) {
                    const href = el.href;
                    const title = img.alt || el.title || el.innerText;
                    const poster = img.src || img.dataset.src;
                    
                    const match = href.match(/\/film\/([^/]+)\/?/);
                    if (match && title) {
                        items.push({
                            id: "fhf:" + match[1],
                            type: "movie",
                            name: title.trim(),
                            poster: poster,
                            description: title.trim()
                        });
                    }
                }
            });
            return items;
        });
        
        return movies;
    } catch (e) {
        console.error("Scrape error:", e);
        return [];
    } finally {
        await page.close();
    }
}

async function scrapeStream(slug) {
    const url = `https://www.fullhdfilmizlesene.tv/film/${slug}/`;
    const b = await getBrowser();
    const page = await b.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    let videoUrl = null;
    const streams = [];

    // Intercept requests to find m3u8/mp4
    await page.setRequestInterception(true);
    page.on('request', req => {
        const rUrl = req.url();
        if (rUrl.includes('.m3u8') || rUrl.includes('.mp4')) {
            console.log("Found video URL:", rUrl);
            streams.push({
                title: "Auto Detected",
                url: rUrl
            });
        }
        req.continue();
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Also check for iframes
        const iframes = await page.evaluate(() => {
            const frames = [];
            document.querySelectorAll("iframe").forEach(f => {
                if (f.src) frames.push(f.src);
                if (f.dataset.src) frames.push(f.dataset.src);
            });
            return frames;
        });

        iframes.forEach((src, i) => {
            if (src && !src.includes("youtube") && !src.includes("google")) {
                streams.push({
                    title: "Stream " + (i + 1),
                    url: src,
                    behaviorHints: { notWebReady: true }
                });
            }
        });

    } catch (e) {
        console.error("Stream scrape error:", e);
    } finally {
        await page.close();
    }
    
    return streams;
}

// Catalog Handler
addonInterface.defineCatalogHandler(async ({ type, id, extra }) => {
    if (type !== "movie") return { metas: [] };
    
    let url = "https://www.fullhdfilmizlesene.tv/yeni-filmler/";
    if (extra.search) {
        url = `https://www.fullhdfilmizlesene.tv/ara/?q=${encodeURIComponent(extra.search)}`;
    }
    
    const metas = await scrapeCatalog(url);
    // Deduplicate
    const uniqueMetas = Array.from(new Map(metas.map(m => [m.id, m])).values());
    return { metas: uniqueMetas };
});

// Meta Handler
addonInterface.defineMetaHandler(async ({ type, id }) => {
    if (type !== "movie" || !id.startsWith("fhf:")) return { meta: {} };
    // Reuse catalog logic or fetch specific page
    // For speed, we can just return basic info if we have it, but here we fetch
    const slug = id.split(":")[1];
    const url = `https://www.fullhdfilmizlesene.tv/film/${slug}/`;
    
    // We can use scrapeCatalog logic but for a single page if needed, 
    // but for now let's just return what we can or implement a specific meta scraper
    // For simplicity, we'll return a basic meta object. 
    // To get full details we'd need to scrape the movie page.
    
    return {
        meta: {
            id: id,
            type: "movie",
            name: slug.replace(/-/g, " "), // Fallback name
            description: "Watch on fullhdfilmizlesene.tv"
        }
    };
});

// Stream Handler
addonInterface.defineStreamHandler(async ({ type, id }) => {
    if (type !== "movie" || !id.startsWith("fhf:")) return { streams: [] };
    const slug = id.split(":")[1];
    const streams = await scrapeStream(slug);
    return { streams };
});

serveHTTP(addonInterface.getInterface(), { port: 7000 });
console.log("Addon running on http://localhost:7000");

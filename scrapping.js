const fs = require('fs');
const { JSDOM } = require('jsdom');

// Fungsi untuk membaca file dan mengambil URL
function readUrlsFromFile(filePath) {
    return fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
}

// Fungsi untuk mengecek apakah teks mengandung JavaScript
function containsJavaScript(text) {
    const jsPatterns = /(var|let|const|function|\{\}|\(\)|=>)/g;
    return jsPatterns.test(text);
}

// Fungsi untuk melakukan fetch dan parsing konten dari HTML menggunakan XPath
async function fetchAndParseContent(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();

        // Menggunakan JSDOM untuk mem-parsing HTML
        const dom = new JSDOM(text);
        const document = dom.window.document;

        // Mengambil judul menggunakan XPath
        const titleXPath = '/html/body/div[9]/div[2]/div[1]/article/div[1]/h1';
        const titleElement = document.evaluate(titleXPath, document, null, dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        const title = titleElement ? titleElement.textContent.trim() : 'Judul tidak ditemukan';

        // Mengambil paragraf menggunakan XPath (asumsi paragraf berada di dalam tag <p>)
        const paragraphXPath = '/html/body/div[9]/div[2]/div[1]/article//p';
        const paragraphNodes = document.evaluate(paragraphXPath, document, null, dom.window.XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

        // Cek jumlah paragraf, hanya ambil jika ada 4 atau lebih
        if (paragraphNodes.snapshotLength < 4) {
            return { url, title, paragraph: 'Konten kurang dari 4 paragraf' };
        }   

        // Ambil konten paragraf, buang yang berisi JavaScript
        const paragraphs = [];
        for (let i = 0; i < paragraphNodes.snapshotLength; i++) {
            const paragraphText = paragraphNodes.snapshotItem(i).textContent.trim();
            if (!containsJavaScript(paragraphText)) {
                paragraphs.push(paragraphText);
            }
        }

        const paragraphContent = paragraphs.join('\n\n') || 'Konten paragraf tidak ditemukan';

        return { url, title, paragraph: paragraphContent };
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error);
        return { url, title: 'Error', paragraph: 'Error' };
    }
}

// Fungsi utama untuk membaca file, fetch URL, dan menyimpan hasilnya ke dalam JSON
async function main() {
    const filePath = 'detik_article_links.txt'; // Ganti dengan path file yang berisi URL
    const urls = readUrlsFromFile(filePath);

    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`Fetching content from URL ${i + 1} of ${urls.length}: ${url}`);
        
        const content = await fetchAndParseContent(url);
        results.push(content);

        console.log(`Completed fetching content from URL ${i + 1}`);
    }

    // Menyimpan hasil ke dalam file JSON
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('Konten telah diambil dan disimpan ke results.json');
}

main();

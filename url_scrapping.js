const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// URL dasar untuk scraping
const baseUrl = 'https://news.detik.com/indeks/';

// Fungsi untuk scraping link dari satu halaman indeks
async function scrapePage(pageNumber) {
    try {
        const { data } = await axios.get(`${baseUrl}?page=${pageNumber}`);
        const $ = cheerio.load(data);
        let links = [];

        // Mencari semua elemen <a> yang merupakan link ke artikel
        $('article a').each((index, element) => {
            const link = $(element).attr('href');

            // Validasi bahwa link merupakan link ke artikel
            if (link && (link.startsWith('https://') || link.startsWith('/'))) {
                links.push(link.startsWith('/') ? 'https://news.detik.com' + link : link);
            }
        });

        // Menghilangkan duplikasi link
        links = [...new Set(links)];
        return links;
    } catch (error) {
        console.error(`Error on page ${pageNumber}:`, error.message);
        return [];
    }
}

// Fungsi utama untuk mengumpulkan 300 link dari beberapa halaman
async function scrapeMultiplePages() {
    let allLinks = [];
    let pageNumber = 1;

    while (allLinks.length < 300) {
        console.log(`Scraping page ${pageNumber}...`);
        const links = await scrapePage(pageNumber);
        allLinks = allLinks.concat(links);
        pageNumber++;

        // Berhenti jika tidak ada lagi link yang diambil dari halaman
        if (links.length === 0) {
            break;
        }
    }

    // Potong hasil jika lebih dari 300 link
    allLinks = allLinks.slice(0, 300);

    // Simpan hasil ke file txt
    fs.writeFileSync('detik_links.txt', allLinks.join('\n'), 'utf8');
    console.log(`Berhasil mengumpulkan ${allLinks.length} link artikel!`);
}

// Memulai scraping
scrapeMultiplePages();

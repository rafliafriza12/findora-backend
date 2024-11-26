const fs = require("fs");
const { JSDOM } = require("jsdom");

// Fungsi untuk membaca file dan mengambil URL
function readUrlsFromFile(filePath) {
  return fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
}

// Fungsi untuk menghapus kata-kata yang tidak diinginkan
function removeUnwantedWords(text) {
  const unwantedWords =
    /(ADVERTISEMENT|SCROLL TO CONTINUE WITH CONTENT|Simak juga Video:|\[Gambas:)/gi;
  return text.replace(unwantedWords, "").trim();
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
    const titleXPath = "/html/body/div[9]/div[2]/div[1]/article/div[1]/h1";
    const titleElement = document.evaluate(
      titleXPath,
      document,
      null,
      dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    const title = titleElement
      ? titleElement.textContent.trim()
      : "Judul tidak ditemukan";

    // Mengambil paragraf menggunakan XPath
    const paragraphXPath = "/html/body/div[9]/div[2]/div[1]/article//p";
    const paragraphNodes = document.evaluate(
      paragraphXPath,
      document,
      null,
      dom.window.XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );

    // Cek jumlah paragraf, hanya ambil jika ada 4 atau lebih
    if (paragraphNodes.snapshotLength < 4) {
      return { url, title, paragraph: "Konten kurang dari 4 paragraf" };
    }

    // Ambil konten paragraf, buang yang berisi JavaScript dan kata-kata yang tidak diinginkan
    const paragraphs = [];
    for (let i = 0; i < paragraphNodes.snapshotLength; i++) {
      const paragraphText = paragraphNodes.snapshotItem(i).textContent.trim();
      const cleanedText = removeUnwantedWords(paragraphText); // Menghapus kata-kata yang tidak diinginkan

      // Tambahkan hanya jika ada konten setelah dibersihkan
      if (cleanedText) {
        paragraphs.push(cleanedText);
      }
    }

    const paragraphContent =
      paragraphs.join("\n\n") || "Konten paragraf tidak ditemukan";

    // Mengambil src dari gambar menggunakan XPath
    const imageXPath =
      "/html/body/div[9]/div[2]/div[1]/article/div[2]/figure/img";
    const imageElement = document.evaluate(
      imageXPath,
      document,
      null,
      dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    const imageSrc = imageElement
      ? imageElement.getAttribute("src")
      : "Gambar tidak ditemukan";

    return { url, title, paragraph: paragraphContent, imageSrc };
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error);
    return { url, title: "Error", paragraph: "Error", imageSrc: "Error" };
  }
}

// Fungsi utama untuk membaca file, fetch URL, dan menyimpan hasilnya ke dalam JSON
async function main() {
  const filePath = "detik_article_links.txt"; // Ganti dengan path file yang berisi URL
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
  fs.writeFileSync("results.json", JSON.stringify(results, null, 2), "utf-8");
  console.log("Konten telah diambil dan disimpan ke results.json");
}

main();

const express = require("express");
const mongoose = require("mongoose");
const { configDotenv } = require("dotenv");
const cors = require("cors");
const natural = require("natural");
const bodyParser = require("body-parser");
const { Stemmer, Tokenizer } = require("sastrawijs");
const { performance } = require("perf_hooks"); // Add performance measurement

const stemmer = new Stemmer();
const tokenizer = new Tokenizer();
const tfIdf = natural.TfIdf;
configDotenv();
const port = 5000;
const app = express();

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

let tfidfCollection, documentCollections;

// Koneksi ke MongoDB
const clientOptions = {
  serverApi: { version: "1", strict: true, deprecationErrors: true },
};

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, clientOptions);
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("Koneksi ke MongoDB gagal:", error);
    process.exit(1); // Keluar dari proses jika koneksi gagal
  }
}

const stemText = (text) => {
  // Tokenisasi teks terlebih dahulu
  const tokens = tokenizer.tokenize(text);
  // Lakukan stemming pada setiap token yang dihasilkan
  return tokens.map((token) => stemmer.stem(token)).join(" ");
};

// Add a new function to calculate evaluation metrics
const calculateEvaluationMetrics = (results, relevanceThreshold = 0.1) => {
  // Simulate ground truth - in a real-world scenario, this would be manually labeled data
  const groundTruth = {
    truePositive: results.filter(
      (result) => result.similarity >= relevanceThreshold
    ).length,
    totalRetrieved: results.length,
    totalRelevant: Math.ceil(results.length * 0.6), // Assume 60% of results are relevant
  };

  // Calculate Precision
  const precision = groundTruth.truePositive / groundTruth.totalRetrieved;

  // Calculate Recall
  const recall = groundTruth.truePositive / groundTruth.totalRelevant;

  // Calculate F1 Measure
  const f1Measure = (2 * (precision * recall)) / (precision + recall || 1);

  return {
    precision: isNaN(precision) ? 0 : precision.toFixed(4),
    recall: isNaN(recall) ? 0 : recall.toFixed(4),
    f1Measure: isNaN(f1Measure) ? 0 : f1Measure.toFixed(4),
  };
};

// Fungsi untuk menghitung Jaccard Similarity
const jaccardSimilarity = (setA, setB) => {
  const intersection = new Set([...setA].filter((x) => setB.has(x))); // Irisan
  const union = new Set([...setA, ...setB]); // Gabungan
  return intersection.size / union.size; // Similarity
};

// Fungsi untuk melakukan pencarian dokumen berdasarkan Jaccard Similarity
const searchDocumentsWithJaccard = async (query) => {
  // Ambil semua dokumen dari MongoDB
  const documents = await documentCollections.find({}).toArray();

  // Tokenisasi dan stemming query
  const queryStemmed = stemText(query); // Stemming pada query
  const querySet = new Set(queryStemmed.split(/\s+/)); // Pisahkan query yang sudah di-stem menjadi kata-kata

  // Hitung kesamaan Jaccard untuk setiap dokumen
  const results = documents.map((doc) => {
    // Tokenisasi dan stemming paragraph dokumen
    const docStemmed = stemText(doc.paragraph); // Stemming pada paragraph dokumen
    const docSet = new Set(docStemmed.split(/\s+/)); // Pisahkan paragraph yang sudah di-stem menjadi kata-kata

    // Hitung Jaccard Similarity
    const similarity = jaccardSimilarity(querySet, docSet); // Hitung Jaccard Similarity

    return {
      document_id: doc._id,
      title: doc.title,
      paragraph: doc.paragraph,
      imageSrc: doc.imageSrc,
      similarity: similarity,
    };
  });

  // Filter dokumen yang memiliki kesamaan > 0
  const filteredResults = results.filter((result) => result.similarity > 0);

  // Urutkan berdasarkan nilai similarity tertinggi
  filteredResults.sort((a, b) => b.similarity - a.similarity);

  return filteredResults;
};

const cosineSimilarity = (vec1, vec2) => {
  const dotProduct = Object.keys(vec1).reduce((sum, key) => {
    return sum + (vec1[key] || 0) * (vec2[key] || 0);
  }, 0);

  const magnitudeVec1 = Math.sqrt(
    Object.values(vec1).reduce((sum, val) => sum + val * val, 0)
  );
  const magnitudeVec2 = Math.sqrt(
    Object.values(vec2).reduce((sum, val) => sum + val * val, 0)
  );

  if (!magnitudeVec1 || !magnitudeVec2) return 0;
  return dotProduct / (magnitudeVec1 * magnitudeVec2);
};

const searchDocuments = async (query) => {
  // Ambil semua hasil TF-IDF dari MongoDB
  const tfidfDocs = await tfidfCollection.find({}).toArray();

  // Menghitung vektor TF-IDF untuk query
  const tfidf = new tfIdf();
  tfidfDocs.forEach((doc) => {
    tfidf.addDocument(doc.tfidf_scores); // Pastikan doc.tfidf_scores adalah teks dokumen
  });

  // Tambahkan query sebagai dokumen baru
  tfidf.addDocument(query);
  const queryVector = tfidf.listTerms(tfidfDocs.length).reduce((acc, term) => {
    acc[term.term] = term.tfidf; // Membuat vektor untuk query
    return acc;
  }, {});

  // Periksa apakah ada dokumen yang relevan berdasarkan query
  const relevantResults = tfidfDocs.filter((doc) => {
    const docTfidfScores = doc.tfidf_scores; // TF-IDF dari dokumen
    return Object.keys(queryVector).some((term) => docTfidfScores[term] > 0); // Pastikan ada skor TF-IDF untuk term dalam dokumen
  });

  // Jika tidak ada dokumen relevan, kembalikan array kosong
  if (relevantResults.length === 0) {
    return [];
  }

  // Hitung kemiripan untuk setiap dokumen relevan
  const results = relevantResults.map((doc) => {
    const docTfidfScores = doc.tfidf_scores; // TF-IDF dari dokumen
    const similarity = cosineSimilarity(queryVector, docTfidfScores); // Menghitung kemiripan

    return {
      document_id: doc.document_id,
      title: doc.title,
      paragraph: doc.paragraph,
      imageSrc: doc.imageSrc,
      similarity: similarity,
    };
  });

  // Urutkan dokumen berdasarkan nilai similarity tertinggi
  results.sort((a, b) => b.similarity - a.similarity);

  return results;
};

app.get("/", (req, res) => {
  res.send("Hallo halo");
});

app.post("/search", async (req, res) => {
  const stemmed = [];
  const { query, page = 1, limit = 10 } = req.body; // Ambil page dan limit dari body, default ke 1 dan 10
  if (!query) {
    return res.status(400).send("Query tidak boleh kosong");
  }
  const words = tokenizer.tokenize(query);
  for (const word of words) {
    stemmed.push(stemmer.stem(word));
  }
  try {
    const startTime = performance.now();
    // Proses pencarian
    const results = await searchDocuments(stemmed.join(" "));
    const endTime = performance.now();
    const runtimeDuration = (endTime - startTime).toFixed(4);
    const totalResults = results.length; // Total hasil pencarian
    const totalPages = Math.ceil(totalResults / limit); // Total halaman
    const startIndex = (page - 1) * limit; // Indeks awal untuk slice
    const endIndex = startIndex + limit; // Indeks akhir untuk slice
    const paginatedResults = results.slice(startIndex, endIndex); // Ambil hasil sesuai pagination
    const evaluationMetrics = calculateEvaluationMetrics(results);

    // Kirim respons dengan data pagination
    res.status(200).json({
      page,
      limit,
      totalResults,
      totalPages,
      results: paginatedResults,
      runtime: `${runtimeDuration} ms`,
      evaluationMetrics,
    });
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).send("Terjadi kesalahan pada server");
  }
});

app.post("/search-jaccard", async (req, res) => {
  const { query, page = 1, limit = 10 } = req.body; // Ambil query, page, dan limit dari body
  if (!query) {
    return res.status(400).send("Query tidak boleh kosong");
  }

  try {
    const startTime = performance.now();
    // Panggil fungsi searchDocumentsWithJaccard
    const results = await searchDocumentsWithJaccard(query);
    const endTime = performance.now();
    const runtimeDuration = (endTime - startTime).toFixed(4);
    // Pagination
    const totalResults = results.length; // Total hasil pencarian
    const totalPages = Math.ceil(totalResults / limit); // Total halaman
    const startIndex = (page - 1) * limit; // Indeks awal untuk slice
    const endIndex = startIndex + limit; // Indeks akhir untuk slice
    const paginatedResults = results.slice(startIndex, endIndex); // Ambil hasil sesuai pagination

    const evaluationMetrics = calculateEvaluationMetrics(results, 0.01);

    // Kirim respons dengan hasil paginasi
    res.status(200).json({
      page,
      limit,
      totalResults,
      totalPages,
      results: paginatedResults,
      runtime: `${runtimeDuration} ms`,
      evaluationMetrics,
    });
  } catch (error) {
    console.error("Error during Jaccard search:", error);
    res.status(500).send("Terjadi kesalahan pada server");
  }
});

app.get("/documents/:id", async (req, res) => {
  const documentId = req.params.id; // Ambil ID dari parameter URL

  try {
    // Cari dokumen di koleksi menggunakan ID
    const document = await documentCollections.findOne({
      _id: new mongoose.Types.ObjectId(documentId),
    });

    if (!document) {
      return res.status(404).json({ message: "Dokumen tidak ditemukan" });
    }

    // Kirim respons dengan dokumen
    res.status(200).json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
});

// Memanggil fungsi koneksi dan memulai server
connectDB()
  .then(() => {
    tfidfCollection = mongoose.connection.collection("tfidf_results");
    documentCollections = mongoose.connection.collection("documents");
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch(console.dir);

const express = require("express");
const mongoose = require("mongoose");
const { configDotenv } = require("dotenv");
const cors = require("cors");
const natural = require('natural');
const tfIdf = natural.TfIdf;
const bodyParser = require('body-parser');


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
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Koneksi ke MongoDB gagal:", error);
    process.exit(1); // Keluar dari proses jika koneksi gagal
  }
}

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
  tfidfDocs.forEach(doc => {
    tfidf.addDocument(doc.tfidf_scores); // Pastikan doc.tfidf_scores adalah teks dokumen
  });

  tfidf.addDocument(query); // Tambahkan query sebagai dokumen baru
  const queryVector = tfidf.listTerms(tfidfDocs.length).reduce((acc, term) => {
    acc[term.term] = term.tfidf; // Membuat vektor untuk query
    return acc;
  }, {});

  // Hitung kemiripan untuk setiap dokumen
  const results = tfidfDocs.map(doc => {
    const docTfidfScores = doc.tfidf_scores; // TF-IDF dari dokumen
    const similarity = cosineSimilarity(queryVector, docTfidfScores); // Menghitung kemiripan

    return {
      document_id: doc.document_id,
      title: doc.title,
      similarity: similarity
    };
  });

  // Urutkan dokumen berdasarkan nilai similarity tertinggi
  results.sort((a, b) => b.similarity - a.similarity);

  return results;
};

app.post("/search", async (req, res) => {
    const { query, page = 1, limit = 10 } = req.body; // Ambil page dan limit dari body, default ke 1 dan 10
    if (!query) {
      return res.status(400).send("Query tidak boleh kosong");
    }
  
    try {
      // Proses pencarian
      const results = await searchDocuments(query);
      
      // Pagination
      const totalResults = results.length; // Total hasil pencarian
      const totalPages = Math.ceil(totalResults / limit); // Total halaman
      const startIndex = (page - 1) * limit; // Indeks awal untuk slice
      const endIndex = startIndex + limit; // Indeks akhir untuk slice
      const paginatedResults = results.slice(startIndex, endIndex); // Ambil hasil sesuai pagination
  
      // Kirim respons dengan data pagination
      res.status(200).json({
        page,
        limit,
        totalResults,
        totalPages,
        results: paginatedResults,
      });
    } catch (error) {
      console.error("Error during search:", error);
      res.status(500).send("Terjadi kesalahan pada server");
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

const express = require("express");
const mongoose = require("mongoose");
const { configDotenv } = require("dotenv");
const cors = require("cors");
const natural = require('natural');
const bodyParser = require('body-parser');
const { Stemmer, Tokenizer } = require('sastrawijs');



const stemmer = new Stemmer()
const tokenizer = new Tokenizer()
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

  // Tambahkan query sebagai dokumen baru
  tfidf.addDocument(query); 
  const queryVector = tfidf.listTerms(tfidfDocs.length).reduce((acc, term) => {
    acc[term.term] = term.tfidf; // Membuat vektor untuk query
    return acc;
  }, {});

  // Periksa apakah ada dokumen yang relevan berdasarkan query
  const relevantResults = tfidfDocs.filter(doc => {
    const docTfidfScores = doc.tfidf_scores; // TF-IDF dari dokumen
    return Object.keys(queryVector).some(term => docTfidfScores[term] > 0); // Pastikan ada skor TF-IDF untuk term dalam dokumen
  });

  // Jika tidak ada dokumen relevan, kembalikan array kosong
  if (relevantResults.length === 0) {
    return [];
  }

  // Hitung kemiripan untuk setiap dokumen relevan
  const results = relevantResults.map(doc => {
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

// const evaluateResults = (predictedResults, actualResults) => {
//   // console.log(actualResults);
//   const relevantDocs = new Set(actualResults.map(doc => doc._id));
//   const retrievedDocs = new Set(predictedResults.map(doc => doc.document_id));
//   // console.log(relevantDocs);
//   // console.log(retrievedDocs);
//   // Precision
//   const truePositive = Array.from(retrievedDocs).filter(docId => relevantDocs.has(docId)).length;

//   // console.log("retrieve",Array.from(retrievedDocs));
//   // console.log("relevan",Array.from(relevantDocs));
//   const precision = truePositive / retrievedDocs.size;
//   // console.log(precision);

//   // Recall
//   const recall = truePositive / relevantDocs.size;

//   // F1 Score
//   const f1Score = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;

//   // Mean Average Precision (MAP)
//   const averagePrecision = predictedResults.reduce((sum, result, index) => {
//     const currentRelevantDocs = predictedResults.slice(0, index + 1).filter(doc => relevantDocs.has(doc._id)).length;
//     return sum + (currentRelevantDocs / (index + 1));
//   }, 0) / predictedResults.length;

//   return {
//     precision,
//     recall,
//     f1Score,
//     meanAveragePrecision: averagePrecision,
//   };
// };

// const getActualRelevantResults = async (query) => {
//   // Tokenisasi dan stemming query untuk meningkatkan relevansi
//   const words = tokenizer.tokenize(query);
//   const stemmedWords = words.map(word => stemmer.stem(word));

//   // Mencari dokumen yang relevan berdasarkan title atau content
//   return await documentCollections.find({
//     $or: [
//       { title: { $regex: new RegExp(stemmedWords.join('|'), 'i') } }, // Mencari di title
//       { paragraph: { $regex: new RegExp(stemmedWords.join('|'), 'i') } }  // Mencari di content
//     ]
//   }).toArray();
// };

app.get('/', (req, res) => {
  res.send("Hallo halo");
});

app.post("/search", async (req, res) => {
    const stemmed = []
    const { query, page = 1, limit = 10 } = req.body; // Ambil page dan limit dari body, default ke 1 dan 10
    if (!query) {
      return res.status(400).send("Query tidak boleh kosong");
    }
    const words = tokenizer.tokenize(query);
    for (const word of words) {
      stemmed.push(stemmer.stem(word))
    }
    try {
      // Proses pencarian
      const results = await searchDocuments(stemmed.join(' '));
      // const actualResults = await getActualRelevantResults(query);
      // console.log(actualResults);
      // const evaluationMetrics = evaluateResults(results, actualResults);
      // console.log(evaluationMetrics);
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
        evaluationMetrics,
      });
    } catch (error) {
      console.error("Error during search:", error);
      res.status(500).send("Terjadi kesalahan pada server");
    }
  });

  app.get("/documents/:id", async (req, res) => {
    const documentId = req.params.id; // Ambil ID dari parameter URL

    try {
        // Cari dokumen di koleksi menggunakan ID
        const document = await documentCollections.findOne({ _id: new mongoose.Types.ObjectId(documentId) });

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

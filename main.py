from pymongo import MongoClient
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from nltk.corpus import stopwords
import numpy as np
import nltk


# Mengambil stopwords bahasa Indonesia
nltk.download('stopwords')
stop_words = set(stopwords.words('indonesian'))

# Koneksi ke MongoDB
client = MongoClient('mongodb+srv://rafliafrz:1UF17uSeZylUiWTU@rafliafriza.wksq4.mongodb.net/?retryWrites=true&w=majority&appName=rafliafriza')
db = client['search_engine']  # Nama database
doc_collection = db['documents']  # Collection dokumen
tfidf_collection = db['tfidf_results']  # Collection untuk hasil TF-IDF

def get_documents_from_db():
    documents = list(doc_collection.find({}, {'_id': 1,'url': 1, 'title': 1, 'paragraph': 1}))
    return documents


def preprocess_text(text):
    # Mengubah teks menjadi lowercase dan menghapus karakter khusus
    text = re.sub(r'\W', ' ', text.lower())
    return text

def calculate_tfidf(documents):
    # Ambil konten dokumen setelah diproses
    corpus = [preprocess_text(doc['paragraph']) for doc in documents]
    vectorizer = TfidfVectorizer(stop_words=list(stop_words))
    tfidf_matrix = vectorizer.fit_transform(corpus)
    terms = vectorizer.get_feature_names_out()
    return tfidf_matrix, terms

def save_tfidf_results(documents, tfidf_matrix, terms):
    for i, doc in enumerate(documents):
        # Ambil skor TF-IDF untuk dokumen
        tfidf_scores = {}
        for j in range(len(terms)):
            score = tfidf_matrix[i, j]
            if score > 0:  # Simpan hanya kata-kata yang memiliki nilai TF-IDF
                tfidf_scores[terms[j]] = score
        
        # Simpan ke MongoDB
        tfidf_collection.insert_one({
            'document_id': doc['_id'],
            'title': doc['title'],
            'tfidf_scores': tfidf_scores
        })

def main():
    # Langkah 1: Ambil dokumen dari MongoDB
    documents = get_documents_from_db()
    
    # Langkah 2: Hitung TF-IDF
    tfidf_matrix, terms = calculate_tfidf(documents)
    
    # Langkah 3: Simpan hasil TF-IDF ke MongoDB
    save_tfidf_results(documents, tfidf_matrix, terms)
    
    print("Proses perhitungan TF-IDF selesai dan disimpan di MongoDB.")

if __name__ == '__main__':
    main()
import pymongo

# Koneksi ke MongoDB
client = pymongo.MongoClient("mongodb+srv://rafliafrz:1UF17uSeZylUiWTU@rafliafriza.wksq4.mongodb.net/search_engine?retryWrites=true&w=majority&appName=rafliafriza")
db = client['search_engine']
tfidf_collection = db['tfidf_results']

# Fungsi untuk menghitung precision, recall, dan F1 score
def evaluate_precision_recall_f1(predictions, ground_truth):
    true_positives = sum(predictions[i] == ground_truth[i] == 1 for i in range(len(predictions)))
    false_positives = sum(predictions[i] == 1 and ground_truth[i] == 0 for i in range(len(predictions)))
    false_negatives = sum(predictions[i] == 0 and ground_truth[i] == 1 for i in range(len(predictions)))

    precision = true_positives / (true_positives + false_positives) if true_positives + false_positives > 0 else 0
    recall = true_positives / (true_positives + false_negatives) if true_positives + false_negatives > 0 else 0
    f1_score = 2 * (precision * recall) / (precision + recall) if precision + recall > 0 else 0

    return precision, recall, f1_score

# Simulasi pencarian dokumen
def search_documents(query):
    # Buat text index untuk pencarian
    tfidf_collection.create_index([("title", "text")])
    
    # Ambil dokumen berdasarkan query
    results = tfidf_collection.find({"$text": {"$search": query}})
    
    # Tentukan relevansi dokumen (anggapkan relevansi berdasarkan threshold TF-IDF)
    predictions = []
    for doc in results:
        print(f"Document ID: {doc['_id']}, Title: {doc['title']}")
        # Misalkan threshold untuk menentukan relevansi dokumen berdasarkan nilai tf-idf
        threshold = 0.1
        tfidf_scores = doc.get('tfidf_scores', {})
        
        # Cek apakah ada nilai TF-IDF yang di atas threshold
        is_relevant = 1 if any(score > threshold for score in tfidf_scores.values()) else 0
        predictions.append(is_relevant)

    return predictions

# Main function
def main():
    query = input("Masukkan query pencarian: ")
    predictions = search_documents(query)

    # Dummy ground truth (Anda dapat mengganti ini dengan hasil yang benar)
    ground_truth = [1 for _ in range(len(predictions))]  # Anggap semua dokumen seharusnya relevan sebagai contoh

    # Hitung precision, recall, dan F1 score
    precision, recall, f1_score = evaluate_precision_recall_f1(predictions, ground_truth)
    print(f'Precision: {precision:.2f}')
    print(f'Recall: {recall:.2f}')
    print(f'F1 Score: {f1_score:.2f}')

if __name__ == "__main__":
    main()

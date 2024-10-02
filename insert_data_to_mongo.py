import json
from pymongo import MongoClient

# Koneksi ke MongoDB Atlas
client = MongoClient('mongodb+srv://rafliafrz:1UF17uSeZylUiWTU@rafliafriza.wksq4.mongodb.net/?retryWrites=true&w=majority&appName=rafliafriza')

# Mengakses database dan collection
db = client['search_engine']  # Nama database
doc_collection = db['documents']  # Collection dokumen

# Membaca file JSON
with open('results.json') as file:
    data = json.load(file)  # Mengonversi file JSON ke dalam list of dicts

# Memasukkan data ke MongoDB
if isinstance(data, list):  # Pastikan data berbentuk list
    doc_collection.insert_many(data)  # Memasukkan banyak dokumen sekaligus
    print(f"{len(data)} dokumen berhasil dimasukkan ke MongoDB Atlas")
else:
    doc_collection.insert_one(data)  # Jika hanya satu dokumen
    print("Satu dokumen berhasil dimasukkan ke MongoDB Atlas")

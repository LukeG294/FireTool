const multer = require('multer');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Set up multer for file uploads
const upload = multer({ dest: '/tmp/' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  upload.single('serviceAccount')(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ message: 'File upload error: ' + err.message });
    }

    const fieldName = req.body.fieldName;
    const fieldValue = req.body.fieldValue;
    const collectionPath = req.body.collectionPath;
    const serviceAccountPath = req.file.path;

    // Validate the collection path
    if (collectionPath.split('/').length % 2 === 0) {
      fs.unlinkSync(serviceAccountPath); // Clean up uploaded file
      return res.status(400).json({ message: 'Invalid collection path. Your path does not contain an odd number of components.' });
    }

    try {
      // Read and parse the service account file
      const data = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(data);

      // Initialize Firebase with the service account
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      const db = admin.firestore();

      // Update all documents in the specified collection
      const collectionRef = db.collection(collectionPath);
      const snapshot = await collectionRef.get();
      const batch = db.batch();
      snapshot.forEach((doc) => {
        if (fieldValue.trim() === '') {
          // If the new field value is blank, delete the field
          batch.update(doc.ref, { [fieldName]: admin.firestore.FieldValue.delete() });
        } else {
          // Otherwise, update the field with the new value
          batch.update(doc.ref, { [fieldName]: fieldValue });
        }
      });
      await batch.commit();

      res.status(200).json({ message: 'Documents updated successfully. Service account deleted from server.' });
    } catch (error) {
      res.status(500).json({ message: 'Error: ' + error.message });
    } finally {
      // Clean up uploaded file
      fs.unlinkSync(serviceAccountPath);
    }
  });
}

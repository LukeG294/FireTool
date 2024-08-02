const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const app = express();
const port = 3000;

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.single('serviceAccount'), async (req, res, next) => {
  const fieldName = req.body.fieldName;
  const fieldValue = req.body.fieldValue;
  const collectionPath = req.body.collectionPath;
  const serviceAccountPath = req.file.path;

  // Validate the collection path
  if (collectionPath.split('/').length % 2 === 0) {
    fs.unlinkSync(serviceAccountPath); // Clean up uploaded file
    return res.status(400).send('Invalid collection path. Your path does not contain an odd number of components.');
  }

  try {
    // Read and parse the service account file
    const data = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(data);

    // Initialize Firebase with the service account
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
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

    res.send('Documents updated successfully. Service account deleted from server.');
  } catch (error) {
    next(error); // Pass error to the error-handling middleware
  } finally {
    // Clean up uploaded file
    fs.unlinkSync(serviceAccountPath);
  }
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong: ' + err.message);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

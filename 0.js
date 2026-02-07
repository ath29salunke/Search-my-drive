const express = require('express');
const chokidar = require('chokidar');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');
app.use(express.static('public'));





const bucketName = 'gitte45';
const folderPath = path.join(__dirname, 'local-drive');

const storage = new Storage({
  keyFilename: 'C:\\Users\\athar\\final_sem_project\\service-account-key.json', // e.g., './gcs-key.json'
});
const bucket = storage.bucket(bucketName);

// 👁️ Watch local folder
chokidar.watch(folderPath, { ignoreInitial: true })
  .on('add', async filePath => {
    const fileName = path.basename(filePath);
    console.log(` New file: ${fileName}`);

    // Upload to GCS
    await bucket.upload(filePath, {
      destination: fileName,
    });
    console.log(` Uploaded ${fileName} to GCS`);
  });

// 🌐 Show list of files
app.get('/', async (req, res) => {
  const [files] = await bucket.getFiles();
  res.render('index', { files });
});

// 📥 Download file
app.get('/download/:filename', async (req, res) => {
  const file = bucket.file(req.params.filename);
  const dest = path.join(__dirname, req.params.filename);

  await file.download({ destination: dest });
  res.download(dest, () => fs.unlinkSync(dest));
});

// 🗑️ Delete file
app.get('/delete/:filename', async (req, res) => {
  await bucket.file(req.params.filename).delete();
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

const express = require('express');
const session = require('express-session');
const chokidar = require('chokidar');
const { Storage } = require('@google-cloud/storage');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });


const app = express();
const PORT = 8080;

const CLIENT_ID = '429842104924-d5hgqu6s9mif9a9sed4adp1cqorrp56o.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:8080/oauth2callback';
const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));

const bucketName = 'gitte45';
const folderPath = path.join(__dirname, 'local-drive');

const storage = new Storage({
  keyFilename: 'C:\\Users\\athar\\final_sem_project\\service-account-key.json',
});
const bucket = storage.bucket(bucketName);

chokidar.watch(folderPath, { ignoreInitial: true })
  .on('add', async filePath => {
    const fileName = path.basename(filePath);
    console.log(`📁 New file: ${fileName}`);
    await bucket.upload(filePath, { destination: fileName });
    console.log(`✅ Uploaded ${fileName} to GCS`);
  });
  function ensureAuthenticated(req, res, next) {
  if (req.session.token) return next();
  res.redirect('/login');
}
app.get('/login', (req, res) => {
  res.render('login');
});


app.get('/auth', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  req.session.token = tokens.access_token;
  res.redirect('/');
});

app.get('/search', (req, res) => {
  res.render('search', { token: req.session.token || '' });
});

app.get('/about', (req, res) => {
  res.render('about', { token: req.session.token || '' });
});

app.get('/', ensureAuthenticated, async (req, res) => {
  const [files] = await bucket.getFiles();
  res.render('index', {
    files,
    token: req.session.token || ''
  });
});

app.get('/download/:filename', async (req, res) => {
  const file = bucket.file(req.params.filename);
  const dest = path.join(__dirname, req.params.filename);
  await file.download({ destination: dest });
  res.download(dest, () => fs.unlinkSync(dest));
});

app.get('/delete/:filename', async (req, res) => {
  await bucket.file(req.params.filename).delete();
  res.redirect('/');
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const localPath = req.file.path;
  const originalName = req.file.originalname;

  await bucket.upload(localPath, { destination: originalName });
  fs.unlinkSync(localPath); // Clean up local file after upload

  res.redirect('/');
});

app.get('/view/:filename', async (req, res) => {
  const file = bucket.file(req.params.filename);

  try {
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    res.redirect(url);
  } catch (err) {
    console.error('Signed URL error:', err);
    res.status(403).send('Forbidden: ' + err.message);
  }
});



app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

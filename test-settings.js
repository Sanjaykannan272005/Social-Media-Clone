const express = require('express');
const app = express();

app.get('/test-settings', (req, res) => {
  res.send(`
    <h1>Settings Test Page</h1>
    <p>This is a test page to verify the settings route is working.</p>
    <a href="/settings">Go to Settings</a>
  `);
});

app.listen(3001, () => {
  console.log('Test server running on http://localhost:3001/test-settings');
});
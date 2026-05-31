import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let app = fs.readFileSync(path.join(__dirname, 'app.full.js'), 'utf8');

if (!app.includes('retrySyncProfile')) {
  app = app.replace(
    `    redirectAfterAuth(event) {`,
    `    async retrySyncProfile() {
      this.sessionSyncing = true;
      const ok = await this.syncUserProfile();
      this.sessionSyncing = false;
      this.refreshIcons();
      if (ok) this.navigate('dashboard');
    },

    redirectAfterAuth(event) {`
  );
  app = app.replace(
    `      if (route === 'nutrition') this.loadNutrition();
      this.refreshIcons();`,
    `      if (route === 'nutrition') this.loadNutrition();
      if (route === 'profile' && !this.profile) this.syncUserProfile();
      this.refreshIcons();`
  );
  fs.writeFileSync(path.join(__dirname, 'app.full.js'), app, 'utf8');
}

fs.writeFileSync(path.join(root, 'app.js'), app, 'utf8');
fs.writeFileSync(
  path.join(root, 'index.html'),
  fs.readFileSync(path.join(__dirname, 'index.full.html'), 'utf8'),
  'utf8'
);

console.log('OK: app.js + index.html (UTF-8)');

# Social Media App Deployment Guide

## Prerequisites
- Node.js 18+ installed
- Neon PostgreSQL database
- Domain name and SSL certificate
- VPS/Cloud server (DigitalOcean, AWS, etc.)

## Step 1: Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

## Step 2: Database Setup
1. Go to Neon.tech and create production database
2. Run the SQL from database.sql in your Neon console
3. Copy the connection string

## Step 3: Deploy Application
```bash
# Clone/upload your code to server
cd /var/www/
sudo git clone your-repo-url social-app
cd social-app

# Install dependencies
npm install --production

# Create production environment file
sudo nano .env
```

Add to .env:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=your_neon_production_url
SESSION_SECRET=your_32_char_secret_key
```

## Step 4: Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Step 5: Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/social-app
```

Add configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/social-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Step 7: Firewall Setup
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

## Monitoring
```bash
# Check app status
pm2 status
pm2 logs

# Monitor server resources
htop
```

## Backup Strategy
- Database: Use Neon's built-in backups
- Files: Regular server backups
- Code: Git repository

Your social media app is now live at https://yourdomain.com!
# Deploy ke Oracle Cloud Free Tier (Gratis Selamanya)

## Kelebihan
- **Always Free** — tidak perlu kartu kredit, gratis selamanya
- **4 ARM CPU + 24GB RAM** — sangat powerful untuk POS
- **Server Singapore** — akses cepat dari Indonesia
- **Full Docker support** — jalankan docker-compose lengkap

## Langkah Deploy

### 1. Buat Akun Oracle Cloud
1. Buka https://cloud.oracle.com/free
2. Klik **Start for Free**
3. Daftar dengan email (bisa Gmail)
4. **Tidak perlu kartu kredit** — pilih **Pay As You Go** (tidak akan dikenakan biaya untuk free tier resources)

### 2. Buat VM Instance
1. Login ke Oracle Cloud Console
2. Menu: **Compute** → **Instances** → **Create Instance**
3. Setting:
   - **Name:** `pos-warungkopi`
   - **Image:** Ubuntu 22.04 (atau 24.04) aarch64/ARM
   - **Shape:** **VM.Standard.A1.Flex** (Always Free eligible)
     - OCPUs: **4**
     - Memory: **24 GB**
   - **VNIC:** Default
   - **SSH Keys:** Upload public key SSH Anda
     - Jika belum punya: `ssh-keygen -t ed25519 -C "koyeb"` lalu paste isi `~/.ssh/id_ed25519.pub`
4. Klik **Create**
5. Catat **Public IP Address**

### 3. Setup Security List (Firewall)
1. Menu: **Networking** → **Virtual Cloud Networks** → klik VCN instance
2. Klik **Default Security List** → **Add Ingress Rules**
3. Tambahkan:
   - **Port 22** (SSH): Source `0.0.0.0/0`
   - **Port 80** (HTTP): Source `0.0.0.0/0`
   - **Port 443** (HTTPS): Source `0.0.0.0/0`

### 4. SSH ke Instance
```bash
ssh ubuntu@<PUBLIC_IP>
```

### 5. Install Docker & Deploy
Paste script berikut di terminal SSH:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
newgrp docker

# Clone repo
cd /home/ubuntu
git clone https://github.com/pedip78/POS-WarungKopi.git
cd POS-WarungKopi

# Buat file .env
cat > backend/.env << 'EOF'
APP_NAME=Sotoyuk
APP_ENV=production
DEBUG=false
SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=postgresql+psycopg://kasir:kasir@db:5432/kasir
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=kasir
POSTGRES_USER=kasir
POSTGRES_PASSWORD=kasir
CORS_ORIGINS=http://localhost,https://localhost
EOF

# Build & jalankan
sudo docker compose up -d --build
```

### 6. Aplikasi Berjalan
- **URL:** `http://<PUBLIC_IP>`
- **Login:**

| Role | Username | Password |
|------|----------|----------|
| Superadmin | `superadmin` | `superadmin` |
| Admin | `admin utama` | `admin` |
| Kasir | `kasir utama` | `kasir1` |

### 7. (Opsional) Setup Domain + HTTPS
Jika punya domain, install Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Buat config nginx:
```bash
sudo tee /etc/nginx/sites-available/pos << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN.COM;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/pos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN.COM
```

### 8. (Opsional) Auto-restart saat reboot
Docker biasanya auto-start. Jika tidak:
```bash
sudo systemctl enable docker
```

## Troubleshooting

### Cek status container
```bash
cd /home/ubuntu/POS-WarungKopi
sudo docker compose ps
sudo docker compose logs backend
```

### Restart aplikasi
```bash
sudo docker compose down && sudo docker compose up -d --build
```

### Reset database
```bash
sudo docker compose down -v
sudo docker compose up -d --build
```

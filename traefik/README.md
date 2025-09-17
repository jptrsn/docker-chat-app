# Traefik Reverse Proxy - Docker Bootcamp

## Quick Setup Guide

### Option 1: Manual DNS Verification (No API Keys Needed)
```bash
# Navigate to traefik directory
cd traefik/

# Configure for manual DNS
cp .env.example .env
nano .env  # Set CERT_RESOLVER=manual, ENABLE_MANUAL_DNS=true

# Run setup script
chmod +x setup.sh
./setup.sh

# Generate SSL certificates manually
chmod +x generate-manual-cert.sh
./generate-manual-cert.sh
```

### Option 2: Automatic DNS Challenge (API Keys Required)
```bash
# Navigate to traefik directory
cd traefik/

# Configure for automatic DNS
cp .env .env.local
nano .env.local  # Set CERT_RESOLVER=letsencrypt, add API credentials

# Run setup script
chmod +x setup.sh
./setup.sh
```

## Manual DNS Verification Process

When using manual DNS verification, you'll be prompted to create TXT records:

1. **Start certificate generation**: `./generate-manual-cert.sh`
2. **Create TXT records** when prompted:
   ```
   Record Name: _acme-challenge.yourdomain.com
   Record Type: TXT
   Record Value: [provided by the script]
   TTL: 300 (5 minutes)
   ```
3. **Wait for DNS propagation** (1-5 minutes)
4. **Verify DNS propagation**:
   ```bash
   # Check if TXT record is visible
   dig TXT _acme-challenge.yourdomain.com
   # or
   nslookup -type=TXT _acme-challenge.yourdomain.com
   ```
5. **Continue verification** when DNS has propagated

### Benefits of Manual DNS Verification
- ✅ **No API keys needed** - Perfect for bootcamp environments
- ✅ **Works with any DNS provider** - Cloudflare, Namecheap, GoDaddy, etc.
- ✅ **Educational value** - Shows how DNS challenges work
- ✅ **Secure** - No stored credentials in containers
- ❌ **Manual process** - Requires human intervention
- ❌ **No auto-renewal** - Certificates need manual renewal every 90 days

## Key Learning Concepts

### 🌐 Docker Networking
- **External Network**: The `proxy` network connects Traefik to your applications
- **Bridge Networks**: Internal networks for database communication
- **Service Discovery**: Traefik automatically discovers containers with labels

### 🏷️ Traefik Labels
Your applications use labels to configure routing:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.app.rule=Host(`example.com`)"
  - "traefik.http.routers.app.entrypoints=websecure"
  - "traefik.http.routers.app.tls.certresolver=letsencrypt"
```

### 🔒 SSL Automation
- **DNS Challenge**: Works behind NAT/firewalls
- **Automatic Certificates**: Let's Encrypt integration
- **Auto-Renewal**: Certificates renew automatically

## Essential Commands

### Service Management
```bash
# Start Traefik
docker compose up -d

# View logs
docker compose logs -f traefik

# Stop Traefik
docker compose down

# Restart Traefik
docker compose restart traefik
```

### Network Inspection
```bash
# List all networks
docker network ls

# Inspect the proxy network
docker network inspect proxy

# See which containers are connected
docker network inspect proxy | jq '.[].Containers'
```

### SSL Certificate Management
```bash
# View certificate storage
docker exec traefik cat /letsencrypt/acme.json | jq '.'

# Check certificate expiration
docker exec traefik cat /letsencrypt/acme.json | jq '.cloudflare.Certificates[].certificate' | base64 -d | openssl x509 -text -noout | grep "Not After"

# Force certificate renewal (if needed)
docker exec traefik rm /letsencrypt/acme.json
docker-compose restart traefik
```

### Troubleshooting
```bash
# Check container status
docker compose ps

# View detailed logs
docker compose logs --tail=50 traefik

# Test connectivity to your app
docker exec traefik wget -q --spider http://chat-client:3000 && echo "Client reachable"
docker exec traefik wget -q --spider http://chat-server:3001/api/health && echo "Server reachable"

# Check DNS resolution
nslookup your-domain.com
```

## File Structure
```
traefik/
├── docker-compose.yml     # Traefik service definition
├── .env                   # Configuration variables
├── setup.sh              # Automated setup script
├── data/
│   └── letsencrypt/
│       └── acme.json     # SSL certificates
└── BOOTCAMP.md           # This file
```

## Accessing Services

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard | http://localhost:8080 | Traefik admin interface |
| Dashboard (SSL) | https://traefik.your-domain.com | Secure dashboard access |
| Your App | https://your-domain.com | Main application |
| API Routes | https://your-domain.com/api/* | Application API |

### Common Issues & Solutions

### 1. Certificate Permission Errors
All certificate data is now stored locally in the traefik directory:
```bash
# Check what was generated
ls -la traefik/certs/live/
ls -la traefik/work/
ls -la traefik/logs/

# Clean up if needed
rm -rf traefik/certs/ traefik/work/ traefik/logs/
```

### 2. Certificate Not Generated
- Check DNS provider credentials in `.env`
- Verify domain DNS points to your server
- Check logs: `docker-compose logs traefik`

### 2. Application Not Accessible
- Verify application is on `proxy` network
- Check Traefik labels in your docker-compose.yml
- Ensure application container is running

### 3. Dashboard Not Loading
- Check if port 8080 is available
- Verify Traefik container is running
- Check firewall settings

## Production Considerations

For production deployment, modify these settings:

### Security
```yaml
# Remove insecure API access
- --api.insecure=false

# Add dashboard authentication
labels:
  - "traefik.http.middlewares.auth.basicauth.users=admin:$$2y$$10$$..."
```

### Performance
```yaml
# Enable access logs with rotation
- --accesslog.filepath=/var/log/access.log
- --accesslog.bufferingsize=100
```

### Monitoring
```yaml
# Add health checks
healthcheck:
  test: ["CMD", "traefik", "healthcheck"]
  interval: 30s
  timeout: 3s
  retries: 3
```
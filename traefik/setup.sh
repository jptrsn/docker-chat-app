#!/bin/bash

# Setup script for Traefik reverse proxy
# Docker bootcamp demonstration

set -e

echo "🚀 Setting up Traefik reverse proxy for Docker bootcamp..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions for colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running from traefik directory
if [[ ! -f "docker-compose.yml" ]]; then
    print_error "Please run this script from the traefik/ directory"
    exit 1
fi

print_status "Creating necessary directories..."
mkdir -p data/letsencrypt

print_status "Setting up SSL certificate storage..."
touch data/letsencrypt/acme.json
chmod 600 data/letsencrypt/acme.json

print_status "Creating Docker networks..."

# Create proxy network if it doesn't exist
if ! docker network ls | grep -q "proxy"; then
    docker network create proxy
    print_success "Created 'proxy' network"
else
    print_status "'proxy' network already exists"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_error "Please copy the .env template and configure your settings:"
    echo "  - Set your domain name (DOMAIN=your-domain.com)"
    echo "  - Configure DNS provider credentials"
    echo "  - Set your email for Let's Encrypt notifications"
    exit 1
fi

# Load environment variables
source .env

print_status "Validating configuration..."

# Validate required environment variables
if [ -z "$DOMAIN" ]; then
    print_error "DOMAIN is not set in .env"
    exit 1
fi

if [ -z "$ACME_EMAIL" ]; then
    print_error "ACME_EMAIL is not set in .env"
    exit 1
fi

# Check certificate resolver configuration
if [ "$CERT_RESOLVER" = "manual" ]; then
    print_success "Manual DNS verification configured - no API keys needed"
    print_warning "You'll need to manually create TXT records for SSL certificates"
    print_warning "Run './generate-manual-cert.sh' after Traefik is running"
elif [ "$CERT_RESOLVER" = "letsencrypt" ]; then
    # Check DNS provider configuration for automatic challenge
    DNS_CONFIGURED=false
    if [ ! -z "$CF_API_EMAIL" ] || [ ! -z "$CF_DNS_API_TOKEN" ]; then
        print_success "Cloudflare DNS provider configured for automatic certificates"
        DNS_CONFIGURED=true
    fi

    if [ ! -z "$AWS_ACCESS_KEY_ID" ]; then
        print_success "Route53 DNS provider configured for automatic certificates"
        DNS_CONFIGURED=true
    fi

    if [ ! -z "$DO_AUTH_TOKEN" ]; then
        print_success "DigitalOcean DNS provider configured for automatic certificates"
        DNS_CONFIGURED=true
    fi

    if [ "$DNS_CONFIGURED" = false ]; then
        print_error "Automatic certificates selected but no DNS provider configured in .env"
        print_error "Please configure DNS provider credentials or switch to manual mode:"
        print_error "Set CERT_RESOLVER=manual in .env"
        exit 1
    fi
else
    print_error "Invalid CERT_RESOLVER value: $CERT_RESOLVER"
    print_error "Must be either 'manual' or 'letsencrypt'"
    exit 1
fi

print_success "Configuration validated"

print_status "Starting Traefik..."
docker compose up -d

print_status "Waiting for Traefik to start..."
sleep 5

# Check if Traefik is running
if docker compose ps | grep -q "Up"; then
    print_success "Traefik is running!"
else
    print_error "Traefik failed to start. Check logs with:"
    print_error "docker compose logs traefik"
    exit 1
fi

print_success "Traefik setup complete!"

echo ""
echo "📊 Access Points:"
echo "   Traefik Dashboard: http://localhost:8080 (insecure for bootcamp)"
echo "   Traefik Dashboard (SSL): https://traefik.$DOMAIN"
echo ""

if [ "$CERT_RESOLVER" = "manual" ]; then
    echo "🔐 SSL Certificate Setup:"
    echo "   Run: ./generate-manual-cert.sh"
    echo "   This will guide you through creating TXT records for SSL"
    echo ""
fi

echo "🔧 Next Steps for your main application:"
echo "   1. Navigate back to your project root directory"
echo "   2. Make sure your docker-compose.yml uses the 'proxy' network"
echo "   3. Add Traefik labels to your services for routing"
echo "   4. Set CERT_RESOLVER=$CERT_RESOLVER in your main .env file"
echo "   5. Start your application: docker compose up -d"
echo ""
echo "🎓 Useful Bootcamp Commands:"
echo "   View Traefik logs: docker compose logs -f traefik"
echo "   Restart Traefik: docker compose restart traefik"
echo "   Stop Traefik: docker compose down"
echo "   Check SSL certificates: docker exec traefik cat /letsencrypt/acme.json | jq '.'"
echo "   View all containers on proxy network: docker network inspect proxy"
echo ""
echo "🔐 SSL Certificate Notes:"
if [ "$CERT_RESOLVER" = "manual" ]; then
    echo "   - Manual DNS verification selected"
    echo "   - Run './generate-manual-cert.sh' to create SSL certificates"
    echo "   - You'll need to create TXT records in your DNS provider"
    echo "   - No API keys required - works with any DNS provider"
else
    echo "   - Automatic DNS challenge selected"
    echo "   - Certificates are generated automatically via DNS API"
    echo "   - First certificate generation may take 1-2 minutes"
    echo "   - Auto-renewal happens automatically"
fi
echo "   - Certificates are stored in data/letsencrypt/acme.json"
echo ""
print_warning "Dashboard is set to insecure mode for easy bootcamp access"
print_warning "In production, enable authentication and use HTTPS only"
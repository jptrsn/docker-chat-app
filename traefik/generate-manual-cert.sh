#!/bin/bash

# Manual SSL Certificate Generation for Traefik
# This script helps generate SSL certificates using manual DNS verification

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Load environment variables
if [ -f ".env" ]; then
    source .env
else
    print_error ".env file not found!"
    exit 1
fi

if [ -z "$DOMAIN" ]; then
    print_error "DOMAIN is not set in .env"
    exit 1
fi

echo "🔐 Manual SSL Certificate Generation for $DOMAIN"
echo "================================================="
echo ""

print_status "This script will guide you through manual SSL certificate generation"
print_status "You'll need to create TXT records in your DNS provider manually"
echo ""

# Check if Traefik is running
if ! docker compose ps | grep -q "Up"; then
    print_error "Traefik is not running. Please start it first:"
    print_error "docker compose up -d"
    exit 1
fi

# Create local directories for all certbot data
CERT_DIR="./certs"
WORK_DIR="./work"
LOGS_DIR="./logs"

mkdir -p "$CERT_DIR" "$WORK_DIR" "$LOGS_DIR"

print_status "Requesting certificate for $DOMAIN and *.${DOMAIN}..."
print_warning "When prompted, you'll need to:"
print_warning "1. Create the TXT records shown in your DNS provider"
print_warning "2. Wait for DNS propagation (usually 1-5 minutes)"
print_warning "3. Press Enter to continue verification"
echo ""

print_status "Generating certificates..."
print_status "Watch for DNS challenge instructions below:"
echo ""

# Generate certificates with certbot, using local directories for everything
docker run --rm -it \
  --name certbot-manual \
  -v "$(pwd)/$CERT_DIR:/etc/letsencrypt" \
  -v "$(pwd)/$WORK_DIR:/var/lib/letsencrypt" \
  -v "$(pwd)/$LOGS_DIR:/var/log/letsencrypt" \
  certbot/certbot certonly \
    --manual \
    --preferred-challenges dns \
    --email "$ACME_EMAIL" \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "*.${DOMAIN}"

if [ $? -eq 0 ]; then
    print_success "Certificate generated successfully!"
    
    # Look for certificates in our local directory
    CERT_PATH="$CERT_DIR/live/$DOMAIN"
    
    print_status "Looking for certificates in: $CERT_PATH"
    
    # Check if we can access the certificate files directly
    if [ -f "$CERT_PATH/fullchain.pem" ] && [ -f "$CERT_PATH/privkey.pem" ]; then
        print_success "Certificate files found and accessible!"
    else
        # Try to fix permissions if files exist but aren't accessible
        print_status "Checking if certificates exist with permission issues..."
        
        if docker run --rm \
           -v "$(pwd)/$CERT_DIR:/etc/letsencrypt" \
           alpine:latest \
           test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"; then
            
            print_status "Certificates found but have permission issues. Copying with correct permissions..."
            
            # Copy certificates with correct permissions using Alpine container
            docker run --rm \
              -v "$(pwd)/$CERT_DIR:/source" \
              -v "$(pwd):/target" \
              alpine:latest \
              sh -c "
                mkdir -p /target/ssl-temp/
                # Use cat to copy files to avoid permission issues
                cat /source/live/$DOMAIN/fullchain.pem > /target/ssl-temp/fullchain.pem
                cat /source/live/$DOMAIN/privkey.pem > /target/ssl-temp/privkey.pem
                chmod 644 /target/ssl-temp/*.pem
                # Verify the copied files
                echo 'Copied fullchain.pem size:' \$(wc -c < /target/ssl-temp/fullchain.pem)
                echo 'Copied privkey.pem size:' \$(wc -c < /target/ssl-temp/privkey.pem)
                echo 'First line of fullchain:' \$(head -1 /target/ssl-temp/fullchain.pem)
                echo 'First line of privkey:' \$(head -1 /target/ssl-temp/privkey.pem)
              "
            
            if [ -f "./ssl-temp/fullchain.pem" ] && [ -f "./ssl-temp/privkey.pem" ]; then
                print_success "Certificates copied successfully!"
                CERT_PATH="./ssl-temp"
            else
                print_error "Failed to copy certificates"
                exit 1
            fi
        else
            print_error "Certificate files not found"
            print_status "Directory contents:"
            ls -la "$CERT_DIR" 2>/dev/null
            if [ -d "$CERT_DIR" ]; then
                print_status "Checking subdirectories:"
                find "$CERT_DIR" -name "*.pem" 2>/dev/null || print_status "No .pem files found"
            fi
            exit 1
        fi
    fi
    
    print_status "Converting certificates for Traefik..."
    
    # First, let's check what we actually have
    print_status "Certificate file info:"
    ls -la "$CERT_PATH/"
    
    print_status "Certificate content preview:"
    head -3 "$CERT_PATH/fullchain.pem"
    echo "..."
    tail -3 "$CERT_PATH/fullchain.pem"
    
    # Read the certificate and private key files
    if [ ! -f "$CERT_PATH/fullchain.pem" ] || [ ! -f "$CERT_PATH/privkey.pem" ]; then
        print_error "Certificate files not found at $CERT_PATH"
        exit 1
    fi
    
    # Test the original files first
    print_status "Testing original certificate file..."
    if openssl x509 -in "$CERT_PATH/fullchain.pem" -noout -text >/dev/null 2>&1; then
        print_success "Original certificate file is valid"
    else
        print_error "Original certificate file is invalid"
        openssl x509 -in "$CERT_PATH/fullchain.pem" -noout -text
        exit 1
    fi
    
    print_status "Testing original private key file..."
    # Try different key formats since modern certificates might use ECDSA or Ed25519
    if openssl rsa -in "$CERT_PATH/privkey.pem" -noout -text >/dev/null 2>&1; then
        print_success "Original private key file is valid (RSA)"
        KEY_TYPE="RSA"
    elif openssl ec -in "$CERT_PATH/privkey.pem" -noout -text >/dev/null 2>&1; then
        print_success "Original private key file is valid (ECDSA)"
        KEY_TYPE="ECDSA"
    elif openssl pkey -in "$CERT_PATH/privkey.pem" -noout -text >/dev/null 2>&1; then
        print_success "Original private key file is valid (Generic)"
        KEY_TYPE="GENERIC"
    else
        print_error "Original private key file is invalid"
        print_status "Trying to identify key type..."
        head -2 "$CERT_PATH/privkey.pem"
        file "$CERT_PATH/privkey.pem"
        exit 1
    fi
    
    # Base64 encode them properly (cross-platform compatible)
    print_status "Encoding certificates for Traefik..."
    CERT_CONTENT=$(cat "$CERT_PATH/fullchain.pem" | base64 | tr -d '\n')
    KEY_CONTENT=$(cat "$CERT_PATH/privkey.pem" | base64 | tr -d '\n')
    
    # Show some debug info
    print_status "Certificate base64 length: ${#CERT_CONTENT}"
    print_status "Private key base64 length: ${#KEY_CONTENT}"
    print_status "First 50 chars of cert base64: ${CERT_CONTENT:0:50}..."
    print_status "First 50 chars of key base64: ${KEY_CONTENT:0:50}..."
    
    # Test decoding
    print_status "Testing certificate decode..."
    if echo "$CERT_CONTENT" | base64 -d | openssl x509 -noout -text >/dev/null 2>&1; then
        print_success "Certificate base64 decode successful"
    else
        print_error "Certificate base64 decode failed"
        echo "Trying to decode first 100 chars: ${CERT_CONTENT:0:100}"
        exit 1
    fi
    
    print_status "Testing private key decode..."
    # Use the same key type detection for decode test
    if echo "$KEY_CONTENT" | base64 -d | openssl rsa -noout -text >/dev/null 2>&1; then
        print_success "Private key base64 decode successful (RSA)"
    elif echo "$KEY_CONTENT" | base64 -d | openssl ec -noout -text >/dev/null 2>&1; then
        print_success "Private key base64 decode successful (ECDSA)"
    elif echo "$KEY_CONTENT" | base64 -d | openssl pkey -noout -text >/dev/null 2>&1; then
        print_success "Private key base64 decode successful (Generic)"
    else
        print_error "Private key base64 decode failed"
        echo "Trying to decode first 100 chars: ${KEY_CONTENT:0:100}"
        echo "Key type was: $KEY_TYPE"
        exit 1
    fi
    
    # Create Traefik acme.json file
    ACME_JSON="data/letsencrypt/acme.json"
    cat > "$ACME_JSON" << EOF
{
  "manual": {
    "Account": {
      "Email": "$ACME_EMAIL",
      "Registration": {
        "body": {
          "status": "valid",
          "contact": ["mailto:$ACME_EMAIL"]
        },
        "uri": "https://acme-v02.api.letsencrypt.org/directory"
      },
      "PrivateKey": "",
      "KeyType": "4096"
    },
    "Certificates": [
      {
        "domain": {
          "main": "$DOMAIN",
          "sans": ["*.$DOMAIN"]
        },
        "certificate": "$CERT_CONTENT",
        "key": "$KEY_CONTENT",
        "Store": "default"
      }
    ]
  }
}
EOF
    
    chmod 600 "$ACME_JSON"
    print_success "Certificate installed in Traefik format"
    
    # Test the acme.json file format
    print_status "Testing acme.json format..."
    if jq empty "$ACME_JSON" >/dev/null 2>&1; then
        print_success "acme.json format is valid"
        
        # Test if certificate can be decoded from acme.json
        if jq -r '.manual.Certificates[0].certificate' "$ACME_JSON" | base64 -d | openssl x509 -noout -text >/dev/null 2>&1; then
            print_success "Certificate in acme.json is valid"
        else
            print_warning "Certificate in acme.json may have encoding issues"
        fi
        
        if jq -r '.manual.Certificates[0].key' "$ACME_JSON" | base64 -d | openssl rsa -noout -text >/dev/null 2>&1; then
            print_success "Private key in acme.json is valid (RSA)"
        elif jq -r '.manual.Certificates[0].key' "$ACME_JSON" | base64 -d | openssl ec -noout -text >/dev/null 2>&1; then
            print_success "Private key in acme.json is valid (ECDSA)"
        elif jq -r '.manual.Certificates[0].key' "$ACME_JSON" | base64 -d | openssl pkey -noout -text >/dev/null 2>&1; then
            print_success "Private key in acme.json is valid (Generic)"
        else
            print_warning "Private key in acme.json may have encoding issues"
        fi
    else
        print_error "acme.json format is invalid"
        exit 1
    fi
    
    # Clean up temporary certificate files
    if [ -d "./ssl-temp" ]; then
        print_status "Cleaning up temporary certificate files..."
        # Use Docker to remove files that were created by Docker as root
        docker run --rm \
          -v "$(pwd):/workdir" \
          alpine:latest \
          sh -c "rm -rf /workdir/ssl-temp"
        print_status "Cleaned up temporary certificate files"
    fi
    
    print_status "Restarting Traefik to load new certificates..."
    docker compose restart traefik
    
    # Give Traefik a moment to restart
    sleep 5
    
    print_status "Testing certificate..."
    if docker exec traefik cat /letsencrypt/acme.json | grep -q "$DOMAIN"; then
        print_success "Certificate successfully loaded in Traefik!"
    else
        print_warning "Certificate may not be loaded correctly in Traefik"
    fi
    
    echo ""
    print_success "🎉 SSL setup complete!"
    print_success "Your sites should now be accessible via HTTPS:"
    print_success "- https://$DOMAIN"
    print_success "- https://traefik.$DOMAIN"
    
    echo ""
    print_status "Certificate files are stored in:"
    print_status "- Original: $CERT_DIR/live/$DOMAIN/"
    print_status "- Traefik: $ACME_JSON"
    
else
    print_error "Certificate generation failed"
    print_error "Please check the error messages above and try again"
    exit 1
fi
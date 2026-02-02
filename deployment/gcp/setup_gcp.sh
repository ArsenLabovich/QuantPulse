#!/bin/bash

# Setup Script for QuantPulse on Google Cloud (Ubuntu)
# Usage: ./setup_gcp.sh

echo "🚀 Starting QuantPulse GCP Setup..."

# 1. Install Docker & Docker Compose
if ! command -v docker &> /dev/null
then
    echo "📦 Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
    echo "✅ Docker already installed."
fi

# 2. Permissions & Firewall
echo "🛡️ Configuring System..."
# Add user to docker group
sudo usermod -aG docker $USER
echo "✅ Added $USER to docker group (Log out and back in to use 'docker' without sudo)"

# 3. Configure Env
echo "⚙️ Configuring Environment..."

# Detect Public IP
PUBLIC_IP=$(curl -s ifconfig.me)
echo "🌍 Detected Public IP: $PUBLIC_IP"

# Generate Domain (nip.io)
DOMAIN="quantpulse.${PUBLIC_IP}.nip.io"
echo "🔗 Your Domain will be: https://$DOMAIN"

# Create .env file only if it doesn't exist
if [ ! -f .env ]; then
    cat > .env <<EOL
DOMAIN_NAME=$DOMAIN
POSTGRES_USER=qp_user
POSTGRES_PASSWORD=$(openssl rand -hex 12)
POSTGRES_DB=quantpulse_db
SECRET_KEY=$(openssl rand -hex 32)
# Generate a Fernet-compatible key (32 bytes, base64-encoded, url-safe)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr '+/' '-_')
EOL
    echo "✅ Generated new .env file."
else
    echo "ℹ️ .env file already exists. Skipping generation to preserve passwords."
fi

# 4. Start Application
echo "🚀 Launching Containers..."
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "---------------------------------------------------"
echo "🎉 Deployment Complete!"
echo "👉 App is running at: https://$DOMAIN"
echo ""
echo "⚠️ IMPORTANT: If the site does not load:"
echo "1. Go to Google Cloud Console -> Compute Engine"
echo "2. Click on your instance 'quantpulse-server'"
echo "3. Click EDIT"
echo "4. Scroll to Firewalls and check [x] Allow HTTP and [x] Allow HTTPS"
echo "5. Click SAVE"
echo "---------------------------------------------------"

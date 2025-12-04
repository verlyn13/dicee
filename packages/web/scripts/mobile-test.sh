#!/bin/bash
# Mobile testing server launcher for Dicee

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get local IP address
get_local_ip() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost"
  else
    # Linux
    hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost"
  fi
}

LOCAL_IP=$(get_local_ip)
PORT=5173

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Dicee Mobile Testing Server                              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📱 Mobile Access URL:${NC}"
echo -e "   ${YELLOW}http://${LOCAL_IP}:${PORT}${NC}"
echo ""
echo -e "${CYAN}💻 Desktop Access:${NC}"
echo -e "   http://localhost:${PORT}"
echo ""
echo -e "${CYAN}📲 Generate QR Code:${NC}"
echo "   pnpm qr"
echo ""
echo -e "${CYAN}🔍 Remote Debugging:${NC}"
echo "   • Chrome: chrome://inspect"
echo "   • Safari: Develop → [Device Name]"
echo "   • Firefox: about:debugging"
echo ""
echo -e "${GREEN}Starting server...${NC}"
echo ""

# Start Vite with host flag
exec pnpm dev --host
